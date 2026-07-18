import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { parseOrThrow } from '../lib/validation.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth-middleware.js';
import { createAiRateLimiter } from '../middleware/rate-limit.js';
import { idempotencyMiddleware } from '../middleware/idempotency-middleware.js';
import { enhance, translateAll } from '../services/ai-service.js';
import { KNOWN_AMENITIES } from '../constants/amenities.js';
import { buildReviewPrompt } from '../services/ai-prompt-builder.js';
import { createOpenRouterProvider } from '../services/providers/openrouter-provider.js';
import { createNvidiaProvider } from '../services/providers/nvidia-provider.js';
import {
  createPaidFallbackProvider,
  probeJsonMode,
} from '../services/providers/paid-fallback-provider.js';
import { getCachedResult, setCachedResult, buildCacheKey } from '../services/ai-cache.js';
import { TASK_CONFIG, type AIProvider, type AIProviderConfig } from '../services/ai-provider.js';
import { isCircuitClosed, recordSuccess, recordFailure } from '../services/circuit-breaker.js';
import {
  enhanceRequestSchema,
  translateAllSchema,
  reviewRequestSchema,
  generateRequestSchema,
  suggestAmenitiesSchema,
} from '../validators/ai-validators.js';

let primaryProvider: AIProvider | null = null;
let openRouterProvider: ReturnType<typeof createOpenRouterProvider> | null = null;
let paidFallbackProvider: ReturnType<typeof createPaidFallbackProvider> | null = null;

function getPrimaryProvider() {
  if (!primaryProvider) {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey) {
      primaryProvider = createNvidiaProvider(nvidiaKey);
    } else {
      const orKey = process.env.OPENROUTER_API_KEY;
      if (!orKey)
        throw new Error('No AI provider configured (set NVIDIA_API_KEY or OPENROUTER_API_KEY)');
      primaryProvider = createOpenRouterProvider(orKey);
    }
  }
  return primaryProvider;
}

function getOpenRouterProvider() {
  if (!openRouterProvider) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      openRouterProvider = createOpenRouterProvider(apiKey);
    }
  }
  return openRouterProvider;
}

function getPaidFallbackProvider() {
  if (!paidFallbackProvider) {
    const apiKey = process.env.OPENROUTER_PAID_API_KEY;
    if (apiKey && apiKey !== 'sk-or-v1-yyyyyyyy') {
      paidFallbackProvider = createPaidFallbackProvider(apiKey);
      probeJsonMode(apiKey).catch(() => {});
    }
  }
  return paidFallbackProvider;
}

function getFallbackProviders() {
  const fallbacks: AIProvider[] = [];
  const or = getOpenRouterProvider();
  if (or && primaryProvider?.id !== 'openrouter') fallbacks.push(or);
  const paid = getPaidFallbackProvider();
  if (paid) fallbacks.push(paid);
  return fallbacks;
}

async function tryStreamingProviders(
  providers: AIProvider[],
  system: string,
  user: string,
  config: AIProviderConfig,
) {
  for (const provider of providers) {
    if (!isCircuitClosed(provider.id)) continue;
    try {
      const stream = await provider.stream(system, user, config);
      recordSuccess(provider.id);
      return stream;
    } catch (e) {
      console.error(`[ai-routes] streaming ${provider.id} failed:`, e);
      recordFailure(provider.id);
    }
  }
  throw new Error('All providers failed for streaming');
}

export function createAiRouter(): Router {
  const router = Router();

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const nvidiaKey = process.env.NVIDIA_API_KEY;
      const orKey = process.env.OPENROUTER_API_KEY;
      const paidKey = process.env.OPENROUTER_PAID_API_KEY;
      res.status(200).json({
        status: nvidiaKey || orKey ? 'ok' : 'unconfigured',
        primary: nvidiaKey ? 'nvidia' : orKey ? 'openrouter-free' : 'missing',
        fallback: paidKey ? 'paid-openrouter' : 'not configured',
        version: 1,
      });
    }),
  );

  router.post(
    '/enhance',
    requireAuth,
    idempotencyMiddleware(),
    createAiRateLimiter('enhance'),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const body = parseOrThrow(enhanceRequestSchema, req.body);

      const estimatedTokens =
        Math.ceil(body.currentValue.length / 3) +
        Math.ceil(JSON.stringify(body.metadata).length / 3);
      if (estimatedTokens > 3500) {
        throw new HttpError(
          400,
          ErrorCode.VALIDATION_ERROR,
          'Text is too long for AI processing. Try enhancing a shorter section.',
        );
      }

      const provider = getPrimaryProvider();
      const fallbacks = getFallbackProviders();

      const isStreaming = req.headers['accept'] === 'text/event-stream';
      if (isStreaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
          const { system, user } = await import('../services/ai-prompt-builder.js').then((m) =>
            m.buildEnhancePrompt(body, body.locale),
          );

          const config =
            TASK_CONFIG[body.action as keyof typeof TASK_CONFIG] ?? TASK_CONFIG.enhance;
          const allProviders = [provider, ...getFallbackProviders()];
          const stream = await tryStreamingProviders(allProviders, system, user, config);

          for await (const chunk of stream) {
            res.write(`event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
          }

          res.write(`event: done\ndata: ${JSON.stringify({ usage: stream.usage })}\n\n`);
          res.end();
        } catch {
          res.write(`event: error\ndata: ${JSON.stringify({ error: 'AI generation failed' })}\n\n`);
          res.end();
        }
        return;
      }

      const result = await enhance(body, provider, fallbacks);
      res.status(200).json({ result: result.text, usage: result.usage });
    }),
  );

  router.post(
    '/translate-all',
    requireAuth,
    idempotencyMiddleware(),
    createAiRateLimiter('translate'),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const body = parseOrThrow(translateAllSchema, req.body);

      const provider = getPrimaryProvider();
      const fallbacks = getFallbackProviders();

      const result = await translateAll(
        body.locale,
        body.targetLocale,
        body.sourceFields,
        body.metadata,
        provider,
        fallbacks,
      );

      res.status(200).json({ translation: result.data, usage: result.usage });
    }),
  );

  router.post(
    '/review',
    requireAuth,
    createAiRateLimiter('review'),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const body = parseOrThrow(reviewRequestSchema, req.body);

      const provider = getPrimaryProvider();
      const fallbacks = getFallbackProviders();
      const { system, user } = buildReviewPrompt(body.propertyData, body.locale);

      const allProviders = [provider, ...fallbacks];
      let result: Awaited<ReturnType<AIProvider['generate']>> | null = null;
      for (const p of allProviders) {
        if (!isCircuitClosed(p.id)) continue;
        try {
          result = await p.generate(
            system,
            user + '\n\nOutput ONLY valid JSON. No markdown, no explanations.',
            TASK_CONFIG.review,
          );
          recordSuccess(p.id);
          break;
        } catch (e) {
          console.error(`[review] ${p.id} failed:`, e instanceof Error ? e.message : e);
          recordFailure(p.id);
        }
      }
      if (!result) throw new Error('AI review service unavailable');

      const cleaned = result.text
        .replace(/```json?\n?/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      res.status(200).json({ ...parsed, usage: result.usage });
    }),
  );

  router.post(
    '/generate',
    requireAuth,
    idempotencyMiddleware(),
    createAiRateLimiter('generate'),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const body = parseOrThrow(generateRequestSchema, req.body);

      const provider = getPrimaryProvider();

      const cacheKey = buildCacheKey({
        locale: body.locale,
        fieldType: body.fieldType,
        action: 'generate',
        currentValue: body.keywords ?? '',
        metadata: body.metadata,
      });

      const cached = await getCachedResult(cacheKey);
      if (cached) {
        res.status(200).json({
          result: cached,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        });
        return;
      }

      const { buildEnhancePrompt } = await import('../services/ai-prompt-builder.js');
      const result = await provider.generate(
        buildEnhancePrompt(
          {
            ...body,
            currentValue: body.keywords ?? '',
            action: 'enhance',
          },
          body.locale,
        ).system,
        `${body.fieldType === 'title' ? 'Generate a SHORT, catchy title (max 120 chars, one line, no period). It must be a title, not a sentence or paragraph.' : `Generate a ${body.fieldType} for this property`} based on: ${body.keywords ?? 'the property data'}.\n\nMetadata:\n${JSON.stringify(body.metadata, null, 2)}\n\nOutput only the generated text — no labels, no quotes.`,
        TASK_CONFIG.generate,
      );

      await setCachedResult(cacheKey, result.text);
      res.status(200).json({ result: result.text, usage: result.usage });
    }),
  );

  router.post(
    '/suggest-amenities',
    requireAuth,
    idempotencyMiddleware(),
    createAiRateLimiter('generate'),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const body = parseOrThrow(suggestAmenitiesSchema, req.body);

      const provider = getPrimaryProvider();
      const system =
        'You are a real estate amenity recommendation assistant. Return only a JSON array of amenity strings. No explanation.';
      const user = `Suggest amenities for a ${body.propertyType} with ${body.rooms} bedroom(s) in ${body.city}. Existing amenities: ${body.existingAmenities.join(', ') || 'none'}. Valid amenity keys: ${KNOWN_AMENITIES.join(', ')}. Only return amenities from this list. Return a JSON array of recommended amenity strings.`;

      const result = await provider.generate(system, user, TASK_CONFIG.generate);
      const cleaned = result.text
        .replace(/```json?\n?/gi, '')
        .replace(/```/g, '')
        .trim();
      const amenities = JSON.parse(cleaned) as string[];

      res.status(200).json({ amenities, usage: result.usage });
    }),
  );

  return router;
}

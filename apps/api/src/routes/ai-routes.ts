import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { parseOrThrow } from '../lib/validation.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth-middleware.js';
import { createAiRateLimiter } from '../middleware/rate-limit.js';
import { idempotencyMiddleware } from '../middleware/idempotency-middleware.js';
import { enhance, enhanceStreaming, translateAll, reviewListing } from '../services/ai-service.js';
import { buildEnhancePrompt } from '../services/ai-prompt-builder.js';
import { KNOWN_AMENITIES } from '../constants/amenities.js';
import { createOpenRouterProvider } from '../services/providers/openrouter-provider.js';
import { createNvidiaProvider } from '../services/providers/nvidia-provider.js';
import {
  createPaidFallbackProvider,
  probeJsonMode,
} from '../services/providers/paid-fallback-provider.js';
import { getCachedResult, setCachedResult, buildCacheKey } from '../services/ai-cache.js';
import { TASK_CONFIG } from '../services/ai-provider.js';
import { executeWithFallback } from '../services/execute-with-fallback.js';
import { extractAndParseJSON } from '../lib/extract-json.js';
import { mapCategoryToI18n } from '../services/ai-review-types.js';
import { scrubPii } from '../services/pii-scrubber.js';
import type { AIProvider } from '../services/ai-provider.js';
import type { EnhanceRequest } from '../validators/ai-validators.js';
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

function getPrimaryProvider(): AIProvider {
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

function getFallbackProviders(): AIProvider[] {
  const fallbacks: AIProvider[] = [];
  const or = getOpenRouterProvider();
  if (or && primaryProvider?.id !== 'openrouter') fallbacks.push(or);
  const paid = getPaidFallbackProvider();
  if (paid) fallbacks.push(paid);
  return fallbacks;
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
      const provider = getPrimaryProvider();
      const fallbacks = getFallbackProviders();

      const isStreaming = req.headers['accept'] === 'text/event-stream';
      if (isStreaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
          const result = await enhanceStreaming(
            body,
            provider,
            fallbacks,
            req.user?.userId ?? 'anon',
          );
          for await (const chunk of result.stream) {
            res.write(`event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
          }
          res.write(`event: done\ndata: ${JSON.stringify({ usage: result.usage() })}\n\n`);
          res.end();
        } catch {
          res.write(`event: error\ndata: ${JSON.stringify({ error: 'AI generation failed' })}\n\n`);
          res.end();
        }
        return;
      }

      const result = await enhance(body, provider, fallbacks, req.user?.userId ?? 'anon');
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
        req.user?.userId ?? 'anon',
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

      const result = await reviewListing(
        body.locale,
        body.propertyData,
        provider,
        fallbacks,
        req.user?.userId ?? 'anon',
      );
      const mappedIssues = result.issues.map((issue) => ({
        ...issue,
        category: mapCategoryToI18n(issue.category),
      }));
      res.status(200).json({
        issues: mappedIssues,
        qualityScore: result.qualityScore,
        usage: result.usage,
      });
    }),
  );

  const FIELD_TO_GENERATE_ACTION: Record<string, string> = {
    title: 'generate_title',
    summary: 'generate_summary',
    area: 'generate_neighborhood',
    highlights: 'generate_highlights',
  };

  router.post(
    '/generate',
    requireAuth,
    idempotencyMiddleware(),
    createAiRateLimiter('generate'),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const body = parseOrThrow(generateRequestSchema, req.body);

      const scrubbedKeywords = body.keywords ? scrubPii(body.keywords) : '';

      const cacheKey = buildCacheKey({
        locale: body.locale,
        fieldType: body.fieldType,
        action: 'generate',
        currentValue: scrubbedKeywords,
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

      const provider = getPrimaryProvider();
      const generateAction = FIELD_TO_GENERATE_ACTION[body.fieldType] ?? 'enhance';
      const prompt = buildEnhancePrompt(
        {
          locale: body.locale,
          fieldType: body.fieldType,
          action: generateAction as EnhanceRequest['action'],
          currentValue: scrubbedKeywords || '',
          metadata: body.metadata,
          requestNonce: body.requestNonce,
        },
        body.locale,
      );

      const result = await executeWithFallback(
        [provider],
        prompt.system,
        prompt.user,
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

      const system =
        'You are a real estate amenity recommendation assistant. Return only a JSON array of amenity strings from the provided valid list. No explanation, no markdown.';
      const user = `Suggest matching amenities for a ${scrubPii(body.propertyType)} with ${body.rooms} bedroom(s) in ${scrubPii(body.city)}. Existing amenities: ${body.existingAmenities.join(', ') || 'none'}. Valid amenity keys: ${KNOWN_AMENITIES.join(', ')}. Only return amenities from this list. Return a JSON array of recommended amenity strings.`;

      const provider = getPrimaryProvider();
      const result = await executeWithFallback([provider], system, user, TASK_CONFIG.generate);
      const raw = extractAndParseJSON(result.text);
      const validAmenities = KNOWN_AMENITIES as readonly string[];
      const amenities = Array.isArray(raw)
        ? (raw as unknown[]).filter(
            (a): a is string => typeof a === 'string' && validAmenities.includes(a),
          )
        : [];

      res.status(200).json({ amenities, usage: result.usage });
    }),
  );

  return router;
}

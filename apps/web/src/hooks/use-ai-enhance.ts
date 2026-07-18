import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { enhanceField, generateField, streamEnhanceField } from '../services/ai-service';
import type { PropertyMetadata } from '../services/ai-service';

export type AiFieldStatus = 'idle' | 'loading' | 'success' | 'error' | 'rate_limited';

export type UseAiEnhanceOptions = {
  fieldType: string;
  action?: string;
  metadata: PropertyMetadata;
  locale: string;
  stream?: boolean;
};

export type UseAiEnhanceReturn = {
  status: AiFieldStatus;
  enhancedValue: string | null;
  errorMessage: string | null;
  enhance: (currentValue: string) => Promise<void>;
  generate: (keywords: string) => Promise<void>;
  reset: () => void;
  clearError: () => void;
};

export function useAiEnhance(options: UseAiEnhanceOptions): UseAiEnhanceReturn {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AiFieldStatus>('idle');
  const [enhancedValue, setEnhancedValue] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nonceRef = useRef(0);

  const enhance = useCallback(
    async (currentValue: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('loading');
      setEnhancedValue(null);
      setErrorMessage(null);

      const nonce = ++nonceRef.current;
      const requestKey = crypto.randomUUID();

      try {
        if (options.stream) {
          let accumulated = '';
          for await (const chunk of streamEnhanceField(
            {
              locale: options.locale as 'en' | 'ar',
              fieldType: options.fieldType,
              action: options.action ?? 'enhance',
              currentValue,
              metadata: options.metadata,
              requestNonce: nonce,
            },
            requestKey,
            controller.signal,
          )) {
            accumulated += chunk;
            setEnhancedValue(accumulated);
          }
        } else {
          const result = await enhanceField(
            {
              locale: options.locale as 'en' | 'ar',
              fieldType: options.fieldType,
              action: options.action ?? 'enhance',
              currentValue,
              metadata: options.metadata,
              requestNonce: nonce,
            },
            requestKey,
            controller.signal,
          );
          setEnhancedValue(result.result);
        }

        setStatus('success');
      } catch (err) {
        if ((err as Error)?.name === 'CanceledError' || (err as Error)?.name === 'AbortError')
          return;

        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 429) {
          setStatus('rate_limited');
          setErrorMessage(t('ai.rateLimited'));
        } else {
          setStatus('error');
          setErrorMessage(t('ai.generationFailed'));
        }
      }
    },
    [options.locale, options.fieldType, options.action, options.metadata, options.stream, t],
  );

  const generate = useCallback(
    async (keywords: string) => {
      setStatus('loading');
      setEnhancedValue(null);
      setErrorMessage(null);

      const nonce = ++nonceRef.current;
      const requestKey = crypto.randomUUID();

      try {
        const result = await generateField(
          options.locale as 'en' | 'ar',
          options.fieldType,
          keywords,
          options.metadata,
          requestKey,
          nonce,
        );
        setEnhancedValue(result.result);
        setStatus('success');
      } catch (err) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 429) {
          setStatus('rate_limited');
          setErrorMessage(t('ai.rateLimited'));
        } else {
          setStatus('error');
          setErrorMessage(t('ai.generationFailed'));
        }
      }
    },
    [options.locale, options.fieldType, options.metadata, t],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setEnhancedValue(null);
    setErrorMessage(null);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return { status, enhancedValue, errorMessage, enhance, generate, reset, clearError };
}

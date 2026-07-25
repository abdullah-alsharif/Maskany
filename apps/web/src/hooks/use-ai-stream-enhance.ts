import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { streamEnhanceField } from '../services/ai-service';
import type { PropertyMetadata } from '../services/ai-service';
import type { AiFieldStatus } from './use-ai-enhance';

export type UseAiStreamEnhanceOptions = {
  fieldType: string;
  action?: string;
  metadata: PropertyMetadata;
  locale: string;
  customInstruction?: string;
};

export type UseAiStreamEnhanceReturn = {
  status: AiFieldStatus;
  enhancedValue: string | null;
  errorMessage: string | null;
  enhance: (currentValue: string) => Promise<string>;
  reset: () => void;
};

export function useAiStreamEnhance(options: UseAiStreamEnhanceOptions): UseAiStreamEnhanceReturn {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AiFieldStatus>('idle');
  const [enhancedValue, setEnhancedValue] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nonceRef = useRef(0);

  const enhance = useCallback(
    async (currentValue: string): Promise<string> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('loading');
      setEnhancedValue(null);
      setErrorMessage(null);

      const nonce = ++nonceRef.current;
      const requestKey = crypto.randomUUID();

      try {
        let accumulated = '';
        for await (const chunk of streamEnhanceField(
          {
            locale: options.locale as 'en' | 'ar',
            fieldType: options.fieldType,
            action: options.action ?? 'enhance',
            currentValue,
            customInstruction: options.customInstruction,
            metadata: options.metadata,
            requestNonce: nonce,
          },
          requestKey,
          controller.signal,
        )) {
          accumulated += chunk;
          setEnhancedValue(accumulated);
        }

        setStatus('success');
        return accumulated;
      } catch (err) {
        if ((err as Error)?.name === 'CanceledError' || (err as Error)?.name === 'AbortError') {
          setStatus('idle');
          return currentValue;
        }

        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 429) {
          setStatus('rate_limited');
          setErrorMessage(t('ai.rateLimited'));
        } else {
          setStatus('error');
          setErrorMessage(t('ai.generationFailed'));
        }
        throw err;
      }
    },
    [
      options.locale,
      options.fieldType,
      options.action,
      options.customInstruction,
      options.metadata,
      t,
    ],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setEnhancedValue(null);
    setErrorMessage(null);
  }, []);

  return { status, enhancedValue, errorMessage, enhance, reset };
}

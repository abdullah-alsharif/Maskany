import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { generateField } from '../services/ai-service';
import type { PropertyMetadata } from '../services/ai-service';
import type { AiFieldStatus } from './use-ai-enhance';

export type UseAiGenerateOptions = {
  fieldType: string;
  metadata: PropertyMetadata;
  locale: string;
};

export type UseAiGenerateReturn = {
  status: AiFieldStatus;
  enhancedValue: string | null;
  errorMessage: string | null;
  generate: (keywords: string) => Promise<string>;
  reset: () => void;
};

export function useAiGenerate(options: UseAiGenerateOptions): UseAiGenerateReturn {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AiFieldStatus>('idle');
  const [enhancedValue, setEnhancedValue] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const nonceRef = useRef(0);

  const generate = useCallback(
    async (keywords: string): Promise<string> => {
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
        return result.result;
      } catch (err) {
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
    [options.locale, options.fieldType, options.metadata, t],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setEnhancedValue(null);
    setErrorMessage(null);
  }, []);

  return { status, enhancedValue, errorMessage, generate, reset };
}

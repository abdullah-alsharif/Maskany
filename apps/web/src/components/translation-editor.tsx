/**
 * TranslationEditor — shared component for adding/editing property
 * translations in both create and edit flows.
 *
 * Create mode: fields propagate up via `onChange`; no save button.
 * Edit   mode: includes a save button with loading/status feedback.
 */
'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button } from './ui/button';
import { AiEnhanceButton } from './ai/ai-enhance-button';
import { useAiHistory } from '../hooks/use-ai-history';
import { useIdempotencyKey } from '../hooks/use-idempotency-key';
import { translateAllFields, type PropertyMetadata } from '../services/ai-service';

export type TranslationData = {
  title: string;
  summary: string;
  description: string;
  city: string;
  area: string;
  country: string;
};

export type TranslationSourceFields = {
  title: string;
  summary?: string;
  description: string;
  city: string;
  area?: string;
  country: string;
};

type TranslationEditorProps = {
  mode: 'create' | 'edit';
  open: boolean;
  onToggle: () => void;
  value: TranslationData;
  onChange: (data: TranslationData) => void;
  onSave?: () => void;
  saving?: boolean;
  message?: string | null;
  targetLangLabel?: string;
  metadata?: PropertyMetadata;
  locale?: 'en' | 'ar';
  sourceFields?: TranslationSourceFields;
};

const inputClass =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-shadow duration-200';

const textareaClass =
  'min-h-[80px] w-full rounded-xl border border-stone-300 bg-white p-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-shadow duration-200';

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-xs font-medium text-stone-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export function TranslationEditor({
  mode,
  open,
  onToggle,
  value,
  onChange,
  onSave,
  saving,
  message,
  targetLangLabel,
  metadata,
  sourceFields,
}: TranslationEditorProps) {
  const { t, i18n } = useTranslation();
  const history = useAiHistory();
  const { key: idempotencyKey, reset: renewKey } = useIdempotencyKey();

  const effectiveLocale = (i18n.language?.startsWith('ar') ? 'ar' : 'en') as 'en' | 'ar';
  const sourceLocale = effectiveLocale;
  const targetLocale = (effectiveLocale === 'en' ? 'ar' : 'en') as 'en' | 'ar';
  const transDir = targetLocale === 'ar' ? 'rtl' : 'ltr';
  const transAlign = targetLocale === 'ar' ? 'text-right' : 'text-left';
  const targetT = i18n.getFixedT(targetLocale);

  const update = (field: keyof TranslationData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!metadata) throw new Error('Metadata required for AI generation');
      const result = await translateAllFields(
        sourceLocale,
        targetLocale,
        {
          title: sourceFields?.title ?? '',
          summary: sourceFields?.summary,
          description: sourceFields?.description ?? '',
          city: sourceFields?.city ?? '',
          area: sourceFields?.area,
          country: sourceFields?.country ?? '',
        },
        metadata,
        idempotencyKey,
      );
      return result.translation;
    },
    onSuccess: (translation) => {
      onChange({
        title: translation.title ?? '',
        summary: translation.summary ?? '',
        description: translation.description ?? '',
        city: translation.city ?? '',
        area: translation.area ?? '',
        country: translation.country ?? '',
      });
      renewKey();
    },
  });

  return (
    <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-900 text-base">
            {t('propertyForm.translationHeading')}
          </h3>
          <p className="text-xs text-stone-500">
            {mode === 'create'
              ? t('propertyForm.translationHintOptional')
              : t('propertyForm.translationHint', { lang: targetLangLabel })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metadata && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (!open) onToggle();
                generateMutation.mutate();
              }}
              loading={generateMutation.isPending}
            >
              ✨ {t('ai.generateTranslation')}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onToggle}
            data-testid="translation-toggle"
          >
            {open
              ? t('propertyForm.hide')
              : mode === 'create'
                ? t('propertyForm.addTranslationOptional')
                : t('propertyForm.addTranslation', { lang: targetLangLabel })}
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 pt-2 border-t border-stone-100" dir={transDir}>
          <Field id="trans-title" label={targetT('propertyForm.title')}>
            <div className="relative">
              <input
                id="trans-title"
                type="text"
                value={value.title}
                onChange={(e) => update('title', e.target.value)}
                className={`${inputClass} pe-28 ${transAlign}`}
              />
              {metadata && (
                <div className="absolute end-1 top-1/2 -translate-y-1/2 z-10">
                  <AiEnhanceButton
                    fieldKey="trans-city"
                    currentValue={value.city}
                    fieldType="city"
                    metadata={metadata}
                    onResult={(v) => update('title', v)}
                    locale={targetLocale}
                    history={history}
                  />
                </div>
              )}
            </div>
          </Field>

          <Field id="trans-summary" label={targetT('propertyForm.summary')}>
            <div className="relative">
              <input
                id="trans-summary"
                type="text"
                value={value.summary}
                onChange={(e) => update('summary', e.target.value)}
                className={`${inputClass} pe-28 ${transAlign}`}
              />
              {metadata && (
                <div className="absolute end-1 top-1/2 -translate-y-1/2 z-10">
                  <AiEnhanceButton
                    fieldKey="trans-summary"
                    currentValue={value.summary}
                    fieldType="summary"
                    metadata={metadata}
                    onResult={(v) => update('summary', v)}
                    locale={targetLocale}
                    history={history}
                  />
                </div>
              )}
            </div>
          </Field>

          <Field id="trans-description" label={targetT('propertyForm.description')}>
            <div className="relative">
              <textarea
                id="trans-description"
                value={value.description}
                onChange={(e) => update('description', e.target.value)}
                className={`${textareaClass} pe-28 ${transAlign}`}
              />
              {metadata && (
                <div className="absolute end-1 top-1 z-10">
                  <AiEnhanceButton
                    fieldKey="trans-description"
                    currentValue={value.description}
                    fieldType="description"
                    metadata={metadata}
                    onResult={(v) => update('description', v)}
                    locale={targetLocale}
                    history={history}
                  />
                </div>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field id="trans-city" label={targetT('propertyForm.city')}>
              <input
                id="trans-city"
                type="text"
                value={value.city}
                onChange={(e) => update('city', e.target.value)}
                className={`${inputClass} ${transAlign}`}
              />
            </Field>
            <Field id="trans-area" label={targetT('propertyForm.areaNeighborhood')}>
              <input
                id="trans-area"
                type="text"
                value={value.area}
                onChange={(e) => update('area', e.target.value)}
                className={`${inputClass} ${transAlign}`}
              />
            </Field>
          </div>

          {mode === 'edit' && (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={onSave} loading={saving}>
                {t('propertyForm.saveTranslation')}
              </Button>
            </div>
          )}

          {message && (
            <p role="alert" className="text-sm text-stone-600 font-medium">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

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
import { Button } from './ui/button';

export type TranslationData = {
  title: string;
  summary: string;
  description: string;
  city: string;
  area: string;
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
}: TranslationEditorProps) {
  const { t } = useTranslation();

  const update = (field: keyof TranslationData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

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
        <Button type="button" variant="secondary" size="sm" onClick={onToggle}>
          {open
            ? t('propertyForm.hide')
            : mode === 'create'
              ? t('propertyForm.addTranslationOptional')
              : t('propertyForm.addTranslation', { lang: targetLangLabel })}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 pt-2 border-t border-stone-100">
          <Field id="trans-title" label={t('propertyForm.title')}>
            <input
              id="trans-title"
              type="text"
              value={value.title}
              onChange={(e) => update('title', e.target.value)}
              className={inputClass}
            />
          </Field>

          {mode === 'edit' && (
            <Field id="trans-summary" label={t('propertyForm.summary')}>
              <input
                id="trans-summary"
                type="text"
                value={value.summary}
                onChange={(e) => update('summary', e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          <Field id="trans-description" label={t('propertyForm.description')}>
            <textarea
              id="trans-description"
              value={value.description}
              onChange={(e) => update('description', e.target.value)}
              className={textareaClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field id="trans-city" label={t('propertyForm.city')}>
              <input
                id="trans-city"
                type="text"
                value={value.city}
                onChange={(e) => update('city', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field id="trans-area" label={t('propertyForm.areaNeighborhood')}>
              <input
                id="trans-area"
                type="text"
                value={value.area}
                onChange={(e) => update('area', e.target.value)}
                className={inputClass}
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

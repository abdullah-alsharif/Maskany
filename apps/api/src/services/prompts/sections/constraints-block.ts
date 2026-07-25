import type { SectionRenderer } from '../types.js';

export const constraintsBlockRenderer: SectionRenderer = (section, context) => {
  const constraints = context.constraints;
  const locale = context.locale;
  const isAr = locale === 'ar';
  const t = (en: string, ar: string) => (isAr ? ar : en);

  if (!constraints?.maxLength && !constraints?.minLength) return null;

  const parts: string[] = [];
  if (constraints.maxLength) {
    parts.push(
      `${t('Do not exceed', 'لا تتجاوز')} ${constraints.maxLength} ${t('characters.', 'حرفاً.')}`,
    );
  }
  if (constraints.minLength) {
    parts.push(
      `${t('Do not output fewer than', 'لا تقل عن')} ${constraints.minLength} ${t('characters.', 'حرفاً.')}`,
    );
  }

  return `--- ${t('CONSTRAINTS', 'القيود')} ---\n${parts.join(' ')}`;
};

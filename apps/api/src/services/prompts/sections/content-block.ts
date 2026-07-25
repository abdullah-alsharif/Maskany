import type { SectionRenderer } from '../types.js';

export const contentBlockRenderer: SectionRenderer = (section, context) => {
  const currentValue = context.currentValue;
  const locale = context.locale;
  const isAr = locale === 'ar';
  const t = (en: string, ar: string) => (isAr ? ar : en);

  return [
    `--- ${t('CONTENT TO PROCESS', 'المحتوى المراد معالجته')} ---`,
    `${t('Current value:', 'القيمة الحالية:')}`,
    currentValue || t('(empty)', '(فارغ)'),
  ].join('\n');
};

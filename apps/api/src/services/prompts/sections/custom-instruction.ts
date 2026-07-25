import type { SectionRenderer } from '../types.js';

export const customInstructionRenderer: SectionRenderer = (section, context) => {
  const instruction = context.customInstruction;
  const locale = context.locale;
  const isAr = locale === 'ar';
  const t = (en: string, ar: string) => (isAr ? ar : en);

  if (!instruction?.trim()) return null;

  return [`--- ${t('CUSTOM INSTRUCTION', 'تعليمات مخصصة')} ---`, instruction.trim()].join('\n');
};

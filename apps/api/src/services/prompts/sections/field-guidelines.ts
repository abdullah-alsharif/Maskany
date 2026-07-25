import type { SectionRenderer } from '../types.js';

const FIELD_GUIDELINES: Record<string, Record<string, string>> = {
  title: {
    en: 'Short, one-line title (max 120 chars, no period). Must be a title, not a paragraph. Highlight the best feature. Preserve the property type and any location landmarks from the current value.',
    ar: 'عنوان قصير من سطر واحد (حد أقصى 120 حرفاً، لا نقطة). يجب أن يكون عنواناً وليس فقرة. أبرز أفضل ميزة. حافظ على نوع العقار وأي معالم موقع من النص الحالي.',
  },
  summary: {
    en: 'Brief 1-2 sentence overview. Capture the essence of the property. Keep location and property type from the original.',
    ar: 'نظرة عامة موجزة من 1-2 جملة. التقط جوهر العقار. حافظ على الموقع ونوع العقار من النص الأصلي.',
  },
  description: {
    en: 'Detailed 2-3 paragraph description. Start with the best feature, mention lifestyle benefits, end with a subtle invitation.',
    ar: 'وصف مفصل من 2-3 فقرات. ابدأ بأفضل ميزة، اذكر فوائد نمط الحياة، وانتهِ بدعوة لطيفة.',
  },
  area: {
    en: 'Factual description of the neighborhood. Mention nearby landmarks, transport, shops. 1-2 sentences.',
    ar: 'وصف واقعي للحي. اذكر المعالم القريبة ووسائل النقل والمتاجر. 1-2 جمل.',
  },
  city: {
    en: 'Refine the city name or include a brief, factual note about the city or district. Keep it concise.',
    ar: 'حسّن اسم المدينة أو أضف ملاحظة واقعية موجزة عن المدينة أو الحي. كن موجزاً.',
  },
  amenities: {
    en: 'List amenities naturally. Group related ones. 1 sentence.',
    ar: 'اذكر وسائل الراحة بشكل طبيعي. جمّع المتشابهة منها. جملة واحدة.',
  },
  highlights: {
    en: 'Generate 3-5 bullet points highlighting the best features. Each bullet one line. Keep factual.',
    ar: 'أنشئ 3-5 نقاط تلخّص أبرز الميزات. كل نقطة في سطر. حافظ على الدقة الواقعية.',
  },
};

export const fieldGuidelinesRenderer: SectionRenderer = (section, context) => {
  const fieldType = context.fieldType;
  const locale = context.locale;
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  if (!fieldType) return null;

  const guideline = FIELD_GUIDELINES[fieldType];
  if (!guideline) {
    return `${t('Field:', 'الحقل:')} ${fieldType} — ${t('Write naturally for this field type.', 'اكتب بشكل طبيعي لهذا النوع من الحقول.')}`;
  }

  return `${t('Field:', 'الحقل:')} ${fieldType} — ${guideline[locale === 'ar' ? 'ar' : 'en']}`;
};

import type { SectionRenderer } from '../types.js';

const ACTION_INSTRUCTIONS: Record<string, Record<string, string>> = {
  enhance: {
    en: 'Improve wording and flow. Fix grammar. Keep ALL facts intact. Make it more compelling without exaggeration.',
    ar: 'حسّن الصياغة والتدفق. صحّح القواعد. حافظ على جميع الحقائق. اجعل النص أكثر جاذبية دون مبالغة.',
  },
  rewrite: {
    en: 'Complete rewrite with fresh structure. Keep ALL facts exactly as provided.',
    ar: 'إعادة كتابة كاملة بهيكل جديد. حافظ على جميع الحقائق كما هي.',
  },
  shorten: {
    en: 'Condense to essential information only. Remove repetition and fluff.',
    ar: 'اختصر إلى المعلومات الأساسية فقط. أزل التكرار والحشو.',
  },
  expand: {
    en: 'Add 2-3 sentences of descriptive detail about lifestyle or nearby attractions.',
    ar: 'أضف 2-3 جمل من التفاصيل الوصفية عن نمط الحياة أو المعالم القريبة.',
  },
  fix_grammar: {
    en: 'Correct grammar, spelling, punctuation only. Do not change any creative content, word choice, or structure.',
    ar: 'صحّح القواعد والإملاء وعلامات الترقيم فقط. لا تغير أي محتوى إبداعي أو اختيار الكلمات أو البنية.',
  },
  simplify: {
    en: 'Use simpler vocabulary and shorter sentences. Aim for reading age 12-14.',
    ar: 'استخدم مفردات أبسط وجمل أقصر. استهدف مستوى قراءة 12-14 سنة.',
  },
  persuasive: {
    en: 'Add emotional hooks and subtle call-to-action. Keep ALL facts factual.',
    ar: 'أضف خطافات عاطفية ودعوة خفيفة للعمل. حافظ على جميع الحقائق.',
  },
  professional: {
    en: 'Use formal, polished language suitable for professional real estate. Maintain a confident, authoritative tone.',
    ar: 'استخدم لغة رسمية ومصقولة مناسبة للعقارات الاحترافية. حافظ على نبرة واثقة وموثوقة.',
  },
  luxury: {
    en: 'Use sophisticated, aspirational language. Emphasise exclusivity, premium finishes, and lifestyle prestige.',
    ar: 'استخدم لغة راقية وطموحة. ركّز على الحصرية والتشطيبات الفاخرة ومكانة نمط الحياة.',
  },
  friendly: {
    en: 'Use warm, approachable language. Write as if speaking to a friend. Keep it inviting and natural.',
    ar: 'استخدم لغة دافئة وقريبة. اكتب وكأنك تتحدث مع صديق. اجعل النص جذاباً وطبيعياً.',
  },
  generate_title: {
    en: 'Generate a short, catchy title (max 120 chars, one line, no period). It must be a title, not a sentence or paragraph.',
    ar: 'أنشئ عنواناً قصيراً وجذاباً (حد أقصى 120 حرفاً، سطر واحد، لا نقطة في النهاية). يجب أن يكون عنواناً وليس جملة أو فقرة.',
  },
  generate_summary: {
    en: 'Generate a brief 1-2 sentence summary. Capture the essence of the property.',
    ar: 'أنشئ ملخصاً موجزاً من 1-2 جملة. التقط جوهر العقار.',
  },
  generate_neighborhood: {
    en: 'Generate a factual description of the neighborhood. Mention nearby landmarks, transport, shops. 1-2 sentences.',
    ar: 'أنشئ وصفاً واقعياً للحي. اذكر المعالم القريبة ووسائل النقل والمتاجر. 1-2 جمل.',
  },
  generate_highlights: {
    en: 'Generate 3-5 bullet points highlighting the best features of this property.',
    ar: 'أنشئ 3-5 نقاط تلخّص أبرز ميزات هذا العقار.',
  },
};

export const actionInstructionsRenderer: SectionRenderer = (section, context) => {
  const action = context.action;
  const locale = context.locale;
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  if (!action) return section.localeContent[locale] || section.localeContent.en || null;

  const instruction = ACTION_INSTRUCTIONS[action];
  if (!instruction) {
    return `${t('Action:', 'الإجراء:')} ${ACTION_INSTRUCTIONS.enhance[locale === 'ar' ? 'ar' : 'en']}`;
  }

  return `${t('Action:', 'الإجراء:')} ${instruction[locale === 'ar' ? 'ar' : 'en']}`;
};

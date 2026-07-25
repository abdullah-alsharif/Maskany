import type { SectionRenderer } from '../types.js';

const TONE_GUIDELINES: Record<string, Record<string, string>> = {
  professional: {
    en: 'Use formal, polished language. Avoid slang and contractions. Sound confident and authoritative.',
    ar: 'استخدم لغة رسمية ومصقولة. تجنب العامية والاختصارات. كن واثقاً وموثوقاً.',
  },
  luxury: {
    en: 'Use sophisticated vocabulary. Emphasise exclusivity, premium materials, and prestige. Create desire.',
    ar: 'استخدم مفردات راقية. ركّز على الحصرية والمواد الفاخرة والمكانة. أثِر الرغبة.',
  },
  friendly: {
    en: 'Use warm, conversational language. Write as if describing the property to a friend.',
    ar: 'استخدم لغة دافئة ومحادثة. اكتب وكأنك تصف العقار لصديق.',
  },
  warm: {
    en: 'Use inviting, welcoming language. Emphasise comfort, coziness, and feeling at home.',
    ar: 'استخدم لغة جذابة ومرحبة. ركّز على الراحة والدفء والشعور بالمنزل.',
  },
};

export const toneGuidelinesRenderer: SectionRenderer = (section, context) => {
  const tone = context.tone;
  const locale = context.locale;
  const isAr = locale === 'ar';
  const t = (en: string, ar: string) => (isAr ? ar : en);

  if (!tone) return null;

  const guideline = TONE_GUIDELINES[tone];
  if (!guideline) {
    return `${t('Tone:', 'النبرة:')} ${tone}`;
  }

  return `${t('Tone:', 'النبرة:')} ${guideline[isAr ? 'ar' : 'en']}`;
};

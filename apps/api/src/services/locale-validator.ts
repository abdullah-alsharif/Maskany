const ARABIC_CHARS = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/;
const LATIN_CHARS = /[a-zA-Z]+/;

export function validateLocale(text: string, expectedLocale: 'en' | 'ar'): boolean {
  if (text.length < 10) return true;

  const hasArabic = ARABIC_CHARS.test(text);
  const hasLatin = LATIN_CHARS.test(text);

  // Mixed script — trust the model
  if (hasArabic && hasLatin) return true;

  if (expectedLocale === 'ar') return hasArabic;
  return hasLatin;
}

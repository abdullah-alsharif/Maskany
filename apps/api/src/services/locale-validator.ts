const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
const LATIN_RE = /[a-zA-Z]/g;

export function validateLocale(text: string, expectedLocale: 'en' | 'ar'): boolean {
  if (text.length < 20) return true;

  const arabicChars = text.match(ARABIC_RE);
  const latinChars = text.match(LATIN_RE);
  const arabicCount = arabicChars ? arabicChars.length : 0;
  const latinCount = latinChars ? latinChars.length : 0;
  const total = arabicCount + latinCount;
  if (total === 0) return true;

  const arabicRatio = arabicCount / total;

  if (expectedLocale === 'ar') return arabicRatio > 0.15;
  return arabicRatio < 0.85;
}

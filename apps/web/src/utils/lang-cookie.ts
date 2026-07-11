export const LANG_COOKIE = 'maskany_lang';

export function setLangCookie(lang: string) {
  document.cookie = `${LANG_COOKIE}=${lang};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

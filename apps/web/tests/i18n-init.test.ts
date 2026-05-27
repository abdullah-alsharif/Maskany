import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n';

describe('i18n initialization (T-048)', () => {
  it('exports SUPPORTED_LANGS containing en and ar', async () => {
    const mod = await import('../src/i18n');
    expect(mod.SUPPORTED_LANGS).toEqual(['en', 'ar']);
  });

  it('exports LANG_STORAGE_KEY as maskany_lang', async () => {
    const mod = await import('../src/i18n');
    expect(mod.LANG_STORAGE_KEY).toBe('maskany_lang');
  });

  it('exports a default i18n instance that is initialized', () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it('defaults to English and can change to Arabic', async () => {
    expect(i18n.language.startsWith('en')).toBe(true);
    await i18n.changeLanguage('ar');
    expect(i18n.language.startsWith('ar')).toBe(true);
    await i18n.changeLanguage('en');
  });

  it('exports a SupportedLang type', async () => {
    const mod = await import('../src/i18n');
    const check: mod.SupportedLang = 'en';
    expect(check).toBe('en');
  });

  it('resolves translation keys for the en locale', () => {
    expect(i18n.t('nav.home')).toBe('Home');
  });
});

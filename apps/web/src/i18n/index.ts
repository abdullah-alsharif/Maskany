import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import ar from './ar.json';

export const LANG_STORAGE_KEY = 'maskany_lang';
export const SUPPORTED_LANGS = ['en', 'ar'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const resources = { en: { translation: en }, ar: { translation: ar } } as const;

if (i18n.isInitialized) {
  // HMR-safe: on a hot reload the module re-executes with a fresh bundle,
  // but re-init is skipped to avoid double-registering plugins. Replace the
  // resource bundles instead so newly added or edited keys appear immediately.
  for (const lng of SUPPORTED_LANGS) {
    i18n.addResourceBundle(lng, 'translation', resources[lng].translation, true, true);
  }
} else {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGS,
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: LANG_STORAGE_KEY,
        caches: ['localStorage'],
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export default i18n;

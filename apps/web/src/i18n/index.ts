import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import ar from './ar.json';

export const LANG_STORAGE_KEY = 'maskany_lang';
export const SUPPORTED_LANGS = ['en', 'ar'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        ar: { translation: ar },
      },
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

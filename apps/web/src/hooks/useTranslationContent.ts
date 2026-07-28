import { useTranslation } from 'react-i18next';

type TranslatableContent = {
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  city?: string | null;
  area?: string | null;
  country?: string | null;
  amenities?: string[] | null;
};

type TranslationData = {
  translation?: TranslatableContent | null;
  locale: string;
};

export function useTranslationContent<T extends TranslationData>(
  item: T,
): { needsTranslation: boolean } & TranslatableContent {
  const { i18n } = useTranslation();
  const userLocale = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const needsTranslation = userLocale !== item.locale && !!item.translation;
  const t = item.translation;

  return {
    needsTranslation,
    title: needsTranslation && t ? t.title : null,
    summary: needsTranslation && t ? t.summary : null,
    description: needsTranslation && t ? t.description : null,
    city: needsTranslation && t ? t.city : null,
    area: needsTranslation && t ? t.area : null,
    country: needsTranslation && t ? t.country : null,
    amenities: needsTranslation && t ? t.amenities : null,
  };
}

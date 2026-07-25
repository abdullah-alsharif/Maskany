import type { SectionRenderer } from '../types.js';

export const guardRulesRenderer: SectionRenderer = (section, context) => {
  const meta = context.metadata;
  const locale = context.locale;
  const isAr = locale === 'ar';
  const t = (en: string, ar: string) => (isAr ? ar : en);

  if (!meta) return null;

  const lines: string[] = [];
  lines.push(`--- ${t('RULES', 'القواعد')} ---`);
  lines.push(
    t(
      `- Do NOT change: rooms (${meta.rooms}), bathrooms (${meta.bathrooms}), price (${meta.price})`,
      `- لا تغير: الغرف (${meta.rooms})، الحمامات (${meta.bathrooms})، السعر (${meta.price})`,
    ),
  );
  lines.push(
    t(
      `- Keep currency (${meta.currency}) and price unit (${meta.priceUnit}) unchanged`,
      `- حافظ على العملة (${meta.currency}) ووحدة السعر (${meta.priceUnit}) كما هي`,
    ),
  );
  lines.push(
    t(
      `- Keep the property type (${meta.propertyType}) and location landmarks from the original text`,
      `- حافظ على نوع العقار (${meta.propertyType}) ومعالم الموقع من النص الأصلي`,
    ),
  );
  if (meta.areaSqm) {
    lines.push(
      t(
        `- Keep area (${meta.areaSqm}m²) unchanged`,
        `- حافظ على المساحة (${meta.areaSqm}m²) كما هي`,
      ),
    );
  }
  lines.push(
    t(
      '- Output only the improved text — no labels, no quotes, no explanations',
      '- أخرج النص المحسّن فقط — لا تسميات ولا علامات اقتباس ولا شروحات',
    ),
  );

  return lines.join('\n');
};

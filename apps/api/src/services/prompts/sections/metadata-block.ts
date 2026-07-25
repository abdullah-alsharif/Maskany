import type { SectionRenderer } from '../types.js';

export const metadataBlockRenderer: SectionRenderer = (section, context) => {
  const meta = context.metadata;
  if (!meta) return section.localeContent[context.locale] || section.localeContent.en || null;

  const locale = context.locale;
  const isAr = locale === 'ar';
  const header = isAr ? '--- بيانات العقار ---' : '--- PROPERTY METADATA ---';
  const lines = [header];

  const typeLabel = isAr ? 'النوع:' : 'Type:';
  const locationLabel = isAr ? 'الموقع:' : 'Location:';
  const priceLabel = isAr ? 'السعر:' : 'Price:';
  const amenitiesLabel = isAr ? 'وسائل الراحة:' : 'Amenities:';
  const sizeLabel = isAr ? 'المساحة:' : 'Size:';

  const rooms = meta.rooms as number;
  const baths = meta.bathrooms as number;
  const roomsStr = rooms === 0 ? (isAr ? 'استوديو' : 'Studio') : `${rooms}BR`;

  lines.push(`${typeLabel} ${meta.propertyType}, ${roomsStr}/${baths}BA`);

  const city = meta.city as string;
  const area = meta.area as string | undefined;
  lines.push(`${locationLabel} ${city}${area ? `, ${area}` : ''}`);

  lines.push(`${priceLabel} ${meta.price}`);

  const amenities = (meta.amenities as string[]) || [];
  lines.push(
    `${amenitiesLabel} ${amenities.length ? amenities.join(', ') : isAr ? '(غير محدد)' : '(none selected)'}`,
  );

  if (meta.areaSqm) {
    lines.push(`${sizeLabel} ${meta.areaSqm}m²`);
  }

  return lines.join('\n');
};

/**
 * Property service — thin wrapper around the property REST API used by
 * the owner-facing create/edit flows (T-028).
 *
 * The payloads mirror the shape accepted by
 * `POST /api/properties` and `PUT /api/properties/:id`. Image uploads
 * piggyback onto the same service so callers only deal with one
 * module.
 */
import i18n from 'i18next';
import { apiClient } from './api';
import type { Property, PropertyMedia } from '../types/property';
import type { PropertyFormValues } from '../components/property-form';

export type PropertyPayload = {
  title: string;
  summary?: string;
  description?: string;
  propertyType: string;
  city: string;
  area?: string;
  country?: string;
  price: string;
  currency?: string;
  priceUnit: PropertyFormValues['priceUnit'];
  rooms: number;
  bathrooms: number;
  areaSqm?: string;
  amenities?: string[];
  locale?: string;
  whatsappNumber: string;
};

/**
 * Strip empty / undefined fields so the backend Zod schema does not
 * reject optional strings like `""`.
 */
export function toPropertyPayload(values: PropertyFormValues): PropertyPayload {
  const payload: PropertyPayload = {
    title: values.title.trim(),
    propertyType: values.propertyType,
    city: values.city.trim(),
    price: values.price,
    priceUnit: values.priceUnit,
    rooms: values.rooms,
    bathrooms: values.bathrooms,
    locale: i18n.language.startsWith('ar') ? 'ar' : 'en',
    whatsappNumber: values.whatsappNumber.trim(),
  };
  const summary = values.summary.trim();
  if (summary) payload.summary = summary;
  const description = values.description.trim();
  if (description) payload.description = description;
  const area = values.area.trim();
  if (area) payload.area = area;
  const country = values.country.trim();
  if (country) payload.country = country;
  const currency = values.currency.trim();
  if (currency) payload.currency = currency;
  const areaSqm = values.areaSqm.trim();
  if (areaSqm) payload.areaSqm = areaSqm;
  if (values.amenities.length > 0) payload.amenities = values.amenities;
  return payload;
}

export async function createProperty(values: PropertyFormValues): Promise<Property> {
  const response = await apiClient.post<Property>('/properties', toPropertyPayload(values));
  return response.data;
}

export async function updateProperty(
  propertyId: string,
  values: PropertyFormValues,
): Promise<Property> {
  const response = await apiClient.put<Property>(
    `/properties/${propertyId}`,
    toPropertyPayload(values),
  );
  return response.data;
}

export async function savePropertyTranslation(
  propertyId: string,
  locale: 'en' | 'ar',
  data: {
    title: string;
    summary?: string | null;
    description?: string | null;
    city: string;
    area?: string | null;
    country?: string;
    amenities?: string[];
  },
): Promise<void> {
  await apiClient.put(`/properties/${propertyId}/translations/${locale}`, data);
}

export async function uploadPropertyImages(
  propertyId: string,
  files: File[],
): Promise<PropertyMedia[]> {
  if (files.length === 0) return [];
  const form = new FormData();
  for (const file of files) {
    form.append('images', file);
  }
  const response = await apiClient.post<{ media: PropertyMedia[] }>(
    `/properties/${propertyId}/media`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data.media;
}

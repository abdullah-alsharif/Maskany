/**
 * CreatePropertyPage — wraps the multi-step <PropertyForm> (T-028).
 *
 * Submitting a valid form posts to `POST /api/properties`, then uploads
 * any selected images via the media endpoint, and finally navigates to
 * the new property detail page.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/layout/header';
import { PropertyForm, type PropertyFormSubmitPayload } from '../components/property-form';
import { SeoHead } from '../components/seo-head';
import { useTranslation } from 'react-i18next';
import {
  createProperty,
  uploadPropertyImages,
  savePropertyTranslation,
} from '../services/property-service';

export function CreatePropertyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: PropertyFormSubmitPayload) => {
      const property = await createProperty(payload);
      try {
        if (payload.images.length > 0) {
          await uploadPropertyImages(property.id, payload.images);
        }
      } catch {
        // Image upload failure — property is created, continue
      }
      try {
        if (payload.translation) {
          const targetLocale = property.locale === 'en' ? 'ar' : 'en';
          const t = payload.translation;
          await savePropertyTranslation(property.id, targetLocale, {
            title: t.title.trim(),
            summary: t.summary.trim() || null,
            description: t.description.trim() || null,
            city: t.city.trim(),
            area: t.area.trim() || null,
            country: t.country.trim() || 'SA',
          });
        }
      } catch {
        // Translation save failure — property is created, continue
      }
      return property;
    },
    onSuccess: async (property) => {
      await queryClient.invalidateQueries({ queryKey: ['my-properties'] });
      router.push(`/properties/${property.id}`);
    },
    onError: () => {
      setError(t('createListing.error'));
    },
  });

  return (
    <section className="page-content">
      <SeoHead title={t('meta.createListing.title')} description={t('meta.createListing.desc')} />
      <Header showBack title={t('createListing.header')} />
      <div className="px-4 py-5 max-w-2xl mx-auto">
        <PropertyForm
          mode="create"
          onSubmit={(payload) => {
            setError(null);
            mutation.mutate(payload);
          }}
          submitting={mutation.isPending}
        />
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 font-medium">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

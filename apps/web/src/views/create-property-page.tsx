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
import {
  createProperty,
  uploadPropertyImages,
  savePropertyTranslation,
} from '../services/property-service';

export function CreatePropertyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: PropertyFormSubmitPayload) => {
      const property = await createProperty(payload);
      if (payload.images.length > 0) {
        await uploadPropertyImages(property.id, payload.images);
      }
      if (payload.translation) {
        const targetLocale = property.locale === 'en' ? 'ar' : 'en';
        await savePropertyTranslation(property.id, targetLocale, payload.translation);
      }
      return property;
    },
    onSuccess: async (property) => {
      await queryClient.invalidateQueries({ queryKey: ['my-properties'] });
      router.push(`/properties/${property.id}`);
    },
    onError: (err: unknown) => {
      const data = (
        err as {
          response?: { data?: { details?: { path: string; message: string }[]; message?: string } };
        }
      )?.response?.data;
      if (data?.details?.length) {
        setError(data.details.map((d) => `${d.path}: ${d.message}`).join('; '));
      } else if (data?.message) {
        setError(data.message);
      } else {
        setError('We could not save this listing. Please try again.');
      }
    },
  });

  return (
    <section className="page-content">
      <SeoHead title="Create listing | Maskany" description="List your property on Maskany." />
      <Header showBack title="Create listing" />
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

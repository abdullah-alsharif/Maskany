/**
 * EditPropertyPage — loads a property, pre-fills the multi-step form,
 * and PUTs changes back to the API (T-028).
 */
'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/layout/header';
import { EmptyState } from '../components/ui/empty-state';
import {
  PropertyForm,
  type PropertyFormSubmitPayload,
  type PropertyFormValues,
} from '../components/property-form';
import { SeoHead } from '../components/seo-head';
import { SkeletonDetailPage } from '../components/ui/skeleton';
import { useProperty } from '../hooks/use-property';
import { updateProperty } from '../services/property-service';
import type { Property } from '../types/property';

function toFormValues(property: Property): PropertyFormValues {
  return {
    title: property.title,
    summary: property.summary,
    description: property.description,
    propertyType: property.propertyType,
    city: property.city,
    area: property.area ?? '',
    country: property.country,
    price: String(property.price),
    currency: property.currency,
    priceUnit: property.priceUnit,
    rooms: property.rooms,
    bathrooms: property.bathrooms,
    areaSqm: property.areaSqm === null ? '' : String(property.areaSqm),
    amenities: property.amenities,
    whatsappNumber: property.whatsappNumber,
  };
}

export function EditPropertyPage() {
  const params = useParams() ?? {};
  const id = params['id'] as string | undefined;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: property, isPending, error: loadError } = useProperty(id);

  const mutation = useMutation({
    mutationFn: async (payload: PropertyFormSubmitPayload) => {
      if (!id) throw new Error('Missing property id.');
      return updateProperty(id, payload);
    },
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-properties'] }),
        queryClient.invalidateQueries({ queryKey: ['property', updated.id] }),
      ]);
      router.push(`/properties/${updated.id}`);
    },
    onError: () => {
      setError('We could not update this listing. Please try again.');
    },
  });

  if (isPending) {
    return (
      <section className="page-content">
        <Header showBack title="Edit listing" />
        <SkeletonDetailPage />
      </section>
    );
  }

  if (loadError || !property) {
    return (
      <section className="page-content">
        <Header showBack title="Edit listing" />
        <EmptyState title="Listing not found" description="This property could not be loaded." />
      </section>
    );
  }

  return (
    <section className="page-content">
      <SeoHead
        title={`Edit ${property.title} | Maskany`}
        description="Update your listing details."
      />
      <Header showBack title="Edit listing" />
      <div className="px-4 py-5 max-w-2xl mx-auto">
        <PropertyForm
          mode="edit"
          initialValues={toFormValues(property)}
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

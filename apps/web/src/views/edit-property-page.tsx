/**
 * EditPropertyPage — loads a property, pre-fills the multi-step form,
 * and PUTs changes back to the API (T-028).
 */
'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import { updateProperty, savePropertyTranslation } from '../services/property-service';
import { TranslationEditor, type TranslationData } from '../components/translation-editor';
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
  const { t } = useTranslation();
  const params = useParams() ?? {};
  const id = params['id'] as string | undefined;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [transOpen, setTransOpen] = useState(false);
  const [transSaving, setTransSaving] = useState(false);
  const [transMsg, setTransMsg] = useState<string | null>(null);
  const [transForm, setTransForm] = useState({
    title: '',
    summary: '',
    description: '',
    city: '',
    area: '',
    country: '',
  });

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
      setError(t('editListing.updateError'));
    },
  });

  const handleToggleTrans = () => {
    if (!transOpen) {
      if (property?.translation) {
        setTransForm({
          title: property.translation.title,
          summary: property.translation.summary ?? '',
          description: property.translation.description ?? '',
          city: property.translation.city,
          area: property.translation.area ?? '',
          country: property.translation.country,
        });
      } else {
        setTransForm({
          title: '',
          summary: '',
          description: '',
          city: '',
          area: '',
          country: '',
        });
      }
    }
    setTransOpen(!transOpen);
  };

  const saveTrans = async () => {
    if (!id || !property) return;
    setTransSaving(true);
    setTransMsg(null);
    try {
      const targetLocale = property.locale === 'en' ? 'ar' : 'en';
      await savePropertyTranslation(id, targetLocale, {
        title: transForm.title.trim(),
        summary: transForm.summary.trim() || null,
        description: transForm.description.trim() || null,
        city: transForm.city.trim(),
        area: transForm.area.trim() || null,
        country: transForm.country.trim() || 'SA',
      });
      setTransMsg(t('propertyForm.translationSaved'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['property', id] }),
        queryClient.invalidateQueries({ queryKey: ['properties'] }),
        queryClient.invalidateQueries({ queryKey: ['my-properties'] }),
      ]);
    } catch {
      setTransMsg(t('propertyForm.translationError'));
    } finally {
      setTransSaving(false);
    }
  };

  if (isPending) {
    return (
      <section className="page-content">
        <Header showBack title={t('editListing.header')} />
        <SkeletonDetailPage />
      </section>
    );
  }

  if (loadError || !property) {
    return (
      <section className="page-content">
        <Header showBack title={t('editListing.header')} />
        <EmptyState title={t('editListing.notFound')} description={t('editListing.notFoundDesc')} />
      </section>
    );
  }

  const targetLang = property.locale === 'en' ? 'العربية' : 'English';

  return (
    <section className="page-content">
      <SeoHead title={t('meta.myProperties.title')} description={t('meta.myProperties.desc')} />
      <Header showBack title={t('editListing.header')} />
      <div className="px-4 py-5 max-w-2xl mx-auto space-y-6">
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

        <TranslationEditor
          mode="edit"
          open={transOpen}
          onToggle={handleToggleTrans}
          value={transForm}
          onChange={(data: TranslationData) => setTransForm(data)}
          onSave={saveTrans}
          saving={transSaving}
          message={transMsg}
          targetLangLabel={targetLang}
        />
      </div>
    </section>
  );
}

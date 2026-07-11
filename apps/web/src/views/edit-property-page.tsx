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
import {
  updateProperty,
  savePropertyTranslation,
  uploadPropertyImages,
  deletePropertyMedia,
  reorderPropertyMedia,
} from '../services/property-service';
import { apiClient } from '../services/api';
import { TranslationEditor, type TranslationData } from '../components/translation-editor';
import type { Property, PropertyMedia } from '../types/property';

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

      // 1. Update property fields
      const updated = await updateProperty(id, payload);

      // 2. Handle image deletions
      if (property?.media && payload.editedExistingImages) {
        const keptIds = new Set(payload.editedExistingImages.map((img) => img.id));
        const deletedIds = property.media
          .filter((img) => !keptIds.has(img.id))
          .map((img) => img.id);
        await Promise.all(deletedIds.map((mediaId) => deletePropertyMedia(id, mediaId)));
      }

      // 3. Upload new images
      let uploadedMedia: PropertyMedia[] = [];
      if (payload.images.length > 0) {
        uploadedMedia = await uploadPropertyImages(id, payload.images);
      }

      // 4. Reorder all media — backend requires every media asset exactly once.
      //    Build ordered list: user-ordered images + newly uploaded + videos
      //    not shown in the edit UI (e.g. existing videos).
      const orderedImageIds = [
        ...(payload.editedExistingImages ?? []).map((img) => img.id),
        ...uploadedMedia.map((m) => m.id),
      ];

      // Fetch the full current media list to include any videos the UI didn't manage
      const freshProperty = await apiClient.get<{ media?: PropertyMedia[] }>(`/properties/${id}`);
      const allCurrentMedia = freshProperty.data.media ?? [];
      const managedIds = new Set(orderedImageIds);
      const unmanagedMedia = allCurrentMedia
        .filter((m) => !managedIds.has(m.id))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const finalOrder = [...orderedImageIds, ...unmanagedMedia.map((m) => m.id)];

      if (finalOrder.length > 0) {
        await reorderPropertyMedia(id, finalOrder);
      }

      return updated;
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
          initialImages={property.images ?? []}
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

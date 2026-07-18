/**
 * EditPropertyPage — loads a property, pre-fills the multi-step form,
 * and PUTs changes back to the API (T-028).
 *
 * The primary form language is always the *currently selected admin
 * locale* (i18n.language), never the locale the property was originally
 * created in. The translation panel always targets the opposite language.
 */
'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/layout/header';
import { EmptyState } from '../components/ui/empty-state';
import {
  PropertyForm,
  type PropertyFormHandle,
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
import { AiConsentDialog } from '../components/ai/ai-consent-dialog';
import { AiReviewPanel } from '../components/ai/ai-review-panel';
import { buildPropertyMetadata } from '../services/ai-service';
import type { Property, PropertyMedia } from '../types/property';

export function EditPropertyPage() {
  const { t, i18n } = useTranslation();
  const userLocale = (i18n.language?.startsWith('ar') ? 'ar' : 'en') as 'en' | 'ar';
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
  const [consentOpen, setConsentOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const formRef = useRef<PropertyFormHandle>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('ai-consent')) {
      setConsentOpen(true);
    }
  }, []);

  const { data: property, isPending, error: loadError } = useProperty(id);

  const isSwapped = property ? userLocale !== property.locale : false;

  const toFormValues = useCallback(
    (p: Property): PropertyFormValues => {
      if (isSwapped) {
        return {
          title: p.translation?.title ?? '',
          summary: p.translation?.summary ?? '',
          description: p.translation?.description ?? '',
          propertyType: p.propertyType,
          city: p.translation?.city ?? '',
          area: p.translation?.area ?? '',
          country: p.translation?.country ?? '',
          price: String(p.price),
          currency: p.currency,
          priceUnit: p.priceUnit,
          rooms: p.rooms,
          bathrooms: p.bathrooms,
          areaSqm: p.areaSqm === null ? '' : String(p.areaSqm),
          amenities: p.amenities,
          whatsappNumber: p.whatsappNumber,
        };
      }
      return {
        title: p.title,
        summary: p.summary,
        description: p.description,
        propertyType: p.propertyType,
        city: p.city,
        area: p.area ?? '',
        country: p.country,
        price: String(p.price),
        currency: p.currency,
        priceUnit: p.priceUnit,
        rooms: p.rooms,
        bathrooms: p.bathrooms,
        areaSqm: p.areaSqm === null ? '' : String(p.areaSqm),
        amenities: p.amenities,
        whatsappNumber: p.whatsappNumber,
      };
    },
    [isSwapped],
  );

  const primaryFields = useMemo(() => {
    if (!property) return null;
    if (isSwapped) {
      return {
        title: property.translation?.title ?? '',
        summary: property.translation?.summary ?? undefined,
        description: property.translation?.description ?? '',
        city: property.translation?.city ?? '',
        area: property.translation?.area ?? undefined,
        country: property.translation?.country ?? '',
      };
    }
    return {
      title: property.title,
      summary: property.summary ?? undefined,
      description: property.description,
      city: property.city,
      area: property.area ?? undefined,
      country: property.country,
    };
  }, [property, isSwapped]);

  const mutation = useMutation({
    mutationFn: async (payload: PropertyFormSubmitPayload) => {
      if (!id) throw new Error('Missing property id.');

      if (isSwapped && property) {
        // Admin language differs from property's primary locale.
        // Form contains content in the admin's language → save to translation table.
        await savePropertyTranslation(id, userLocale, {
          title: payload.title.trim(),
          summary: payload.summary.trim() || null,
          description: payload.description.trim() || null,
          city: payload.city.trim(),
          area: payload.area.trim() || null,
          country: payload.country.trim() || 'SA',
        });

        // Non-text fields + original property text fields go back to the
        // property table so we never overwrite the original language.
        await updateProperty(id, {
          ...payload,
          title: property.title,
          summary: property.summary ?? '',
          description: property.description ?? '',
          city: property.city,
          area: property.area ?? '',
          country: property.country,
        });
      } else {
        // Normal mode — form matches property's primary locale.
        await updateProperty(id, payload);
      }

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
      const orderedImageIds = [
        ...(payload.editedExistingImages ?? []).map((img) => img.id),
        ...uploadedMedia.map((m) => m.id),
      ];

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

      // Return a fresh snapshot so onSuccess gets the merged state.
      if (id) {
        const { data: refreshed } = await apiClient.get<Property>(`/properties/${id}`);
        return refreshed;
      }
      return property!;
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
    if (!transOpen && property) {
      if (isSwapped) {
        setTransForm({
          title: property.title,
          summary: property.summary ?? '',
          description: property.description ?? '',
          city: property.city,
          area: property.area ?? '',
          country: property.country,
        });
      } else if (property.translation) {
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
      if (isSwapped) {
        // Translation editor holds the property's primary language content
        // → save back to the property table
        await updateProperty(id, {
          title: transForm.title,
          summary: transForm.summary,
          description: transForm.description,
          city: transForm.city,
          area: transForm.area,
          country: transForm.country,
          propertyType: property.propertyType,
          price: String(property.price),
          currency: property.currency,
          priceUnit: property.priceUnit,
          rooms: property.rooms,
          bathrooms: property.bathrooms,
          areaSqm: property.areaSqm === null ? '' : String(property.areaSqm),
          amenities: property.amenities,
          whatsappNumber: property.whatsappNumber,
        });
      } else {
        const targetLocale = property.locale === 'en' ? 'ar' : 'en';
        await savePropertyTranslation(id, targetLocale, {
          title: transForm.title.trim(),
          summary: transForm.summary.trim() || null,
          description: transForm.description.trim() || null,
          city: transForm.city.trim(),
          area: transForm.area.trim() || null,
          country: transForm.country.trim() || 'SA',
        });
      }
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

  const targetLang = userLocale === 'en' ? 'العربية' : 'English';

  const propertyMetadata = useMemo(
    () =>
      property
        ? buildPropertyMetadata({
            propertyType: property.propertyType,
            rooms: property.rooms,
            bathrooms: property.bathrooms,
            city: isSwapped ? (property.translation?.city ?? property.city) : property.city,
            area: isSwapped
              ? (property.translation?.area ?? property.area ?? '')
              : (property.area ?? ''),
            country: isSwapped
              ? (property.translation?.country ?? property.country)
              : property.country,
            price: String(property.price),
            currency: property.currency,
            priceUnit: property.priceUnit,
            areaSqm: property.areaSqm === null ? '' : String(property.areaSqm),
            amenities: property.amenities,
          })
        : undefined,
    [property, isSwapped],
  );

  const reviewPropertyData = useMemo(() => {
    if (!property) {
      return {
        title: '',
        summary: undefined as string | undefined,
        description: '',
        propertyType: 'APARTMENT',
        rooms: 0,
        bathrooms: 0,
        city: '',
        area: undefined as string | undefined,
        price: '',
        amenities: [] as string[],
      };
    }
    return {
      title: isSwapped ? (property.translation?.title ?? property.title) : property.title,
      summary: isSwapped
        ? (property.translation?.summary ?? property.summary ?? undefined)
        : (property.summary ?? undefined),
      description: isSwapped
        ? (property.translation?.description ?? property.description ?? '')
        : (property.description ?? ''),
      propertyType: property.propertyType,
      rooms: property.rooms,
      bathrooms: property.bathrooms,
      city: isSwapped ? (property.translation?.city ?? property.city) : property.city,
      area: isSwapped
        ? (property.translation?.area ?? property.area ?? undefined)
        : (property.area ?? undefined),
      price: String(property.price),
      amenities: property.amenities,
    };
  }, [property, isSwapped]);

  const handleConsentAccept = () => {
    localStorage.setItem('ai-consent', 'true');
    setConsentOpen(false);
  };

  const handleConsentDecline = () => {
    localStorage.setItem('ai-consent', 'declined');
    setConsentOpen(false);
  };

  const handleApplySuggestion = (field: string, value: string | null) => {
    if (value !== null) {
      formRef.current?.applySuggestion(field, value);
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

  return (
    <section className="page-content">
      <SeoHead title={t('meta.myProperties.title')} description={t('meta.myProperties.desc')} />
      <Header showBack title={t('editListing.header')} />
      <div className="px-4 py-5 max-w-2xl mx-auto space-y-6">
        <PropertyForm
          ref={formRef}
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
          metadata={propertyMetadata}
          locale={userLocale}
          sourceFields={primaryFields ?? undefined}
        />

        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-terracotta-50 text-terracotta-700 font-semibold text-sm hover:bg-terracotta-100 transition-colors"
          >
            ✨ {t('ai.startReview')}
          </button>
        </div>
      </div>

      <AiConsentDialog
        open={consentOpen}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />

      <AiReviewPanel
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        propertyData={reviewPropertyData}
        locale={userLocale}
        onApplySuggestion={handleApplySuggestion}
      />
    </section>
  );
}

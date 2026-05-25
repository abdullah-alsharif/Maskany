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
import { Button } from '../components/ui/button';
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

const inputClass =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200';

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
      setError('We could not update this listing. Please try again.');
    },
  });

  const handleTransOpen = () => {
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
    setTransOpen(true);
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
      setTransMsg(t('propertyForm.translationSaved') || 'Translation saved.');
      await queryClient.invalidateQueries({ queryKey: ['property', id] });
    } catch {
      setTransMsg(t('propertyForm.translationError') || 'Could not save translation.');
    } finally {
      setTransSaving(false);
    }
  };

  if (isPending) {
    return (
      <section className="page-content">
        <Header showBack title={t('editListing.header') || 'Edit listing'} />
        <SkeletonDetailPage />
      </section>
    );
  }

  if (loadError || !property) {
    return (
      <section className="page-content">
        <Header showBack title={t('editListing.header') || 'Edit listing'} />
        <EmptyState title="Listing not found" description="This property could not be loaded." />
      </section>
    );
  }

  const targetLang = property.locale === 'en' ? 'العربية' : 'English';

  return (
    <section className="page-content">
      <SeoHead
        title={`Edit ${property.title} | Maskany`}
        description="Update your listing details."
      />
      <Header showBack title="Edit listing" />
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

        {/* Translation section */}
        <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-stone-900 text-base">
                {t('propertyForm.translationHeading') || 'Translation'}
              </h3>
              <p className="text-xs text-stone-500">
                {t('propertyForm.translationHint', { lang: targetLang })}
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleTransOpen}>
              {transOpen
                ? (t('propertyForm.hide') || 'Hide')
                : t('propertyForm.addTranslation', { lang: targetLang })}
            </Button>
          </div>

          {transOpen && (
            <div className="space-y-3 pt-2 border-t border-stone-100">
              <div className="flex flex-col">
                <label className="text-xs font-medium text-stone-500 mb-1">
                  {t('propertyForm.title')}
                </label>
                <input
                  type="text"
                  value={transForm.title}
                  onChange={(e) => setTransForm((p) => ({ ...p, title: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-stone-500 mb-1">
                  {t('propertyForm.summary') || 'Summary'}
                </label>
                <input
                  type="text"
                  value={transForm.summary}
                  onChange={(e) => setTransForm((p) => ({ ...p, summary: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-stone-500 mb-1">
                  {t('propertyForm.description')}
                </label>
                <textarea
                  value={transForm.description}
                  onChange={(e) => setTransForm((p) => ({ ...p, description: e.target.value }))}
                  className="min-h-[80px] w-full rounded-xl border border-stone-300 bg-white p-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-stone-500 mb-1">
                    {t('propertyForm.city')}
                  </label>
                  <input
                    type="text"
                    value={transForm.city}
                    onChange={(e) => setTransForm((p) => ({ ...p, city: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-stone-500 mb-1">
                    {t('propertyForm.areaNeighborhood')}
                  </label>
                  <input
                    type="text"
                    value={transForm.area}
                    onChange={(e) => setTransForm((p) => ({ ...p, area: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={saveTrans} loading={transSaving}>
                  {t('propertyForm.saveTranslation') || 'Save translation'}
                </Button>
              </div>
              {transMsg && (
                <p role="alert" className="text-sm text-stone-600 font-medium">
                  {transMsg}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

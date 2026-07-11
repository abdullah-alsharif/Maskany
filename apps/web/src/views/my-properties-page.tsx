'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bed, Bath, Expand, ImageIcon, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { NoProperties } from '../components/ui/empty-state';
import { SkeletonCard } from '../components/ui/skeleton';
import { SeoHead } from '../components/seo-head';
import {
  useDeleteProperty,
  useMyProperties,
  useUpdatePropertyStatus,
} from '../hooks/use-my-properties';
import type { Property, PropertyStatus } from '../types/property';

function DeleteDialog({
  propertyTitle,
  onCancel,
  onConfirm,
  pending,
}: {
  propertyTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-4 animate-fade-in"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[var(--shadow-card-hover)] border border-stone-200/60 animate-scale-in">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
          <Trash2 size={22} className="text-red-500" strokeWidth={1.5} />
        </div>
        <h3
          id="delete-dialog-title"
          className="text-center font-display text-lg text-stone-950 leading-snug"
        >
          {t('myProperties.deleteTitle')}
        </h3>
        <p className="mt-2 text-center text-sm text-stone-500 leading-relaxed px-2">
          {t('myProperties.deleteDesc', { title: propertyTitle })}
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" size="md" onClick={onCancel} className="flex-1">
            {t('myProperties.cancel')}
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            loading={pending}
            className="flex-1"
          >
            {t('myProperties.confirmDelete')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PropertyRow({
  property,
  onDelete,
  onToggleStatus,
  statusPending,
  index,
}: {
  property: Property;
  onDelete: (p: Property) => void;
  onToggleStatus: (p: Property) => void;
  statusPending: boolean;
  index: number;
}) {
  const { t } = useTranslation();

  const statusLabelKey: Record<PropertyStatus, string> = {
    ACTIVE: 'myProperties.statusActive',
    INACTIVE: 'myProperties.statusInactive',
    DRAFT: 'myProperties.statusDraft',
  };

  const STATUS_VARIANTS: Record<PropertyStatus, 'success' | 'stone' | 'sand'> = {
    ACTIVE: 'success',
    INACTIVE: 'stone',
    DRAFT: 'sand',
  };

  const isActive = property.status === 'ACTIVE';
  const toggleLabel = isActive ? 'myProperties.deactivate' : 'myProperties.activate';

  const staggerClass = index < 6 ? `animate-stagger-${index + 1}` : '';

  return (
    <article
      className={`rounded-2xl bg-white shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow transition-transform duration-300 hover:-translate-y-0.5 overflow-hidden animate-slide-up ${staggerClass}`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Cover image */}
        <div className="relative w-full sm:w-44 h-36 sm:h-auto shrink-0 bg-stone-100 overflow-hidden sm:rounded-s-2xl">
          {property.coverImage?.url ? (
            <img
              src={property.coverImage.url}
              alt={property.coverImage.altText ?? property.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <ImageIcon size={28} className="text-stone-300" strokeWidth={1.2} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-5 flex flex-col justify-between gap-3">
          {/* Top row: title + badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-base text-stone-950 leading-snug truncate">
                {property.title}
              </h3>
              <p className="text-sm text-stone-400 mt-1">
                {property.area ? `${property.area}, ` : ''}
                {property.city}
              </p>
            </div>
            <Badge variant={STATUS_VARIANTS[property.status]} className="shrink-0 mt-0.5">
              {t(statusLabelKey[property.status])}
            </Badge>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-stone-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-stone-400">{t('myProperties.propertyType')}:</span>
              <span className="font-medium text-stone-700">
                {t(`propertyType.${property.propertyType}`)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-stone-400">{t('myProperties.price')}:</span>
              <span className="font-semibold text-stone-800">
                {new Intl.NumberFormat('en', {
                  style: 'currency',
                  currency: property.currency,
                  maximumFractionDigits: 0,
                }).format(property.price)}
              </span>
              <span className="text-stone-400 text-xs">
                /{t(`priceUnit.${property.priceUnit}`)}
              </span>
            </span>
          </div>

          {/* Detail icons */}
          <div className="flex items-center gap-5 text-sm text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <Bed size={15} className="text-stone-400" strokeWidth={1.5} />
              {property.rooms > 0 ? t('myProperties.rooms', { count: property.rooms }) : '—'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bath size={15} className="text-stone-400" strokeWidth={1.5} />
              {property.bathrooms > 0
                ? t('myProperties.bathrooms', { count: property.bathrooms })
                : '—'}
            </span>
            {property.areaSqm && (
              <span className="inline-flex items-center gap-1.5">
                <Expand size={15} className="text-stone-400" strokeWidth={1.5} />
                {t('myProperties.area', { count: property.areaSqm })}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 mt-1 border-t border-stone-100">
            <Link
              href={`/properties/${property.id}/edit`}
              aria-label={`${t('myProperties.edit')} ${property.title}`}
              className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3.5 rounded-lg border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors active:scale-[0.96]"
            >
              <Pencil size={15} aria-hidden="true" />
              {t('myProperties.edit')}
            </Link>
            <Button
              variant="secondary"
              size="sm"
              loading={statusPending}
              aria-label={`${t(toggleLabel)} ${property.title}`}
              onClick={() => onToggleStatus(property)}
            >
              <Power size={15} aria-hidden="true" />
              {t(toggleLabel)}
            </Button>
            <Button
              variant="danger"
              size="sm"
              aria-label={`${t('myProperties.delete')} ${property.title}`}
              onClick={() => onDelete(property)}
            >
              <Trash2 size={15} aria-hidden="true" />
              {t('myProperties.delete')}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MyPropertiesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [pendingDelete, setPendingDelete] = useState<Property | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const { data, isPending } = useMyProperties();
  const deleteMutation = useDeleteProperty();
  const statusMutation = useUpdatePropertyStatus();

  const properties = data?.properties ?? [];

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: () => {
        setDeleteError(t('myProperties.deleteError'));
      },
    });
  };

  const handleToggleStatus = (property: Property) => {
    const newStatus = property.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setPendingStatusId(property.id);
    statusMutation.mutate(
      { propertyId: property.id, status: newStatus },
      {
        onSettled: () => setPendingStatusId(null),
      },
    );
  };

  return (
    <section className="page-content">
      <SeoHead title={t('meta.myProperties.title')} description={t('meta.myProperties.desc')} />
      <header className="px-4 pt-8 pb-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-stone-950 leading-tight">
            {t('myProperties.heading')}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500 leading-relaxed">
            {t('myProperties.subheading')}
          </p>
          {properties.length > 0 && (
            <p className="mt-0.5 text-xs text-stone-400 font-medium tracking-wide uppercase">
              {t('myProperties.listingsCount', { count: properties.length })}
            </p>
          )}
        </div>
        <Link
          href="/properties/create"
          aria-label={t('myProperties.newListing')}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-terracotta-500 text-white text-sm font-semibold shadow-sm hover:bg-terracotta-600 active:bg-terracotta-700 transition-colors transition-shadow transition-transform duration-150 active:scale-[0.96] shrink-0"
        >
          <Plus size={18} aria-hidden="true" />
          {t('myProperties.newListing')}
        </Link>
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 px-4 py-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : properties.length === 0 ? (
        <NoProperties onCreate={() => router.push('/properties/create')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 px-4 py-4">
          {properties.map((property, index) => (
            <PropertyRow
              key={property.id}
              property={property}
              index={index}
              onDelete={setPendingDelete}
              onToggleStatus={handleToggleStatus}
              statusPending={property.id === pendingStatusId}
            />
          ))}
        </div>
      )}

      {pendingDelete && (
        <DeleteDialog
          propertyTitle={pendingDelete.title}
          pending={deleteMutation.isPending}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}
      {deleteError && (
        <p
          role="alert"
          className="fixed bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg"
        >
          {deleteError}
        </p>
      )}
    </section>
  );
}

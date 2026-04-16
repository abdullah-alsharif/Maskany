'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { NoProperties } from '../components/ui/empty-state';
import { SkeletonCard } from '../components/skeleton-card';
import { SeoHead } from '../components/seo-head';
import { useDeleteProperty, useMyProperties } from '../hooks/use-my-properties';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[var(--shadow-card-hover)]">
        <h3 id="delete-dialog-title" className="font-display text-xl text-stone-950">
          {t('myProperties.deleteTitle')}
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          {t('myProperties.deleteDesc', { title: propertyTitle })}
        </p>
        <div className="mt-5 flex gap-3">
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
}: {
  property: Property;
  onDelete: (p: Property) => void;
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

  return (
    <article className="rounded-2xl bg-white shadow-[var(--shadow-card)] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-stone-900">{property.title}</h3>
          <Badge variant={STATUS_VARIANTS[property.status]}>
            {t(statusLabelKey[property.status])}
          </Badge>
        </div>
        <p className="text-sm text-stone-500">
          {property.area ? `${property.area}, ` : ''}
          {property.city}
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/properties/${property.id}/edit`}
          aria-label={`${t('myProperties.edit')} ${property.title}`}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-800 hover:bg-stone-50 active:bg-stone-100 transition-colors"
        >
          <Pencil size={16} aria-hidden="true" />
          {t('myProperties.edit')}
        </Link>
        <Button
          variant="danger"
          size="sm"
          aria-label={`${t('myProperties.delete')} ${property.title}`}
          onClick={() => onDelete(property)}
        >
          <Trash2 size={16} aria-hidden="true" />
          {t('myProperties.delete')}
        </Button>
      </div>
    </article>
  );
}

export function MyPropertiesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [pendingDelete, setPendingDelete] = useState<Property | null>(null);

  const { data, isPending } = useMyProperties();
  const deleteMutation = useDeleteProperty();

  const properties = data?.properties ?? [];

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
    });
  };

  return (
    <section className="page-content">
      <SeoHead title="My properties | Maskany" description="Manage your property listings." />
      <header className="px-4 pt-6 pb-2 flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-3xl text-stone-950">{t('myProperties.heading')}</p>
          <p className="mt-1 text-sm text-stone-600">{t('myProperties.subheading')}</p>
        </div>
        <Link
          href="/properties/create"
          aria-label={t('myProperties.newListing')}
          className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-terracotta-500 text-white text-sm font-semibold shadow-sm hover:bg-terracotta-600 active:bg-terracotta-700 transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          {t('myProperties.newListing')}
        </Link>
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 py-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : properties.length === 0 ? (
        <NoProperties onCreate={() => router.push('/properties/create')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 px-4 py-4">
          {properties.map((property) => (
            <PropertyRow key={property.id} property={property} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      {pendingDelete && (
        <DeleteDialog
          propertyTitle={pendingDelete.title}
          pending={deleteMutation.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </section>
  );
}

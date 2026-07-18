/**
 * EditImageManager — manages property images during edit mode.
 *
 * Displays existing server images alongside new uploads, with controls
 * to add, remove, and reorder. Emits the delta so the parent page can
 * apply changes via the backend media endpoints on submit.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from './ui/button';
import { DEFAULT_IMAGE_MAX_BYTES } from './image-uploader';
import type { PropertyMedia } from '../types/property';

export const MAX_IMAGES = 10;

type EditImageManagerProps = {
  existingImages: PropertyMedia[];
  onExistingImagesChange: (images: PropertyMedia[]) => void;
  newFiles: File[];
  onNewFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxFileBytes?: number;
};

type ImageItem =
  { kind: 'existing'; media: PropertyMedia } | { kind: 'new'; file: File; index: number };

function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`;
}

export function EditImageManager({
  existingImages,
  onExistingImagesChange,
  newFiles,
  onNewFilesChange,
  maxFiles = MAX_IMAGES,
  maxFileBytes = DEFAULT_IMAGE_MAX_BYTES,
}: EditImageManagerProps) {
  const { t } = useTranslation();
  const [warning, setWarning] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImageItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalCount = existingImages.length + newFiles.length;
  const canAddMore = totalCount < maxFiles;

  // Build unified list for display
  const items: ImageItem[] = useMemo(() => {
    const result: ImageItem[] = existingImages.map((media) => ({
      kind: 'existing' as const,
      media,
    }));
    newFiles.forEach((file, i) => {
      result.push({ kind: 'new' as const, file, index: i });
    });
    return result;
  }, [existingImages, newFiles]);

  // Object URLs for new files
  const newFileUrls = useMemo(() => newFiles.map((file) => URL.createObjectURL(file)), [newFiles]);

  useEffect(() => {
    return () => {
      for (const url of newFileUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [newFileUrls]);

  const handleSelect = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const incoming = Array.from(selected);
    const accepted: File[] = [];
    const rejected: File[] = [];
    for (const file of incoming) {
      if (file.size > maxFileBytes) {
        rejected.push(file);
      } else {
        accepted.push(file);
      }
    }

    const limit = formatMegabytes(maxFileBytes);
    let nextWarning: string | null = null;
    if (rejected.length > 0) {
      const names = rejected.map((f) => f.name).join(', ');
      nextWarning = `${names} ${t('editImage.exceedsLimit', { limit })}`;
    }

    if (accepted.length === 0) {
      setWarning(nextWarning);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const combined = [...newFiles, ...accepted];
    if (combined.length > maxFiles) {
      const overflow = t('editImage.maxReached', { max: maxFiles });
      setWarning(nextWarning ? `${nextWarning} ${overflow}` : overflow);
      onNewFilesChange(combined.slice(0, maxFiles));
    } else {
      setWarning(nextWarning);
      onNewFilesChange(combined);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'existing') {
      onExistingImagesChange(existingImages.filter((img) => img.id !== deleteTarget.media.id));
    } else {
      const next = newFiles.slice();
      next.splice(deleteTarget.index, 1);
      onNewFilesChange(next);
    }
    setDeleteTarget(null);
    setWarning(null);
  };

  const moveUp = (targetIndex: number) => {
    if (targetIndex === 0) return;
    moveItem(targetIndex, targetIndex - 1);
  };

  const moveDown = (targetIndex: number) => {
    if (targetIndex >= items.length - 1) return;
    moveItem(targetIndex, targetIndex + 1);
  };

  const moveItem = (from: number, to: number) => {
    // Rebuild the unified list after the move, then split back
    const reordered = items.slice();
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const newExisting: PropertyMedia[] = [];
    const newNewFiles: File[] = [];
    for (const item of reordered) {
      if (item.kind === 'existing') {
        newExisting.push(item.media);
      } else {
        newNewFiles.push(item.file);
      }
    }
    onExistingImagesChange(newExisting);
    onNewFilesChange(newNewFiles);
  };

  const getThumbUrl = (media: PropertyMedia) => media.thumbnailUrl || media.url;

  return (
    <div className="space-y-3">
      {/* Image count */}
      <p className="text-sm text-stone-500">
        {t('editImage.imageCount', { current: totalCount, max: maxFiles })}
      </p>

      {/* Upload area */}
      {canAddMore && (
        <label
          htmlFor="edit-image-input"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-white px-4 py-8 text-center cursor-pointer hover:border-terracotta-400 transition-colors min-h-[44px]"
        >
          <ImagePlus size={28} className="text-terracotta-500" aria-hidden="true" />
          <span className="font-semibold text-stone-900">{t('editImage.dropOrTap')}</span>
          <span className="text-xs text-stone-500">
            {t('editImage.limit', { count: maxFiles - totalCount })}
          </span>
          <input
            id="edit-image-input"
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            aria-label={t('editImage.uploadAria')}
            onChange={(e) => handleSelect(e.target.files)}
          />
        </label>
      )}

      {warning && (
        <p role="alert" className="text-sm text-red-600 font-medium">
          {warning}
        </p>
      )}

      {/* Image grid */}
      {items.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item, index) => {
            const src =
              item.kind === 'existing'
                ? getThumbUrl(item.media)
                : newFileUrls[newFiles.indexOf(item.file)];
            const label =
              item.kind === 'existing'
                ? item.media.altText || t('editImage.existingImage')
                : item.file.name;

            return (
              <li
                key={item.kind === 'existing' ? item.media.id : `new-${item.index}`}
                className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 aspect-square"
              >
                <img src={src} alt={label} className="h-full w-full object-cover" />
                {item.kind === 'new' && (
                  <span className="absolute top-1.5 start-1.5 text-[10px] font-semibold bg-terracotta-500 text-white px-1.5 py-0.5 rounded-full">
                    {t('editImage.newBadge')}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <div className="flex gap-1">
                    {index > 0 && (
                      <button
                        type="button"
                        aria-label={t('editImage.moveUp', { name: label })}
                        onClick={() => moveUp(index)}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 text-stone-900 hover:bg-white"
                      >
                        <ArrowUp size={14} />
                      </button>
                    )}
                    {index < items.length - 1 && (
                      <button
                        type="button"
                        aria-label={t('editImage.moveDown', { name: label })}
                        onClick={() => moveDown(index)}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 text-stone-900 hover:bg-white"
                      >
                        <ArrowDown size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={t('editImage.delete', { name: label })}
                    onClick={() => setDeleteTarget(item)}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 text-red-600 hover:bg-white"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Delete confirmation */}
      {deleteTarget !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-image-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-4 animate-fade-in"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[var(--shadow-card-hover)] border border-stone-200/60 animate-scale-in">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
              <Trash2 size={22} className="text-red-500" strokeWidth={1.5} />
            </div>
            <h3
              id="delete-image-dialog-title"
              className="text-center font-display text-lg text-stone-950 leading-snug"
            >
              {t('editImage.deleteTitle')}
            </h3>
            <p className="mt-2 text-center text-sm text-stone-500 leading-relaxed px-2">
              {t('editImage.deleteDesc')}
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setDeleteTarget(null)}
              >
                {t('editImage.cancel')}
              </Button>
              <Button variant="danger" size="md" className="flex-1" onClick={confirmDelete}>
                {t('editImage.confirmDelete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ImageUploader — drag/tap-to-select image uploader with previews (T-028).
 *
 * Controlled component: receives the current list of `File` objects and
 * emits a new array through `onChange` whenever the selection mutates
 * (add, remove, or reorder). Object URLs are created per render and
 * revoked on unmount to avoid memory leaks. A max of `maxFiles` (default
 * 10) is enforced — extra files are dropped and a warning is shown.
 *
 * T-032: files larger than `maxFileBytes` (default 5MB) are rejected
 * before reaching the preview list, matching the API's server-side cap
 * (PRD §8.2). The user sees an inline error instead of uploading and
 * failing after the network round-trip.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

/** Default per-image byte cap, mirroring the API's `IMAGE_MAX_BYTES`. */
export const DEFAULT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type ImageUploaderProps = {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxFileBytes?: number;
};

function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`;
}

export function ImageUploader({
  files,
  onChange,
  maxFiles = 10,
  maxFileBytes = DEFAULT_IMAGE_MAX_BYTES,
}: ImageUploaderProps) {
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Map each file to a stable object URL for the current render pass.
  // When a file is removed its URL is revoked in the effect below.
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const { url } of previews) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previews]);

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
      nextWarning = `${names} exceeds the ${limit} per-image limit and was skipped.`;
    }

    if (accepted.length === 0) {
      setWarning(nextWarning);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const combined = [...files, ...accepted];
    if (combined.length > maxFiles) {
      const overflow = `You can upload a max of ${maxFiles} images.`;
      setWarning(nextWarning ? `${nextWarning} ${overflow}` : overflow);
      onChange(combined.slice(0, maxFiles));
    } else {
      setWarning(nextWarning);
      onChange(combined);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    const next = files.slice();
    next.splice(index, 1);
    onChange(next);
    setWarning(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = files.slice();
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index >= files.length - 1) return;
    const next = files.slice();
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor="image-uploader-input"
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-white px-4 py-8 text-center cursor-pointer hover:border-terracotta-400 transition-colors min-h-[44px]"
      >
        <ImagePlus size={28} className="text-terracotta-500" aria-hidden="true" />
        <span className="font-semibold text-stone-900">Drop photos or tap to choose</span>
        <span className="text-xs text-stone-500">
          Up to {maxFiles} images · JPG, PNG, or WebP · {formatMegabytes(maxFileBytes)} max each
        </span>
        <input
          id="image-uploader-input"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="sr-only"
          aria-label="Upload images"
          onChange={(e) => handleSelect(e.target.files)}
        />
      </label>

      {warning && (
        <p role="alert" className="text-sm text-red-600 font-medium">
          {warning}
        </p>
      )}

      {previews.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {previews.map(({ file, url }, index) => (
            <li
              key={`${file.name}-${index}`}
              className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 aspect-square"
            >
              <img src={url} alt={file.name} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                <div className="flex gap-1">
                  {index > 0 && (
                    <button
                      type="button"
                      aria-label={`Move up ${file.name}`}
                      onClick={() => moveUp(index)}
                      className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 text-stone-900 hover:bg-white"
                    >
                      <ArrowUp size={14} />
                    </button>
                  )}
                  {index < files.length - 1 && (
                    <button
                      type="button"
                      aria-label={`Move down ${file.name}`}
                      onClick={() => moveDown(index)}
                      className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 text-stone-900 hover:bg-white"
                    >
                      <ArrowDown size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove image ${file.name}`}
                  onClick={() => removeAt(index)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 text-red-600 hover:bg-white"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

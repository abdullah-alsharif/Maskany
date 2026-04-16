/**
 * ResponsiveImage — lazy-loading responsive image component (T-024, PRD §8.1).
 *
 * Renders a `<picture>` with a WebP source preferred over an optional fallback
 * raster (`fallbackSrc`) and an inner `<img>` carrying the responsive
 * `srcSet` + `sizes` attributes. Defaults to `loading="lazy"` so images below
 * the fold do not block the initial paint; pass `priority` for hero/above-fold
 * imagery.
 *
 * Cards pass the small thumbnail as `src` and the full-resolution image as
 * `fullSrc` so smaller viewports download the lighter asset while larger
 * viewports upgrade to the higher-resolution variant via `srcSet`.
 */
type ResponsiveImageProps = {
  /** Primary (small/thumbnail) image URL. Used as the default `src`. */
  src: string;
  /** Optional larger image URL — included in `srcSet` for wider viewports. */
  fullSrc?: string;
  /**
   * Optional non-WebP fallback (e.g. JPEG) for browsers that lack WebP. When
   * present the component renders a `<picture>` with a `type="image/webp"`
   * `<source>` and the fallback as the inner `<img src>`.
   */
  fallbackSrc?: string;
  alt: string;
  /** When true, loads eagerly with synchronous decoding (above-the-fold). */
  priority?: boolean;
  width?: number;
  height?: number;
  className?: string;
};

const DEFAULT_SIZES = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

function buildSrcSet(src: string, fullSrc: string | undefined): string {
  if (!fullSrc || fullSrc === src) {
    return `${src} 1x`;
  }
  // Thumbnail at the small descriptor, full image at the wide descriptor.
  return `${src} 400w, ${fullSrc} 1200w`;
}

export function ResponsiveImage({
  src,
  fullSrc,
  fallbackSrc,
  alt,
  priority = false,
  width,
  height,
  className,
}: ResponsiveImageProps) {
  const srcSet = buildSrcSet(src, fullSrc);
  const loading = priority ? 'eager' : 'lazy';
  const decoding = priority ? 'sync' : 'async';

  const img = (
    <img
      src={fallbackSrc ?? src}
      srcSet={srcSet}
      sizes={DEFAULT_SIZES}
      alt={alt}
      loading={loading}
      decoding={decoding}
      width={width}
      height={height}
      className={className}
    />
  );

  if (!fallbackSrc) {
    return img;
  }

  return (
    <picture>
      <source type="image/webp" srcSet={srcSet} sizes={DEFAULT_SIZES} />
      {img}
    </picture>
  );
}

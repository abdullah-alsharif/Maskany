'use client';

import { useState, useCallback } from 'react';

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
  className = '',
}: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const srcSet = buildSrcSet(src, fullSrc);
  const loading = priority ? 'eager' : 'lazy';
  const decoding = priority ? 'sync' : 'async';
  const onLoad = useCallback(() => setLoaded(true), []);

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
      onLoad={onLoad}
      className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
    />
  );

  const content = !fallbackSrc ? (
    img
  ) : (
    <picture>
      <source type="image/webp" srcSet={srcSet} sizes={DEFAULT_SIZES} />
      {img}
    </picture>
  );

  return (
    <div className="relative overflow-hidden">
      {/* Blur-up placeholder: show thumbnail blurred until full image loads */}
      {!loaded && src && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
        />
      )}
      {content}
    </div>
  );
}

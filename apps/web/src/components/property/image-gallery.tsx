import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Grid3X3 } from 'lucide-react';
import type { PropertyImage } from '../../types/property';

type ImageGalleryProps = {
  images: PropertyImage[];
  alt: string;
};

function Img({
  src,
  alt,
  className,
  loading,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 bg-stone-200 animate-pulse" />}
      <img
        src={src}
        alt={alt}
        className={`${className ?? ''} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading={loading}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, images.length - 1)));
    },
    [images.length],
  );

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  const openFullscreen = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsFullscreen(true);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      } else if (event.key === 'ArrowRight') {
        goNext();
      } else if (event.key === 'ArrowLeft') {
        goPrev();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, goNext, goPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    const threshold = 50;
    if (touchDeltaX.current < -threshold) goNext();
    else if (touchDeltaX.current > threshold) goPrev();
  };

  if (images.length === 0) {
    return (
      <div className="aspect-[16/10] bg-stone-200 flex items-center justify-center rounded-2xl">
        <span className="text-stone-400 text-sm">No images</span>
      </div>
    );
  }

  const slideTrack = (inFullscreen: boolean) => (
    <div
      className="flex h-full transition-transform duration-300"
      style={{
        transform: `translateX(-${currentIndex * 100}%)`,
        transitionTimingFunction: 'var(--ease-out-expo)',
      }}
    >
      {images.map((image, i) => (
        <div key={image.id} className="w-full h-full shrink-0 relative">
          <Img
            src={image.url}
            alt={image.altText || `${alt} - Photo ${i + 1}`}
            className={`w-full h-full ${inFullscreen ? 'object-contain' : 'object-cover'}`}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        </div>
      ))}
    </div>
  );

  const arrows = (
    <>
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="
            hidden md:flex
            absolute left-3 top-1/2 -translate-y-1/2
            w-9 h-9 items-center justify-center rounded-full
            bg-white/90 text-stone-700
            shadow-md hover:bg-white
            active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-stone-800
            transition-all duration-150
          "
          aria-label="Previous image"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="
            hidden md:flex
            absolute right-3 top-1/2 -translate-y-1/2
            w-9 h-9 items-center justify-center rounded-full
            bg-white/90 text-stone-700
            shadow-md hover:bg-white
            active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-stone-800
            transition-all duration-150
          "
          aria-label="Next image"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </>
  );

  const dots =
    images.length > 1 ? (
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              goTo(i);
            }}
            className={`
            rounded-full transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/20
            ${
              i === currentIndex
                ? 'w-6 h-1.5 bg-white'
                : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/70 active:scale-90'
            }
          `}
            aria-label={`Go to image ${i + 1}`}
            aria-current={i === currentIndex ? 'true' : undefined}
          />
        ))}
      </div>
    ) : null;

  const counter = (
    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium pointer-events-none select-none">
      {currentIndex + 1} / {images.length}
    </div>
  );

  /* Mobile — swipeable slide track with tap-to-fullscreen */
  const mobileView = (
    <div
      className="md:hidden relative overflow-hidden select-none aspect-[16/10]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {slideTrack(false)}
      {dots}
      {counter}
      <button
        onClick={() => openFullscreen(currentIndex)}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50"
        aria-label="Open fullscreen gallery"
      />
    </div>
  );

  /* Desktop — hero collage */
  const desktopGrid =
    images.length === 1 ? (
      <div className="hidden md:block md:px-4">
        <button
          onClick={() => openFullscreen(0)}
          className="w-full block rounded-2xl overflow-hidden relative bg-stone-200 group cursor-pointer"
        >
          <Img
            src={images[0].url}
            alt={images[0].altText || `${alt} - Photo 1`}
            className="w-full h-[50dvh] max-h-[420px] object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="eager"
          />
        </button>
      </div>
    ) : (
      <div className="hidden md:block md:px-4">
        <div className="grid grid-cols-[2fr_1fr] grid-rows-1 gap-2 rounded-2xl overflow-hidden h-[50dvh] max-h-[420px]">
          <button
            onClick={() => openFullscreen(0)}
            className="relative overflow-hidden group cursor-pointer bg-stone-200"
          >
            <Img
              src={images[0].url}
              alt={images[0].altText || `${alt} - Photo 1`}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              loading="eager"
            />
          </button>
          <div className="flex flex-col gap-2">
            {images.slice(1, Math.min(images.length, 3)).map((image, i) => {
              const imageIndex = i + 1;
              const isLastShown = i === 1;
              const remaining = images.length - 3;
              return (
                <button
                  key={image.id}
                  onClick={() => openFullscreen(imageIndex)}
                  className="relative overflow-hidden group cursor-pointer flex-1 bg-stone-200"
                >
                  <Img
                    src={image.url}
                    alt={image.altText || `${alt} - Photo ${imageIndex + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  {isLastShown && remaining > 0 && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold tracking-tight drop-shadow-sm">
                        +{remaining}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );

  /* Desktop CTA row — "Show all photos" */
  const desktopCta = images.length > 1 && (
    <div className="hidden md:flex md:px-4 mt-2">
      <button
        onClick={() => openFullscreen(0)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 text-sm font-medium hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97] transition-all duration-150 shadow-sm"
      >
        <Grid3X3 size={16} strokeWidth={1.8} />
        Show all {images.length} photos
      </button>
    </div>
  );

  /* Fullscreen overlay — shared between mobile and desktop */
  const fullscreenView = isFullscreen ? (
    <div
      className="fixed inset-0 z-[var(--z-modal)] bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative w-full h-full">
        {slideTrack(true)}
        {arrows}
        {dots}
        {counter}
        <button
          onClick={() => setIsFullscreen(false)}
          className="
            absolute top-4 right-4
            w-10 h-10 rounded-full
            bg-white/10 backdrop-blur-md text-white
            flex items-center justify-center
            hover:bg-white/20
            active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
            transition-all duration-150
          "
          aria-label="Close fullscreen"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {!isFullscreen && mobileView}
      {desktopGrid}
      {desktopCta}
      {fullscreenView}
    </>
  );
}

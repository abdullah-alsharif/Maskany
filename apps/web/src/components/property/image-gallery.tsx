import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PropertyImage } from '../../types/property';

type ImageGalleryProps = {
  images: PropertyImage[];
  alt: string;
};

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

  // Keyboard support for fullscreen: Escape closes, Left/Right arrows navigate
  // (T-031). Listener is only attached while fullscreen is active so it cannot
  // steal focus or interfere with other on-page controls.
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
      <div className="aspect-[16/10] bg-stone-200 flex items-center justify-center">
        <span className="text-stone-400 text-sm">No images</span>
      </div>
    );
  }

  const galleryContent = (
    <div
      className={`
        relative overflow-hidden select-none
        ${isFullscreen ? 'fixed inset-0 z-[var(--z-modal)] bg-black' : 'aspect-[16/10]'}
      `}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Images track */}
      <div
        className="flex h-full transition-transform duration-300"
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
          transitionTimingFunction: 'var(--ease-out-expo)',
        }}
      >
        {images.map((image, i) => (
          <div key={image.id} className="w-full h-full shrink-0">
            <img
              src={isFullscreen ? image.url : image.url}
              alt={image.altText || `${alt} - Photo ${i + 1}`}
              className={`
                w-full h-full
                ${isFullscreen ? 'object-contain' : 'object-cover'}
              `}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          </div>
        ))}
      </div>

      {/* Desktop arrows */}
      {images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="
                hidden md:flex
                absolute left-3 top-1/2 -translate-y-1/2
                w-9 h-9 items-center justify-center rounded-full
                bg-white/90 text-stone-700
                shadow-md hover:bg-white
                transition-all duration-150
              "
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              onClick={goNext}
              className="
                hidden md:flex
                absolute right-3 top-1/2 -translate-y-1/2
                w-9 h-9 items-center justify-center rounded-full
                bg-white/90 text-stone-700
                shadow-md hover:bg-white
                transition-all duration-150
              "
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`
                rounded-full transition-all duration-200
                ${
                  i === currentIndex
                    ? 'w-6 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/70'
                }
              `}
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === currentIndex ? 'true' : undefined}
            />
          ))}
        </div>
      )}

      {/* Photo counter */}
      <div
        className="
          absolute top-3 right-3
          px-2.5 py-1 rounded-full
          bg-black/40 backdrop-blur-sm
          text-white text-xs font-medium
        "
      >
        {currentIndex + 1} / {images.length}
      </div>

      {/* Tap to fullscreen / close */}
      {isFullscreen ? (
        <button
          onClick={() => setIsFullscreen(false)}
          className="
            absolute top-4 right-4
            w-10 h-10 rounded-full
            bg-white/10 backdrop-blur-md text-white
            flex items-center justify-center
            hover:bg-white/20
            transition-colors duration-150
          "
          aria-label="Close fullscreen"
        >
          <X size={20} />
        </button>
      ) : (
        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute inset-0 md:hidden"
          aria-label="Open fullscreen gallery"
        >
          <span className="sr-only">View fullscreen</span>
        </button>
      )}
    </div>
  );

  return galleryContent;
}

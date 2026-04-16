import { useRef, useEffect, type ReactNode } from 'react';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragDelta = useRef(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragDelta.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    dragDelta.current = e.touches[0].clientY - dragStartY.current;
    if (sheetRef.current && dragDelta.current > 0) {
      sheetRef.current.style.transform = `translateY(${dragDelta.current}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (dragDelta.current > 100) {
      onClose();
    }
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-sheet)]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="
          absolute bottom-0 inset-x-0
          max-h-[85vh]
          bg-white rounded-t-2xl
          shadow-[var(--shadow-sheet)]
          animate-sheet-up
          flex flex-col
          pb-safe
        "
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-5 pb-3 border-b border-stone-100 shrink-0">
            <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

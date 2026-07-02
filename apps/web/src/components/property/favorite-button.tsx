import { Heart } from 'lucide-react';

type FavoriteButtonProps = {
  propertyId: string;
  isFavorite: boolean;
  onToggle?: (id: string) => void;
  /** Large variant for detail page */
  size?: 'sm' | 'md';
};

export function FavoriteButton({
  propertyId,
  isFavorite,
  onToggle,
  size = 'sm',
}: FavoriteButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle?.(propertyId);
  };

  const sizeClasses = size === 'sm' ? 'w-11 h-11' : 'w-12 h-12';
  const iconSize = size === 'sm' ? 18 : 22;

  return (
    <button
      onClick={handleClick}
      className={`
        ${sizeClasses}
        flex items-center justify-center rounded-full
        bg-white/90 backdrop-blur-sm
        shadow-sm hover:shadow-md
        transition-colors transition-shadow duration-200
        active:scale-90
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400
        ${isFavorite ? 'text-red-500' : 'text-stone-600 hover:text-red-400'}
      `}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFavorite}
    >
      <Heart
        size={iconSize}
        strokeWidth={2}
        fill={isFavorite ? 'currentColor' : 'none'}
        className={isFavorite ? 'animate-heart-pop' : ''}
      />
    </button>
  );
}

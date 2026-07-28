/**
 * Maskany Design Tokens — "Sunlit Stone" theme
 *
 * Centralized token reference for components that need
 * programmatic access to design values (e.g., charts,
 * canvas rendering, dynamic styles).
 *
 * CSS custom properties (in index.css) are the source of truth.
 * These TypeScript values mirror them for JS-side usage.
 */

export const colors = {
  terracotta: {
    50: '#fef7f4',
    100: '#fdeee8',
    200: '#fad5c7',
    300: '#f5b49b',
    400: '#ee8b65',
    500: '#e2683d',
    600: '#c9502a',
    700: '#a73f22',
    800: '#893520',
    900: '#712f1f',
  },
  stone: {
    50: '#faf9f7',
    100: '#f3f1ed',
    200: '#e8e4dd',
    300: '#d5cfc4',
    400: '#b8b0a0',
    500: '#9f9583',
    600: '#887c6c',
    700: '#72675a',
    800: '#5f564c',
    900: '#4a433b',
    950: '#2b2621',
  },
  olive: {
    50: '#f6f7f0',
    100: '#eaeddb',
    200: '#d6dbb9',
    300: '#bcc490',
    400: '#a1ab6a',
    500: '#84904d',
    600: '#67723b',
    700: '#505830',
    800: '#41472a',
    900: '#383d27',
  },
  sand: {
    50: '#fdfcfa',
    100: '#faf8f3',
    200: '#f4f0e6',
    300: '#ebe4d4',
    400: '#ddd2ba',
    500: '#c9b998',
  },
  amber: {
    400: '#f5b731',
    500: '#e5a320',
  },
  whatsapp: {
    DEFAULT: '#25d366',
    dark: '#128c7e',
  },
  error: '#d93025',
  success: '#0d7c3f',
  info: '#1a73e8',
} as const;

export const typography = {
  fontFamily: {
    display: "'Plus Jakarta Sans', 'Noto Naskh Arabic', 'Tajawal', system-ui, sans-serif",
    sans: "'Plus Jakarta Sans', 'Noto Naskh Arabic', 'Tajawal', system-ui, sans-serif",
  },
  /** Mobile-first type scale (px) */
  scale: {
    xs: { size: 12, lineHeight: 16, weight: 400 },
    sm: { size: 13, lineHeight: 18, weight: 400 },
    base: { size: 15, lineHeight: 22, weight: 400 },
    md: { size: 16, lineHeight: 24, weight: 500 },
    lg: { size: 18, lineHeight: 26, weight: 600 },
    xl: { size: 22, lineHeight: 28, weight: 700 },
    '2xl': { size: 26, lineHeight: 32, weight: 700 },
    '3xl': { size: 32, lineHeight: 38, weight: 700 },
    display: { size: 36, lineHeight: 42, weight: 400 }, // Plus Jakarta Sans
  },
} as const;

export const spacing = {
  /** 4px grid — reference values */
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

export const radii = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  full: '9999px',
} as const;

/** Property type visual config */
export const propertyTypeConfig = {
  APARTMENT: {
    label: 'Apartment',
    icon: 'Building2',
    color: 'bg-terracotta-100 text-terracotta-700',
  },
  ROOM: { label: 'Room', icon: 'DoorOpen', color: 'bg-olive-100 text-olive-700' },
  CHALET: { label: 'Chalet', icon: 'TreePine', color: 'bg-olive-100 text-olive-700' },
  VILLA: { label: 'Villa', icon: 'Castle', color: 'bg-terracotta-100 text-terracotta-700' },
  HOUSE: { label: 'House', icon: 'Home', color: 'bg-sand-300 text-stone-700' },
  STUDIO: { label: 'Studio', icon: 'LayoutGrid', color: 'bg-stone-200 text-stone-700' },
  PENTHOUSE: {
    label: 'Penthouse',
    icon: 'Building',
    color: 'bg-terracotta-100 text-terracotta-700',
  },
  DUPLEX: { label: 'Duplex', icon: 'Layers', color: 'bg-sand-300 text-stone-700' },
  OTHER: { label: 'Other', icon: 'MapPin', color: 'bg-stone-200 text-stone-600' },
} as const;

/** Amenity icon mapping */
export const amenityConfig: Record<string, { label: string; icon: string }> = {
  wifi: { label: 'Wi-Fi', icon: 'Wifi' },
  parking: { label: 'Parking', icon: 'Car' },
  pool: { label: 'Pool', icon: 'Waves' },
  gym: { label: 'Gym', icon: 'Dumbbell' },
  ac: { label: 'A/C', icon: 'AirVent' },
  furnished: { label: 'Furnished', icon: 'Sofa' },
  kitchen: { label: 'Kitchen', icon: 'CookingPot' },
  balcony: { label: 'Balcony', icon: 'Fence' },
  security: { label: 'Security', icon: 'ShieldCheck' },
  elevator: { label: 'Elevator', icon: 'ArrowUpDown' },
  garden: { label: 'Garden', icon: 'Flower2' },
  laundry: { label: 'Laundry', icon: 'WashingMachine' },
};

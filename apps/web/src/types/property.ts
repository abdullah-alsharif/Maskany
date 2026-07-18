export type PropertyType =
  'APARTMENT' | 'ROOM' | 'CHALET' | 'VILLA' | 'HOUSE' | 'STUDIO' | 'PENTHOUSE' | 'DUPLEX' | 'OTHER';

export type PriceUnit = 'per_night' | 'per_month' | 'per_year' | 'total';

export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

export type MediaType = 'IMAGE' | 'VIDEO';

export type PropertyMedia = {
  id: string;
  mediaType: MediaType;
  url: string;
  thumbnailUrl: string;
  altText: string;
  mimeType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sortOrder: number;
};

/** @deprecated Use PropertyMedia instead */
export type PropertyImage = PropertyMedia;

export type PropertyOwner = {
  id: string;
  fullName: string;
  createdAt: string;
};

/**
 * Property shape returned by the backend listing/detail endpoints.
 *
 * Fields match the flat JSON wire format produced by
 * `apps/api/src/services/property-service.ts` (see `toSummary` /
 * `toDetail`). In particular, location is NOT nested — `city`, `area`
 * (district), `country`, `lat`, `lng` sit directly on the property —
 * and the square-meter size is `areaSqm` (separate from the string
 * district `area`). `media` and `images` are optional because the list
 * endpoint returns summaries without the media array.
 */
export type PropertyTranslation = {
  title: string;
  summary: string | null;
  description: string | null;
  city: string;
  area: string | null;
  country: string;
  amenities: string[];
};

export type CoverImage = {
  url: string;
  thumbnailUrl: string | null;
  altText: string | null;
};

export type Property = {
  id: string;
  title: string;
  summary: string;
  description: string;
  propertyType: PropertyType;
  city: string;
  area: string | null;
  country: string;
  lat?: number | null;
  lng?: number | null;
  price: number;
  currency: string;
  priceUnit: PriceUnit;
  rooms: number;
  bathrooms: number;
  areaSqm: number | null;
  amenities: string[];
  coverImage: CoverImage | null;
  media?: PropertyMedia[];
  /** Convenience getter — images only (video media is excluded). */
  images?: PropertyMedia[];
  locale: 'en' | 'ar';
  whatsappNumber: string;
  ownerId: string;
  owner?: PropertyOwner;
  translation?: PropertyTranslation | null;
  status: PropertyStatus;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PropertyListResponse = {
  properties: Property[];
  nextCursor: string | null;
  total: number;
};

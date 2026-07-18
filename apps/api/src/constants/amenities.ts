export const KNOWN_AMENITIES = [
  'wifi',
  'parking',
  'pool',
  'gym',
  'ac',
  'furnished',
  'kitchen',
  'elevator',
  'security',
  'balcony',
  'garden',
  'maid',
  'generator',
  'central_ac',
  'smart_lock',
  'pet_friendly',
] as const;

export type KnownAmenity = (typeof KNOWN_AMENITIES)[number];

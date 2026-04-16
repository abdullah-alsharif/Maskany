/**
 * Country dialing codes exposed to the auth forms (T-026).
 *
 * Kept intentionally small — the app targets the Middle East primarily; a
 * longer list would bury the common options and regress the UX for the 95%
 * case. Ordered with the default (Saudi Arabia) first.
 */
export interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRY_CODES: readonly CountryCode[] = [
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: '+962', name: 'Jordan', flag: '🇯🇴' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
];

export const DEFAULT_COUNTRY_CODE = COUNTRY_CODES[0].code;

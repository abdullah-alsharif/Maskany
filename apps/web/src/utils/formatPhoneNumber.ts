export function formatPhoneNumber(raw: string, countryCode: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits || !countryCode) return '';
  if (raw.startsWith('+')) {
    return `+${digits}`;
  }
  const countryDigits = countryCode.replace(/\D/g, '');
  return digits.startsWith(countryDigits)
    ? `${countryCode}${digits.slice(countryDigits.length)}`
    : `${countryCode}${digits}`;
}

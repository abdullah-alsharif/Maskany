export function formatPrice(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatMemberSince(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale ?? 'en-US', { month: 'long', year: 'numeric' });
}

/**
 * Generate a WhatsApp deep link with pre-filled message.
 *
 * @returns WhatsApp URL or null if number is invalid
 */
export function generateWhatsAppLink(
  whatsappNumber: string,
  propertyTitle: string,
  propertyUrl: string,
  locale?: string,
): string | null {
  const cleanedNumber = whatsappNumber.replace(/[\s\-+]/g, '');

  if (!/^[1-9]\d{6,14}$/.test(cleanedNumber)) {
    return null;
  }

  const isArabic = typeof locale === 'string' && locale.startsWith('ar');
  const message = isArabic
    ? `مرحباً! وجدت هذا الإعلان على مسكني وأريد الاستفسار عنه:\n\n"${propertyTitle}"\n${propertyUrl}\n\nهل لا يزال متاحاً؟`
    : `Hey! I came across this listing on Maskany and wanted to ask about:\n\n"${propertyTitle}"\n${propertyUrl}\n\nIs it still available?`;

  return `https://wa.me/${cleanedNumber}?text=${encodeURIComponent(message)}`;
}

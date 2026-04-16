/**
 * Generate a WhatsApp deep link with pre-filled message.
 *
 * @returns WhatsApp URL or null if number is invalid
 */
export function generateWhatsAppLink(
  whatsappNumber: string,
  propertyTitle: string,
  propertyId: string,
): string | null {
  const cleanedNumber = whatsappNumber.replace(/[\s\-+]/g, '');

  if (!/^[1-9]\d{6,14}$/.test(cleanedNumber)) {
    return null;
  }

  const message = `Hi, I'm interested in your property listing: "${propertyTitle}" (Ref: ${propertyId}).\nListed on Maskany.`;

  return `https://wa.me/${cleanedNumber}?text=${encodeURIComponent(message)}`;
}

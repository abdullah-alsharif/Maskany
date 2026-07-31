const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneGenericPattern = /(\+?[\d\-()\s]{7,20})/g;
const saudiPhonePattern = /(?:\b05|\b5|009665|9665)\d{8}\b/g;
const uaePhonePattern = /(?:\b05|\b5|009715|9715)\d{7}\b/g;
const emiratesIdPattern = /784-\d{4}-\d{7}-\d{1}/g;
const saudiIqamaPattern = /\b\d{10}\b/g;
const ibanPattern = /\bSA\d{22}\b|\bAE\d{21}\b/g;
const urlPattern = /https?:\/\/[^\s<>"']+/g;

export function scrubPii(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(emailPattern, '[EMAIL REMOVED]');
  cleaned = cleaned.replace(saudiPhonePattern, '[PHONE REMOVED]');
  cleaned = cleaned.replace(uaePhonePattern, '[PHONE REMOVED]');
  cleaned = cleaned.replace(phoneGenericPattern, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 ? '[PHONE REMOVED]' : match;
  });
  cleaned = cleaned.replace(emiratesIdPattern, '[ID REMOVED]');
  cleaned = cleaned.replace(saudiIqamaPattern, '[ID REMOVED]');
  cleaned = cleaned.replace(ibanPattern, '[IBAN REMOVED]');
  cleaned = cleaned.replace(urlPattern, '[URL REMOVED]');
  return cleaned;
}

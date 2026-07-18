const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneGenericPattern = /(\+?[\d\-()\s]{7,20})/g;
const saudiPhonePattern = /(?:05|5|009665|9665)\d{8}/g;
const uaePhonePattern = /(?:05|5|009715|9715)\d{7}/g;
const emiratesIdPattern = /784-\d{4}-\d{7}-\d{1}/g;
const saudiIqamaPattern = /\b\d{10}\b/g;
const ibanPattern = /SA\d{22}|AE\d{21}/g;

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
  return cleaned;
}

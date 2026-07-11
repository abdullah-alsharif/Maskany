/**
 * Lightweight backend i18n resolver for SMS and email OTP messages.
 *
 * Provides a `t(key, locale, vars?)` function that resolves a message key
 * against inline en/ar message maps. Falls back to English when the locale
 * is not recognized or the key is missing.
 *
 * Template syntax uses `{{key}}` placeholders (same as i18next).
 */

type Locale = 'en' | 'ar';

const messages: Record<Locale, Record<string, string>> = {
  en: {
    otp_sms: 'Your Maskany verification code is: {{code}}. Valid for 5 minutes.',
    otp_email_subject: 'Your Maskany Verification Code',
    otp_email_heading: 'Your verification code',
    otp_email_expiry: 'This code will expire in 5 minutes.',
    otp_email_security:
      "For your security, don't share this code with anyone. Maskany staff will never ask you for it.",
  },
  ar: {
    otp_sms: 'رمز التحقق الخاص بك في مسكني هو: {{code}}. صالح لمدة 5 دقائق.',
    otp_email_subject: 'رمز التحقق من مسكني',
    otp_email_heading: 'رمز التحقق الخاص بك',
    otp_email_expiry: 'سينتهي صلاحية هذا الرمز خلال 5 دقائق.',
    otp_email_security: 'لأمانك، لا تشارك هذا الرمز مع أي شخص. موظفو مسكني لن يطلبوه منك أبداً.',
  },
};

function isArabicLocale(locale: string | undefined): locale is 'ar' {
  return typeof locale === 'string' && locale.startsWith('ar');
}

/**
 * Resolve a message key for the given locale, applying optional variable
 * interpolation. Falls back to English if the locale is not Arabic or the
 * key does not exist.
 */
export function t(key: string, locale?: string, vars?: Record<string, string>): string {
  const target: Locale = isArabicLocale(locale) ? 'ar' : 'en';
  let msg = messages[target][key] ?? messages.en[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replaceAll(`{{${k}}}`, v);
    }
  }

  return msg;
}

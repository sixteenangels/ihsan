export const SUPPORT_EMAIL = 'support@ajynworld.com';
export const SUPPORT_PHONE_DISPLAY = '+233 508664788';
export const SUPPORT_PHONE_E164 = '+233508664788';
export const SUPPORT_WHATSAPP_NUMBER = '233508664788';

export function getSupportPhoneTelUrl() {
  return `tel:${SUPPORT_PHONE_E164}`;
}

export function getSupportWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;
  const trimmed = message?.trim();
  return trimmed ? `${base}?text=${encodeURIComponent(trimmed)}` : base;
}

export function resolveSupportPhone(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || SUPPORT_PHONE_DISPLAY;
}

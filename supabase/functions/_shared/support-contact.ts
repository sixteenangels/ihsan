export const SUPPORT_EMAIL = 'support@ajynworld.com';
export const SUPPORT_PHONE_DISPLAY = '+233 508664788';
export const SUPPORT_PHONE_E164 = '+233508664788';
export const SUPPORT_WHATSAPP_NUMBER = '233508664788';

export function getSupportWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;
  const trimmed = message?.trim();
  return trimmed ? `${base}?text=${encodeURIComponent(trimmed)}` : base;
}

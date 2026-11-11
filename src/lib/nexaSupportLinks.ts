// Public, JS-only support destinations. Compatible with Expo Updates OTA.
// Never append account IDs, emails, passwords, balances or KYC session URLs.
export const NEXA_TELEGRAM_SUPPORT_URL = 'https://t.me/NexaTheoBot';

export function nexaWhatsAppSupportUrl(topic: 'general' | 'kyc' = 'general'): string {
  const message = topic === 'kyc'
    ? 'Olá, Theo! Preciso de orientação para iniciar ou continuar minha verificação de identidade na Nexa.'
    : 'Olá, Theo! Preciso de ajuda para usar a Nexa.';
  return 'https://wa.me/551333289704?text=' + encodeURIComponent(message);
}

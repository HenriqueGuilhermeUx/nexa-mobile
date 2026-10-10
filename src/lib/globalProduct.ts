export type GlobalJurisdiction = {
  code: string;
  label: string;
  region: 'NORTH_AMERICA' | 'EUROPE' | 'LATAM';
  currency: string;
  documentHint: string;
};

export const GLOBAL_JURISDICTIONS: GlobalJurisdiction[] = [
  { code: 'US', label: 'United States', region: 'NORTH_AMERICA', currency: 'USD', documentHint: 'Passport or supported U.S. identity document' },
  { code: 'CA', label: 'Canada', region: 'NORTH_AMERICA', currency: 'CAD', documentHint: 'Passport or supported Canadian identity document' },
  { code: 'PT', label: 'Portugal', region: 'EUROPE', currency: 'EUR', documentHint: 'Passport or supported national identity document' },
  { code: 'ES', label: 'Spain', region: 'EUROPE', currency: 'EUR', documentHint: 'Passport or supported national identity document' },
  { code: 'FR', label: 'France', region: 'EUROPE', currency: 'EUR', documentHint: 'Passport or supported national identity document' },
  { code: 'DE', label: 'Germany', region: 'EUROPE', currency: 'EUR', documentHint: 'Passport or supported national identity document' },
  { code: 'IT', label: 'Italy', region: 'EUROPE', currency: 'EUR', documentHint: 'Passport or supported national identity document' },
  { code: 'NL', label: 'Netherlands', region: 'EUROPE', currency: 'EUR', documentHint: 'Passport or supported national identity document' },
  { code: 'IE', label: 'Ireland', region: 'EUROPE', currency: 'EUR', documentHint: 'Passport or supported national identity document' },
  { code: 'GB', label: 'United Kingdom', region: 'EUROPE', currency: 'GBP', documentHint: 'Passport or supported U.K. identity document' },
  { code: 'MX', label: 'México', region: 'LATAM', currency: 'MXN', documentHint: 'Pasaporte o documento local compatible' },
  { code: 'AR', label: 'Argentina', region: 'LATAM', currency: 'ARS', documentHint: 'Pasaporte o documento local compatible' },
  { code: 'CO', label: 'Colombia', region: 'LATAM', currency: 'COP', documentHint: 'Pasaporte o documento local compatible' },
  { code: 'CL', label: 'Chile', region: 'LATAM', currency: 'CLP', documentHint: 'Pasaporte o documento local compatible' },
  { code: 'PE', label: 'Perú', region: 'LATAM', currency: 'PEN', documentHint: 'Pasaporte o documento local compatible' },
  { code: 'UY', label: 'Uruguay', region: 'LATAM', currency: 'UYU', documentHint: 'Pasaporte o documento local compatible' },
];

export const NEXA_GLOBAL_PRODUCT = {
  name: 'Nexa Global',
  coreAsset: 'USDC',
  primaryAction: 'SEND_NEXA_USER',
  funding: {
    asset: 'USDC',
    methods: ['CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'EXTERNAL_WALLET'] as const,
    providerSelection: 'PRIVY_MELD',
  },
  utilities: {
    nexaUserTransfer: true,
    brazilPix: true,
    brazilBillPay: true,
    buyAssets: ['BTC', 'ETH', 'PAXG'] as const,
  },
  excludedAtLaunch: {
    localFiatBalance: true,
    localBankAccount: true,
    localCashDeposit: true,
  },
} as const;

export function globalJurisdiction(code: string) {
  const normalized = String(code || '').trim().toUpperCase();
  return GLOBAL_JURISDICTIONS.find((item) => item.code === normalized) || null;
}

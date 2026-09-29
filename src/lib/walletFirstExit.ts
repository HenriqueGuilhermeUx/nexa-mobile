import { Platform } from 'react-native';

import { config } from '@/config';

export interface WalletFirstExitQuote {
  label: string;
  asset: 'USDC' | string;
  settlementCurrency: 'BRL' | string;
  amountUsdc: number;
  nexaRateBrl: number;
  estimatedPayoutBrl: number;
  validForSeconds: number;
  expiresAt: string;
  indicative: boolean;
}

export async function getWalletFirstExitQuote(
  accessToken: string,
  amountUsdc: number,
): Promise<WalletFirstExitQuote> {
  const response = await fetch(
    `${config.apiUrl}/direct-settlement/wallet-first/usdc-pilot/exit/quote`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Nexa-App-Version': config.appVersion,
        'X-Nexa-App-Build': config.appBuild,
        'X-Nexa-Platform': Platform.OS,
      },
      body: JSON.stringify({ amountUsdc }),
    },
  );

  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const raw = payload?.message || payload?.error || payload?.code;
    throw new Error(
      Array.isArray(raw)
        ? raw.join(', ')
        : String(raw || 'Cotação Nexa indisponível no momento.'),
    );
  }

  if (!payload?.quote) {
    throw new Error('A Nexa não retornou uma cotação válida.');
  }
  return payload.quote as WalletFirstExitQuote;
}

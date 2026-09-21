import { Platform } from 'react-native';

import { config } from '@/config';

type Participant = Record<string, any>;

export type EfiOpenFinanceStatus = {
  provider?: string;
  product?: string;
  enabled?: boolean;
  environment?: string;
  configured?: boolean;
  destinationConfigured?: boolean;
  ledgerCreditEnabled?: boolean;
};

export type EfiOpenFinanceDeposit = {
  success?: boolean;
  provider?: string;
  paymentId: string;
  redirectURI?: string;
  amountBrl?: number;
  status?: string;
  credited?: boolean;
  ledgerCreditEnabled?: boolean;
};

function headers(accessToken: string) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Nexa-App-Version': config.appVersion,
    'X-Nexa-App-Build': config.appBuild,
    'X-Nexa-Platform': Platform.OS,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function request(path: string, accessToken: string, options: RequestInit = {}) {
  const response = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers: {
      ...headers(accessToken),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const raw = data?.message || data?.error || `Falha Open Finance (${response.status})`;
    throw new Error(Array.isArray(raw) ? raw.join(', ') : String(raw));
  }

  return data;
}

export const efiOpenFinanceApi = {
  status(accessToken: string) {
    return request('/open-finance/efi/status', accessToken) as Promise<EfiOpenFinanceStatus>;
  },

  async participants(accessToken: string, name?: string) {
    const suffix = name?.trim() ? `?name=${encodeURIComponent(name.trim())}` : '';
    const data = await request(`/open-finance/efi/participants${suffix}`, accessToken);
    return (Array.isArray(data?.participants) ? data.participants : []) as Participant[];
  },

  startDeposit(
    accessToken: string,
    input: { amountBrl: number; participantId: string },
  ) {
    return request('/open-finance/efi/deposit/start', accessToken, {
      method: 'POST',
      body: JSON.stringify(input),
    }) as Promise<EfiOpenFinanceDeposit>;
  },

  depositStatus(accessToken: string, paymentId: string) {
    return request(
      `/open-finance/efi/deposit/status?paymentId=${encodeURIComponent(paymentId)}`,
      accessToken,
    ) as Promise<EfiOpenFinanceDeposit>;
  },
};

export function participantIdOf(participant: Participant) {
  return String(
    participant?.idParticipante ||
      participant?.identificador ||
      participant?.participantId ||
      participant?.id ||
      '',
  ).trim();
}

export function participantNameOf(participant: Participant) {
  return String(
    participant?.nome ||
      participant?.nomeInstituicao ||
      participant?.name ||
      participant?.marca ||
      participantIdOf(participant),
  ).trim();
}

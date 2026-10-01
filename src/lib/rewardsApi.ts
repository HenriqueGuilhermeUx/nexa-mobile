import { config } from '@/config';

async function rewardsRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${config.apiUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Nexa-App-Version': config.appVersion,
      'X-Nexa-App-Build': config.appBuild,
    },
  });
  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    throw new Error(String(payload?.message || payload?.error || 'Rewards indisponível agora.'));
  }
  return payload as T;
}

export function getNexaRewardsVault(accessToken: string) {
  return rewardsRequest<any>('/rewards/v2/vault', accessToken);
}

export function getNexaRewardsPosition(accessToken: string) {
  return rewardsRequest<any>('/rewards/v2/position', accessToken);
}

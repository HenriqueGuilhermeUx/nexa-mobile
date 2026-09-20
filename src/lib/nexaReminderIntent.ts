import { Platform } from 'react-native';

import { config } from '@/config';

export type NexaReminderAction = {
  type: 'schedule_local_reminder';
  title: string;
  body: string;
  at: string;
  timezone?: string;
};

function remindersEnabled() {
  return String(process.env.EXPO_PUBLIC_NEXA_ASSISTANT_REMINDERS_ENABLED || '')
    .trim()
    .toLowerCase() === 'true';
}

export async function classifyNexaReminderIntent(
  accessToken: string,
  message: string,
): Promise<NexaReminderAction | null> {
  if (!remindersEnabled() || !accessToken || !message.trim()) return null;

  try {
    const response = await fetch(`${config.apiUrl}/staff/reminder-intent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Nexa-App-Version': config.appVersion,
        'X-Nexa-App-Build': config.appBuild,
        'X-Nexa-Platform': Platform.OS,
      },
      body: JSON.stringify({
        message: message.trim().slice(0, 4000),
        timezone: 'America/Sao_Paulo',
      }),
    });

    if (!response.ok) return null;

    const payload: any = await response.json().catch(() => ({}));
    const action = payload?.action;
    if (!action || action.type !== 'schedule_local_reminder') return null;

    const title = String(action.title || '').trim().slice(0, 100);
    const body = String(action.body || '').trim().slice(0, 240);
    const at = String(action.at || '').trim().slice(0, 64);
    const timestamp = Date.parse(at);

    if (
      !title ||
      !body ||
      !at ||
      !Number.isFinite(timestamp) ||
      timestamp <= Date.now() + 15_000
    ) {
      return null;
    }

    return {
      type: 'schedule_local_reminder',
      title,
      body,
      at: new Date(timestamp).toISOString(),
      timezone: 'America/Sao_Paulo',
    };
  } catch {
    return null;
  }
}

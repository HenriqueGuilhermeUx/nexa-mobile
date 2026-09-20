import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { config } from '@/config';
import {
  ensureNexaNotificationPermission,
  initializeNexaNotifications,
} from '@/lib/nexaNotifications';

type RemotePushRegistrationResult = {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  active?: boolean;
};

function remotePushEnabled() {
  return String(process.env.EXPO_PUBLIC_NEXA_REMOTE_PUSH_ENABLED || '')
    .trim()
    .toLowerCase() === 'true';
}

function expoProjectId() {
  const constants = Constants as any;
  return String(
    constants?.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      '',
  ).trim();
}

export async function registerNexaRemotePush(
  accessToken: string,
): Promise<RemotePushRegistrationResult> {
  if (!remotePushEnabled()) {
    return { success: false, skipped: true, reason: 'remote_push_disabled' };
  }

  if (!accessToken) {
    return { success: false, skipped: true, reason: 'missing_session' };
  }

  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return { success: false, skipped: true, reason: 'unsupported_platform' };
  }

  await initializeNexaNotifications();
  const permission = await ensureNexaNotificationPermission();
  if (!permission.granted) {
    return { success: false, skipped: true, reason: 'permission_not_granted' };
  }

  const projectId = expoProjectId();
  if (!projectId) {
    return { success: false, skipped: true, reason: 'missing_expo_project_id' };
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = String(token?.data || '').trim();
  if (!expoPushToken) {
    return { success: false, skipped: true, reason: 'push_token_unavailable' };
  }

  const response = await fetch(`${config.apiUrl}/notifications/push/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Nexa-App-Version': config.appVersion,
      'X-Nexa-App-Build': config.appBuild,
      'X-Nexa-Platform': Platform.OS,
    },
    body: JSON.stringify({
      expoPushToken,
      platform: Platform.OS,
      appVersion: config.appVersion,
      projectId,
    }),
  });

  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      skipped: true,
      reason: String(payload?.message || payload?.error || `http_${response.status}`),
    };
  }

  return {
    success: payload?.success === true,
    skipped: payload?.enabled === false,
    reason: payload?.enabled === false ? 'registration_disabled' : undefined,
    active: payload?.active === true,
  };
}

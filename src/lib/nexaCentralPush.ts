import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';

const DEVICE_KEY = 'nexa.centralPushDevice.v1';

async function deviceId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(DEVICE_KEY);
  if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_KEY, generated);
  return generated;
}

/**
 * Only call after an explicit in-app service-alert opt-in and OS permission.
 * A successful registration does not indicate that remote delivery is enabled.
 * Never log the Expo token or send it in a URL.
 */
export async function registerNexaCentralServicePush() {
  const session = await loadNexaSession();
  if (!session) return { registered:false as const, reason:'signed_out' as const };
  if (Platform.OS !== 'android' && Platform.OS !== 'ios')
    return { registered:false as const, reason:'unsupported' as const };

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return { registered:false as const, reason:'permission_missing' as const };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== 'string' || !projectId) {
    return { registered:false as const, reason:'project_unavailable' as const };
  }

  // Expo/FCM may need native credentials even when expo-notifications is
  // installed. This is a runtime check, not a claim of working push.
  const push = await Notifications.getExpoPushTokenAsync({ projectId });
  const currentDevice = await deviceId();
  const base = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0,-1) : config.apiUrl;
  const response = await fetch(base + '/central-nexa/push/register', {
    method:'POST',
    headers:{'Authorization':'Bearer ' + session.accessToken, 'Content-Type':'application/json'},
    body:JSON.stringify({deviceId:currentDevice,token:push.data,platform:Platform.OS}),
  });
  if (!response.ok) return {registered:false as const,reason:'backend_unavailable' as const};
  const body = await response.json();
  if (body?.registered !== true) return {registered:false as const,reason:'backend_unavailable' as const};

  // Service notification preference is independent from marketing.
  const preference = await fetch(base + '/central-nexa/preferences', {
    method:'POST',
    headers:{'Authorization':'Bearer ' + session.accessToken, 'Content-Type':'application/json'},
    body:JSON.stringify({servicePushOptIn:true}),
  });
  if (!preference.ok) return {registered:false as const,reason:'preference_not_confirmed' as const};
  return {registered:true as const,deliveryEnabled:false as const};
}

export async function revokeNexaCentralServicePush() {
  const session = await loadNexaSession();
  const currentDevice = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!session || !currentDevice) return false;
  const base = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0,-1) : config.apiUrl;
  const response = await fetch(base + '/central-nexa/push/unregister', {
    method:'POST',
    headers:{'Authorization':'Bearer ' + session.accessToken, 'Content-Type':'application/json'},
    body:JSON.stringify({deviceId:currentDevice}),
  });
  if (!response.ok) return false;
  const preference = await fetch(base + '/central-nexa/preferences', {
    method:'POST',
    headers:{'Authorization':'Bearer ' + session.accessToken, 'Content-Type':'application/json'},
    body:JSON.stringify({servicePushOptIn:false}),
  });
  return preference.ok;
}

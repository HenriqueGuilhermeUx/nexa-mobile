import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'nexa.accessToken';
const REFRESH_TOKEN_KEY = 'nexa.refreshToken';
const EMAIL_KEY = 'nexa.email';

export interface NexaSession {
  accessToken: string;
  refreshToken?: string | null;
  email: string;
}

export async function saveNexaSession(session: NexaSession) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(EMAIL_KEY, session.email.toLowerCase(), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });

  if (session.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export async function loadNexaSession(): Promise<NexaSession | null> {
  const [accessToken, refreshToken, email] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(EMAIL_KEY),
  ]);

  if (!accessToken || !email) return null;
  return { accessToken, refreshToken, email };
}

export async function clearNexaSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(EMAIL_KEY),
  ]);
}

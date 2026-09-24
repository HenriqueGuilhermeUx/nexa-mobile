import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'nexa.accessToken';
const REFRESH_TOKEN_KEY = 'nexa.refreshToken';
const EMAIL_KEY = 'nexa.email';
const MIGRATION_KEY = 'nexa.secureSessionMigration.v1';
const SESSION_PRESENT_KEY = 'nexa.sessionPresent.v1';

const secureOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const markerOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface NexaSession {
  accessToken: string;
  refreshToken?: string | null;
  email: string;
}

async function setSessionPresent(present: boolean) {
  if (present) {
    await SecureStore.setItemAsync(SESSION_PRESENT_KEY, '1', markerOptions);
  } else {
    await SecureStore.deleteItemAsync(SESSION_PRESENT_KEY);
  }
}

export async function hasNexaSessionMarker() {
  return (await SecureStore.getItemAsync(SESSION_PRESENT_KEY)) === '1';
}

export async function saveNexaSession(session: NexaSession) {
  await SecureStore.setItemAsync(
    ACCESS_TOKEN_KEY,
    session.accessToken,
    secureOptions,
  );
  await SecureStore.setItemAsync(
    EMAIL_KEY,
    session.email.toLowerCase(),
    secureOptions,
  );

  if (session.refreshToken) {
    await SecureStore.setItemAsync(
      REFRESH_TOKEN_KEY,
      session.refreshToken,
      secureOptions,
    );
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }

  await setSessionPresent(true);
}

export async function loadNexaSession(): Promise<NexaSession | null> {
  const [accessToken, refreshToken, email] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(EMAIL_KEY),
  ]);

  if (!accessToken || !email) {
    await setSessionPresent(false);
    return null;
  }

  await setSessionPresent(true);
  return { accessToken, refreshToken, email };
}

export async function loadNexaEmail() {
  const secureEmail = await SecureStore.getItemAsync(EMAIL_KEY);
  if (secureEmail) return secureEmail.toLowerCase();

  const legacyEmail = await AsyncStorage.getItem('nexa_last_email');
  return String(legacyEmail || '').trim().toLowerCase();
}

export async function clearNexaTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_PRESENT_KEY),
  ]);
}

export async function clearNexaSession(options?: { preserveEmail?: boolean }) {
  const tasks: Promise<unknown>[] = [
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_PRESENT_KEY),
  ];

  if (!options?.preserveEmail) {
    tasks.push(SecureStore.deleteItemAsync(EMAIL_KEY));
  }

  await Promise.all(tasks);
}

/**
 * Migração one-shot para instalações atualizadas a partir das versões antigas.
 * Não depende de limpar cache/dados e nunca migra senha.
 */
export async function migrateLegacySession() {
  const alreadyMigrated = await SecureStore.getItemAsync(MIGRATION_KEY);
  if (alreadyMigrated === '1') {
    const session = await loadNexaSession();
    await setSessionPresent(Boolean(session));
    return;
  }

  const current = await loadNexaSession();
  const [legacyToken, legacyEmail] = await Promise.all([
    AsyncStorage.getItem('nexa_token'),
    AsyncStorage.getItem('nexa_last_email'),
  ]);

  if (!current && legacyToken && legacyEmail) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, legacyToken, secureOptions);
    await SecureStore.setItemAsync(
      EMAIL_KEY,
      legacyEmail.toLowerCase(),
      secureOptions,
    );
    await setSessionPresent(true);
  } else if (!current && legacyEmail) {
    await SecureStore.setItemAsync(
      EMAIL_KEY,
      legacyEmail.toLowerCase(),
      secureOptions,
    );
    await setSessionPresent(false);
  } else {
    await setSessionPresent(Boolean(current));
  }

  // Token legado deixa de permanecer em armazenamento comum depois da migração.
  await AsyncStorage.removeItem('nexa_token');
  await SecureStore.setItemAsync(MIGRATION_KEY, '1', secureOptions);
}

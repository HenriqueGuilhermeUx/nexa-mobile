const ACCESS_TOKEN_KEY = 'nexa.accessToken';
const REFRESH_TOKEN_KEY = 'nexa.refreshToken';
const EMAIL_KEY = 'nexa.email';
const SESSION_PRESENT_KEY = 'nexa.sessionPresent.v1';
const MIGRATION_KEY = 'nexa.secureSessionMigration.v1';

export interface NexaSession {
  accessToken: string;
  refreshToken?: string | null;
  email: string;
}

function sessionStore() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

function persistentStore() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

async function setSessionPresent(present: boolean) {
  const store = sessionStore();
  if (!store) return;
  if (present) store.setItem(SESSION_PRESENT_KEY, '1');
  else store.removeItem(SESSION_PRESENT_KEY);
}

export async function hasNexaSessionMarker() {
  return sessionStore()?.getItem(SESSION_PRESENT_KEY) === '1';
}

export async function saveNexaSession(session: NexaSession) {
  const sessionStorage = sessionStore();
  const localStorage = persistentStore();
  if (!sessionStorage || !localStorage) return;

  sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  if (session.refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  localStorage.setItem(EMAIL_KEY, session.email.toLowerCase());
  await setSessionPresent(true);
}

export async function loadNexaSession(): Promise<NexaSession | null> {
  const sessionStorage = sessionStore();
  const localStorage = persistentStore();
  if (!sessionStorage || !localStorage) return null;

  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  const email = localStorage.getItem(EMAIL_KEY);

  if (!accessToken || !email) {
    await setSessionPresent(false);
    return null;
  }

  await setSessionPresent(true);
  return { accessToken, refreshToken, email };
}

export async function loadNexaEmail() {
  return String(persistentStore()?.getItem(EMAIL_KEY) || '')
    .trim()
    .toLowerCase();
}

export async function clearNexaTokens() {
  const store = sessionStore();
  store?.removeItem(ACCESS_TOKEN_KEY);
  store?.removeItem(REFRESH_TOKEN_KEY);
  store?.removeItem(SESSION_PRESENT_KEY);
}

export async function clearNexaSession(options?: { preserveEmail?: boolean }) {
  await clearNexaTokens();
  if (!options?.preserveEmail) persistentStore()?.removeItem(EMAIL_KEY);
}

export async function migrateLegacySession() {
  const localStorage = persistentStore();
  const sessionStorage = sessionStore();
  if (!localStorage || !sessionStorage) return;

  // Never migrate legacy bearer tokens from persistent browser storage.
  localStorage.removeItem('nexa_token');

  const legacyEmail = String(localStorage.getItem('nexa_last_email') || '')
    .trim()
    .toLowerCase();
  if (!localStorage.getItem(EMAIL_KEY) && legacyEmail) {
    localStorage.setItem(EMAIL_KEY, legacyEmail);
  }

  sessionStorage.setItem(MIGRATION_KEY, '1');
  await setSessionPresent(Boolean(await loadNexaSession()));
}

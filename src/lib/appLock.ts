import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const APP_LOCK_ENABLED_KEY = 'nexa.appLock.enabled.v1';
const APP_LOCK_OFFER_SEEN_KEY = 'nexa.appLock.offerSeen.v1';

export type AppLockCapability = {
  available: boolean;
  enrolledLevel: LocalAuthentication.SecurityLevel;
  strongBiometric: boolean;
  deviceCredential: boolean;
  authenticationTypes: LocalAuthentication.AuthenticationType[];
};

type AuthenticationResult =
  | { success: true }
  | { success: false; error: string };

let activeAuthentication: Promise<AuthenticationResult> | null = null;

const flagOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getAppLockCapability(): Promise<AppLockCapability> {
  try {
    const [level, authenticationTypes] = await Promise.all([
      LocalAuthentication.getEnrolledLevelAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    const deviceCredential = level >= LocalAuthentication.SecurityLevel.SECRET;
    const strongBiometric =
      level >= LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;

    return {
      available: deviceCredential,
      enrolledLevel: level,
      strongBiometric,
      deviceCredential,
      authenticationTypes,
    };
  } catch {
    return {
      available: false,
      enrolledLevel: LocalAuthentication.SecurityLevel.NONE,
      strongBiometric: false,
      deviceCredential: false,
      authenticationTypes: [],
    };
  }
}

export async function isAppLockEnabled() {
  return (await SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY)) === '1';
}

export async function shouldOfferAppLock() {
  const [enabled, offerSeen, capability] = await Promise.all([
    isAppLockEnabled(),
    SecureStore.getItemAsync(APP_LOCK_OFFER_SEEN_KEY),
    getAppLockCapability(),
  ]);

  return !enabled && offerSeen !== '1' && capability.available;
}

export async function markAppLockOfferSeen() {
  await SecureStore.setItemAsync(APP_LOCK_OFFER_SEEN_KEY, '1', flagOptions);
}

async function runAuthentication(
  promptMessage: string,
): Promise<AuthenticationResult> {
  try {
    const capability = await getAppLockCapability();
    if (!capability.available) {
      return { success: false, error: 'device_authentication_unavailable' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      promptSubtitle: 'Confirme sua identidade',
      promptDescription:
        'Use biometria forte ou a credencial de desbloqueio do aparelho.',
      cancelLabel: 'Usar senha Nexa',
      fallbackLabel: 'Usar código do aparelho',
      disableDeviceFallback: false,
      requireConfirmation: true,
      biometricsSecurityLevel: 'strong',
    });

    if (result.success) return { success: true };
    return { success: false, error: result.error || 'authentication_failed' };
  } catch {
    return { success: false, error: 'authentication_failed' };
  }
}

export async function authenticateDevice(
  promptMessage = 'Acessar a Nexa',
): Promise<AuthenticationResult> {
  if (activeAuthentication) return activeAuthentication;

  const attempt = runAuthentication(promptMessage);
  activeAuthentication = attempt;
  try {
    return await attempt;
  } finally {
    if (activeAuthentication === attempt) activeAuthentication = null;
  }
}

export async function enableAppLock() {
  const result = await authenticateDevice('Ativar proteção da Nexa');
  if (!result.success) return result;

  await Promise.all([
    SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, '1', flagOptions),
    SecureStore.setItemAsync(APP_LOCK_OFFER_SEEN_KEY, '1', flagOptions),
  ]);

  return { success: true as const };
}

export async function disableAppLock() {
  const enabled = await isAppLockEnabled();
  if (enabled) {
    const result = await authenticateDevice('Desativar proteção da Nexa');
    if (!result.success) return result;
  }

  await SecureStore.deleteItemAsync(APP_LOCK_ENABLED_KEY);
  return { success: true as const };
}

export async function reauthenticateSensitiveAction(message: string) {
  if (!(await isAppLockEnabled())) return { success: true as const };
  return authenticateDevice(message);
}

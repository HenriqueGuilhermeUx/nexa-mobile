export type AppLockCapability = {
  available: boolean;
  enrolledLevel: number;
  strongBiometric: boolean;
  deviceCredential: boolean;
  authenticationTypes: number[];
};

type AuthenticationResult =
  | { success: true }
  | { success: false; error: string };

export async function getAppLockCapability(): Promise<AppLockCapability> {
  return {
    available: false,
    enrolledLevel: 0,
    strongBiometric: false,
    deviceCredential: false,
    authenticationTypes: [],
  };
}

export async function isAppLockEnabled() {
  return false;
}

export async function shouldOfferAppLock() {
  return false;
}

export async function markAppLockOfferSeen() {}

export async function authenticateDevice(): Promise<AuthenticationResult> {
  return { success: false, error: 'web_device_authentication_unavailable' };
}

export async function enableAppLock(): Promise<AuthenticationResult> {
  return { success: false, error: 'web_device_authentication_unavailable' };
}

export async function disableAppLock() {
  return { success: true as const };
}

export async function reauthenticateSensitiveAction() {
  return { success: true as const };
}

import AsyncStorage from '@react-native-async-storage/async-storage';

import { config } from '@/config';

const PREFIX = 'nexa.ecosystemWelcome.v1.';
const PROFILE_PREFIX = 'nexa.ecosystemProfileIntro.v1.';

function profileKey(profile: any) {
  return String(profile?.id || profile?.email || '')
    .trim()
    .toLowerCase();
}

export async function shouldShowEcosystemWelcome(profile: any) {
  if (!config.ecosystemEnabled || !config.ecosystemOnboardingEnabled) {
    return false;
  }

  if (!config.docWalletEnabled && !config.healthWalletEnabled) {
    return false;
  }

  const key = profileKey(profile);
  if (!key) return false;

  return (await AsyncStorage.getItem(`${PREFIX}${key}`)) !== '1';
}

export async function markEcosystemWelcomeSeen(profile: any) {
  const key = profileKey(profile);
  if (!key) return;

  await AsyncStorage.setItem(`${PREFIX}${key}`, '1');
}


export async function shouldShowEcosystemProfileIntro(profile: any) {
  if (!config.ecosystemEnabled) return false;
  if (!config.docWalletEnabled && !config.healthWalletEnabled) return false;

  const key = profileKey(profile);
  if (!key) return false;

  return (await AsyncStorage.getItem(`${PROFILE_PREFIX}${key}`)) !== '1';
}

export async function markEcosystemProfileIntroSeen(profile: any) {
  const key = profileKey(profile);
  if (!key) return;

  await AsyncStorage.setItem(`${PROFILE_PREFIX}${key}`, '1');
}

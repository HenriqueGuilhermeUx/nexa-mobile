import { DeviceEventEmitter } from 'react-native';

export const FORCE_UPDATE_EVENT = 'nexa-force-update-required';

export type ForceUpdatePolicyPayload = {
  success?: boolean;
  code?: string;
  minimumVersion?: string;
  latestVersion?: string;
  minimumBuild?: number;
  latestBuild?: number;
  forceUpdate?: boolean;
  message?: string;
  playStoreUrl?: string;
};

export function notifyForceUpdateRequired(policy: ForceUpdatePolicyPayload) {
  DeviceEventEmitter.emit(FORCE_UPDATE_EVENT, policy);
}

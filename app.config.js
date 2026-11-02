module.exports = ({ config }) => {
  // Dedicated internal package. Never overwrite customers' v148 installation,
  // share its OTA channel, or reuse production deep-link callbacks.
  const channel = String(process.env.EXPO_PUBLIC_NEXA_RELEASE_CHANNEL || '').trim();
  if (channel === 'wallet-inbound-lab') {
    return {
      ...config,
      name: 'Nexa Wallet Connect QA',
      scheme: 'nexa-walletconnect-qa',
      updates: {...(config.updates || {}), enabled: false},
      android: {
        ...(config.android || {}),
        package: 'br.com.trynexa.walletconnectqa',
        versionCode: 149,
      },
      ios: {
        ...(config.ios || {}),
        bundleIdentifier: 'br.com.trynexa.walletconnectqa',
        buildNumber: '149',
      },
      extra: {
        ...(config.extra || {}),
        releaseChannel: 'wallet-inbound-lab',
        financialExecutionEnabled: false,
        ledgerOperationsEnabled: false,
      },
    };
  }
  const pilot =
    String(process.env.EXPO_PUBLIC_NEXA_RELEASE_CHANNEL || '').trim() ===
    'nexa-pay-pilot';

  if (!pilot) return config;

  const android = config.android || {};
  const { adaptiveIcon: _legacyAdaptiveIcon, ...androidWithoutAdaptiveIcon } = android;

  return {
    ...config,
    name: 'Nexa Pay Pilot',
    scheme: 'nexa-pay-pilot',
    icon: './assets/brand/nexa-pilot-icon-exact.png',
    updates: {
      ...(config.updates || {}),
      enabled: false,
    },
    android: {
      ...androidWithoutAdaptiveIcon,
      package: 'br.com.trynexa.paypilot',
      versionCode: 147,
    },
    plugins: [
      ...(config.plugins || []),
      [
        'expo-camera',
        {
          cameraPermission:
            'Permita que a Nexa use a câmera para ler QR Code e código de barras.',
          recordAudioAndroid: false,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Permita que a Nexa acesse uma foto para ler QR Code ou código de barras.',
          cameraPermission:
            'Permita que a Nexa use a câmera para fotografar QR Code e código de barras.',
        },
      ],
    ],
    extra: {
      ...(config.extra || {}),
      releaseChannel: 'nexa-pay-pilot',
      pilotBuild: true,
      financialExecutionEnabled: false,
    },
  };
};

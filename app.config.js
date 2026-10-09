module.exports = ({ config }) => {
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
      versionCode: 146,
    },
    extra: {
      ...(config.extra || {}),
      releaseChannel: 'nexa-pay-pilot',
      pilotBuild: true,
      financialExecutionEnabled: false,
    },
  };
};

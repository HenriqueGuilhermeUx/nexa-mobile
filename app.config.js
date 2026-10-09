module.exports = ({ config }) => {
  const pilot =
    String(process.env.EXPO_PUBLIC_NEXA_RELEASE_CHANNEL || '').trim() ===
    'nexa-pay-pilot';

  if (!pilot) return config;

  return {
    ...config,
    name: 'Nexa Pay Pilot',
    scheme: 'nexa-pay-pilot',
    updates: {
      ...(config.updates || {}),
      enabled: false,
    },
    android: {
      ...(config.android || {}),
      package: 'br.com.trynexa.paypilot',
      versionCode: 1,
      adaptiveIcon: {
        ...((config.android && config.android.adaptiveIcon) || {}),
        backgroundColor: '#218BFF',
      },
    },
  };
};

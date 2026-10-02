// Nexa v135 Rewards activity, plans and transaction details.
// Financial execution remains server-gated until controlled homologation is complete.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.32',
  ios: {
    ...(config.ios || {}),
    buildNumber: '135',
  },
  android: {
    ...(config.android || {}),
    versionCode: 135,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.32-v135-rewards-activity',
  },
});

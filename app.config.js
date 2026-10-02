// Nexa v134 Rewards operator-reconciled recovery.
// Financial execution remains server-gated until controlled homologation is complete.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.32',
  ios: {
    ...(config.ios || {}),
    buildNumber: '134',
  },
  android: {
    ...(config.android || {}),
    versionCode: 134,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.32-v134-rewards-reconciled-retry',
  },
});

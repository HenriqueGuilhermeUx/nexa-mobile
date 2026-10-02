// Nexa v133 Rewards terminal-state recovery.
// Financial execution remains server-gated until controlled homologation is complete.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.32',
  ios: {
    ...(config.ios || {}),
    buildNumber: '133',
  },
  android: {
    ...(config.android || {}),
    versionCode: 133,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.32-v133-rewards-terminal-retry',
  },
});

// Nexa v131 Rewards access-token authorization correction.
// Financial execution remains server-gated until controlled homologation is complete.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.30',
  ios: {
    ...(config.ios || {}),
    buildNumber: '131',
  },
  android: {
    ...(config.android || {}),
    versionCode: 131,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.30-v131-rewards-access-token-auth',
  },
});

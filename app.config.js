// Nexa v132 Rewards client-signed wallet authorization.
// Financial execution remains server-gated until controlled homologation is complete.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.31',
  ios: {
    ...(config.ios || {}),
    buildNumber: '132',
  },
  android: {
    ...(config.android || {}),
    versionCode: 132,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.31-v132-rewards-client-signature',
  },
});

// Nexa v136 Wallet-First private banking candidate.
// Financial execution remains server-gated until controlled homologation is complete.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.33',
  ios: {
    ...(config.ios || {}),
    buildNumber: '136',
  },
  android: {
    ...(config.android || {}),
    versionCode: 136,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.33-v136-wallet-first-private',
  },
});

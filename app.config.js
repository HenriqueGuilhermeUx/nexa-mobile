// Nexa v140 Wallet-First Pix idempotency test candidate.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.37',
  ios: {
    ...(config.ios || {}),
    buildNumber: '140',
  },
  android: {
    ...(config.android || {}),
    versionCode: 140,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.37-v139-wallet-first-pix',
  },
});

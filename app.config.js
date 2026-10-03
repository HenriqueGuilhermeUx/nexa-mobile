// Nexa v139 Wallet-First Pix test candidate.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.36',
  ios: {
    ...(config.ios || {}),
    buildNumber: '139',
  },
  android: {
    ...(config.android || {}),
    versionCode: 139,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.36-v139-wallet-first-pix',
  },
});

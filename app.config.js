// Nexa v144 Wallet 2026 native-brand store release.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.41',
  ios: {
    ...(config.ios || {}),
    buildNumber: '144',
  },
  android: {
    ...(config.android || {}),
    versionCode: 144,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.41-v144-wallet-2026-native-brand',
  },
});

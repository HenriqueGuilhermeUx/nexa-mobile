// Nexa v137 Wallet-First Cripto Wallet test candidate.
// Production release profiles remain financially gated; the internal APK uses the
// explicit production-safe-preview profile for controlled real-money testing.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.34',
  ios: {
    ...(config.ios || {}),
    buildNumber: '137',
  },
  android: {
    ...(config.android || {}),
    versionCode: 137,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.34-v137-wallet-first-crypto-wallet',
  },
});

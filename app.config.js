module.exports = ({ config }) => ({
  ...config,
  version: '2.0.20',
  ios: {
    ...(config.ios || {}),
    buildNumber: '118',
  },
  android: {
    ...(config.android || {}),
    versionCode: 118,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.20-v117-hf1-build118-wallet-first-internal',
  },
});

module.exports = ({ config }) => ({
  ...config,
  version: '2.0.20',
  ios: {
    ...(config.ios || {}),
    buildNumber: '116',
  },
  android: {
    ...(config.android || {}),
    versionCode: 116,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.20-v116-wallet-first-internal',
  },
});

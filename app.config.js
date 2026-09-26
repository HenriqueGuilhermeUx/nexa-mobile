module.exports = ({ config }) => ({
  ...config,
  version: '2.0.20',
  ios: {
    ...(config.ios || {}),
    buildNumber: '117',
  },
  android: {
    ...(config.android || {}),
    versionCode: 117,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.20-v117-wallet-first-internal',
  },
});

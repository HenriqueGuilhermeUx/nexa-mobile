module.exports = ({ config }) => ({
  ...config,
  version: '2.0.21',
  ios: {
    ...(config.ios || {}),
    buildNumber: '119',
  },
  android: {
    ...(config.android || {}),
    versionCode: 119,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.21-v119-wallet-first-pilot',
  },
});

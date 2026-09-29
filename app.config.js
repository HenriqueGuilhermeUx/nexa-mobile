module.exports = ({ config }) => ({
  ...config,
  version: '2.0.22',
  ios: {
    ...(config.ios || {}),
    buildNumber: '120',
  },
  android: {
    ...(config.android || {}),
    versionCode: 120,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.22-v120-wallet-first-pilot',
  },
});

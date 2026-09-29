module.exports = ({ config }) => ({
  ...config,
  version: '2.0.23',
  ios: {
    ...(config.ios || {}),
    buildNumber: '121',
  },
  android: {
    ...(config.android || {}),
    versionCode: 121,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.23-v121-wallet-first-pilot',
  },
});

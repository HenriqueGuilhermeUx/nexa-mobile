module.exports = ({ config }) => ({
  ...config,
  version: '2.0.23',
  ios: {
    ...(config.ios || {}),
    buildNumber: '122',
  },
  android: {
    ...(config.android || {}),
    versionCode: 122,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.23-v122-wallet-first-pilot',
  },
});

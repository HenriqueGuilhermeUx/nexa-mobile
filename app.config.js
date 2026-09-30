module.exports = ({ config }) => ({
  ...config,
  version: '2.0.24',
  ios: {
    ...(config.ios || {}),
    buildNumber: '123',
  },
  android: {
    ...(config.android || {}),
    versionCode: 123,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.24-v123-wallet-first-pilot-ota',
  },
});

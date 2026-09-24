module.exports = ({ config }) => ({
  ...config,
  version: '2.0.19',
  ios: {
    ...(config.ios || {}),
    buildNumber: '114',
  },
  android: {
    ...(config.android || {}),
    versionCode: 114,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.19-v114-biometric-open-finance',
  },
});

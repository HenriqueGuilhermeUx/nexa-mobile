module.exports = ({ config }) => ({
  ...config,
  version: '2.0.18',
  ios: {
    ...(config.ios || {}),
    buildNumber: '113',
  },
  android: {
    ...(config.android || {}),
    versionCode: 113,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.18-v113-open-finance-official',
  },
});

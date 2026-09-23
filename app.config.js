module.exports = ({ config }) => ({
  ...config,
  version: '2.0.17',
  ios: {
    ...(config.ios || {}),
    buildNumber: '112',
  },
  android: {
    ...(config.android || {}),
    versionCode: 112,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.17-v112-open-finance-production',
  },
});

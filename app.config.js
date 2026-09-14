module.exports = ({ config }) => ({
  ...config,
  version: '2.0.12',
  ios: {
    ...(config.ios || {}),
    buildNumber: '106',
  },
  android: {
    ...(config.android || {}),
    versionCode: 106,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.12-v106-production-safe',
  },
});

module.exports = ({ config }) => ({
  ...config,
  version: '2.0.12',
  ios: {
    ...(config.ios || {}),
    buildNumber: '107',
  },
  android: {
    ...(config.android || {}),
    versionCode: 107,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.12-v107-production-safe',
  },
});

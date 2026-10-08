// Nexa v146 ecosystem store release.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.42',
  ios: {
    ...(config.ios || {}),
    buildNumber: '146',
  },
  android: {
    ...(config.android || {}),
    versionCode: 146,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.42-v146-ecosystem',
  },
});

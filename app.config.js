// Nexa v145 Sovereignty store release.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.42',
  ios: {
    ...(config.ios || {}),
    buildNumber: '145',
  },
  android: {
    ...(config.android || {}),
    versionCode: 145,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.42-v145-sovereignty',
  },
});

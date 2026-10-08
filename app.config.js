// Nexa Android v147 launcher icon hotfix. iOS remains build 146.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.42',
  ios: {
    ...(config.ios || {}),
    buildNumber: '146',
  },
  android: {
    ...(config.android || {}),
    versionCode: 147,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.42-v147-icon-hotfix',
  },
});

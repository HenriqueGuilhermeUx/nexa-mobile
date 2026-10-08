// Nexa 2.0.42 v147 store icon hotfix.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.42',
  ios: {
    ...(config.ios || {}),
    buildNumber: '147',
  },
  android: {
    ...(config.android || {}),
    versionCode: 147,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'stores-2.0.42-v147-icon-hotfix',
  },
});

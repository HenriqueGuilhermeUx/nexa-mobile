// Nexa v142 definitive onboarding and Premium release.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.39',
  ios: {
    ...(config.ios || {}),
    buildNumber: '142',
  },
  android: {
    ...(config.android || {}),
    versionCode: 142,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.39-v141-open-finance-subscription',
  },
});

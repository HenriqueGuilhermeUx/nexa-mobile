// Nexa v143 definitive onboarding and Premium release.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.40',
  ios: {
    ...(config.ios || {}),
    buildNumber: '143',
  },
  android: {
    ...(config.android || {}),
    versionCode: 143,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.40-v143-definitive-onboarding',
  },
});

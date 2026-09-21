module.exports = ({ config }) => ({
  ...config,
  version: '2.0.14',
  ios: {
    ...(config.ios || {}),
    buildNumber: '109',
  },
  android: {
    ...(config.android || {}),
    versionCode: 109,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.14-v109-assistant-open-finance-pilot',
  },
});

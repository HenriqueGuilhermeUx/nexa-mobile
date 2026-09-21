module.exports = ({ config }) => ({
  ...config,
  version: '2.0.13',
  ios: {
    ...(config.ios || {}),
    buildNumber: '108',
  },
  android: {
    ...(config.android || {}),
    versionCode: 108,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.13-v108-assistant-open-finance-pilot',
  },
});

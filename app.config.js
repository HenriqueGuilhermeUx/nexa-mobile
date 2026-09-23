module.exports = ({ config }) => ({
  ...config,
  version: '2.0.16',
  ios: {
    ...(config.ios || {}),
    buildNumber: '111',
  },
  android: {
    ...(config.android || {}),
    versionCode: 111,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.16-v111-assistant-open-finance-refresh-fix',
  },
});

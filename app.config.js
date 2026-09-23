module.exports = ({ config }) => ({
  ...config,
  version: '2.0.15',
  ios: {
    ...(config.ios || {}),
    buildNumber: '110',
  },
  android: {
    ...(config.android || {}),
    versionCode: 110,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.15-v110-assistant-open-finance-recovery-pilot',
  },
});

module.exports = ({ config }) => ({
  ...config,
  version: '2.0.23',
  ios: {
    ...(config.ios || {}),
    buildNumber: '124',
  },
  android: {
    ...(config.android || {}),
    versionCode: 124,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.23-v124-wallet-first-auth-fix',
  },
});

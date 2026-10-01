module.exports = ({ config }) => ({
  ...config,
  version: '2.0.27',
  ios: {
    ...(config.ios || {}),
    buildNumber: '128',
  },
  android: {
    ...(config.android || {}),
    versionCode: 128,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.27-v128-rewards-turbinar-pilot',
  },
});
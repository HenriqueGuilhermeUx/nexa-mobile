// Release candidate: Nexa 2.0.20 / Android v115.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.20',
  ios: {
    ...(config.ios || {}),
    buildNumber: '115',
  },
  android: {
    ...(config.android || {}),
    versionCode: 115,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.20-v115-release-ready',
  },
});

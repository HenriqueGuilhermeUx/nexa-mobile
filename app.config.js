// iOS App Review release candidate. Keep Android's published version unchanged.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.43',
  ios: {
    ...(config.ios || {}),
    buildNumber: '149',
  },
  android: {
    ...(config.android || {}),
    versionCode: 145,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'ios-2.0.43-149-review-candidate',
  },
});

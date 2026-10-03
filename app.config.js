// Nexa v138 Premium source-of-truth test candidate.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.35',
  ios: {
    ...(config.ios || {}),
    buildNumber: '138',
  },
  android: {
    ...(config.android || {}),
    versionCode: 138,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.35-v138-premium-source-of-truth',
  },
});

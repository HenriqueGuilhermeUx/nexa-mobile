// Nexa v141 Open Finance USDC subscription release candidate.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.38',
  ios: {
    ...(config.ios || {}),
    buildNumber: '141',
  },
  android: {
    ...(config.android || {}),
    versionCode: 141,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.38-v141-open-finance-subscription',
  },
});

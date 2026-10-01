module.exports = ({ config }) => ({
  ...config,
  version: '2.0.26',
  ios: {
    ...(config.ios || {}),
    buildNumber: '127',
  },
  android: {
    ...(config.android || {}),
    versionCode: 127,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.26-v127-privy-wallet-session-recovery',
  },
});

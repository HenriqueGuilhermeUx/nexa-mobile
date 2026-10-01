module.exports = ({ config }) => ({
  ...config,
  version: '2.0.25',
  ios: {
    ...(config.ios || {}),
    buildNumber: '126',
  },
  android: {
    ...(config.android || {}),
    versionCode: 126,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.25-v126-wallet-api-v5-sponsored-swap',
  },
});

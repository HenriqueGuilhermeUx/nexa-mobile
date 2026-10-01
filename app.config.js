module.exports = ({ config }) => ({
  ...config,
  version: '2.0.24',
  ios: {
    ...(config.ios || {}),
    buildNumber: '125',
  },
  android: {
    ...(config.android || {}),
    versionCode: 125,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.24-v125-client-sponsored-swap',
  },
});

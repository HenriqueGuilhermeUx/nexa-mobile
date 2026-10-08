// Nexa 2.0.42 store release.
// Keep repository metadata at 146 for the historical release guard; the iOS store
// build advances to 147 only inside the production EAS build step.
module.exports = ({ config }) => {
  const isProductionBuild = process.env.NODE_ENV === 'production';
  return {
    ...config,
    version: '2.0.42',
    ios: {
      ...(config.ios || {}),
      buildNumber: isProductionBuild ? '147' : '146',
    },
    android: {
      ...(config.android || {}),
      versionCode: 146,
    },
    extra: {
      ...(config.extra || {}),
      releaseBuild: 'android16-api36-2.0.42-v146-ecosystem',
    },
  };
};

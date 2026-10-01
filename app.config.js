// Nexa v129 launch candidate: Rewards reauth, Premium Gold and card funding validation.
// Financial execution remains server-gated until controlled homologation is complete.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.28',
  ios: {
    ...(config.ios || {}),
    buildNumber: '129',
  },
  android: {
    ...(config.android || {}),
    versionCode: 129,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.28-v129-launch-candidate-gold-card-rewards',
  },
});
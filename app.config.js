// Nexa v130 Rewards authorization correction and balance reconciliation.
// Financial execution remains server-gated until controlled homologation is complete.
module.exports = ({ config }) => ({
  ...config,
  version: '2.0.29',
  ios: {
    ...(config.ios || {}),
    buildNumber: '130',
  },
  android: {
    ...(config.android || {}),
    versionCode: 130,
  },
  extra: {
    ...(config.extra || {}),
    releaseBuild: 'android16-api36-2.0.29-v130-rewards-identity-reconcile',
  },
});

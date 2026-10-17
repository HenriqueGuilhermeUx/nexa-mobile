const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
if (!dir) throw new Error('Signing directory required');
const p12 = path.join(dir, 'distribution.p12');
const profile = path.join(dir, 'profile.mobileprovision');
for (const file of [p12, profile]) {
  if (!fs.existsSync(file) || !fs.statSync(file).size) throw new Error('Missing signing material: ' + path.basename(file));
}
const credentials = {
  ios: {
    provisioningProfilePath: profile,
    distributionCertificate: {
      path: p12,
      password: process.env.IOS_DISTRIBUTION_P12_PASSWORD || '',
    },
  },
};
fs.writeFileSync('credentials.json', JSON.stringify(credentials, null, 2), { mode: 0o600 });
console.log('Local EAS iOS credentials file created.');

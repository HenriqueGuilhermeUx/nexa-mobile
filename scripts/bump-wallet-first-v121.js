const fs = require('node:fs');

const replacements = {
  'scripts/validate-mobile-safety.js': [
    ['2.0.22', '2.0.23'],
    ['2\\.0\\.22', '2\\.0\\.23'],
    ['v120', 'v121'],
    ['120', '121'],
  ],
  'scripts/validate-biometric-app-lock.js': [
    ['2.0.22', '2.0.23'],
    ['2\\.0\\.22', '2\\.0\\.23'],
    ['v120', 'v121'],
    ['120', '121'],
  ],
  '.github/workflows/wallet-first-pilot-apk.yml': [
    ['wallet-first-pilot-v120.txt', 'wallet-first-pilot-v121.txt'],
    ["app.version !== '2.0.22'", "app.version !== '2.0.23'"],
    ['versionCode) !== 120', 'versionCode) !== 121'],
    ["dynamic.version !== '2.0.22'", "dynamic.version !== '2.0.23'"],
    ["'android16-api36-2.0.22-v120-wallet-first-pilot'", "'android16-api36-2.0.23-v121-wallet-first-pilot'"],
    ['Wallet-First v120 identity OK.', 'Wallet-First v121 identity OK.'],
    ['Nexa-Wallet-First-Pilot-v120-VERIFIED', 'Nexa-Wallet-First-Pilot-v121-VERIFIED'],
    ['Nexa-Wallet-First-Pilot-v120-build-diagnostics', 'Nexa-Wallet-First-Pilot-v121-build-diagnostics'],
  ],
};

for (const [file, pairs] of Object.entries(replacements)) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) source = source.split(from).join(to);
  fs.writeFileSync(file, source);
}

const workflow = '.github/workflows/wallet-first-pilot-apk.yml';
let workflowSource = fs.readFileSync(workflow, 'utf8');
if (!workflowSource.includes('Validate cross-device wallet recovery')) {
  const needle = '      - name: Validate Wallet-First transfer and BTC/ETH flows\n        run: node scripts/validate-wallet-first-user-actions.js\n';
  const insert = `${needle}\n      - name: Validate cross-device wallet recovery\n        run: node scripts/validate-wallet-cross-device-recovery.js\n`;
  if (!workflowSource.includes(needle)) throw new Error('Wallet-First workflow insertion point missing');
  workflowSource = workflowSource.replace(needle, insert);
  fs.writeFileSync(workflow, workflowSource);
}

console.log('v121 release identity and safety contracts aligned.');

const fs = require('fs');

const appPath = 'app.json';
const sourcePath = 'src/components/AlignedLegacyApp.tsx';

const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
const source = fs.readFileSync(sourcePath, 'utf8');

if (!source.includes('Fale com a Nexa') || !source.includes('551333289704')) {
  throw new Error('Fale com a Nexa / WhatsApp support missing.');
}

if (!app.expo || !app.expo.android || !app.expo.extra) {
  throw new Error('Unexpected app.json structure.');
}

app.expo.android.versionCode = 105;
app.expo.ios = app.expo.ios || {};
app.expo.ios.buildNumber = '105';
app.expo.extra.apiUrl = 'https://nexa-backend-p2u0.onrender.com/api/v1';
app.expo.extra.financialExecutionEnabled = false;
app.expo.extra.releaseChannel = 'production-safe-preview';
app.expo.extra.releaseBuild = 'android16-api36-2.0.11-v105-production-safe-preview';

fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
console.log('Production-safe build patched to versionCode 105 in CI only.');

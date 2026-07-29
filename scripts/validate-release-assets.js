const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;

function requireAsset(label, relativePath) {
  assert.ok(relativePath, `${label} não foi configurado.`);
  const resolved = path.resolve(relativePath);
  assert.ok(fs.existsSync(resolved), `${label} ausente: ${relativePath}`);
  const stat = fs.statSync(resolved);
  assert.ok(stat.isFile(), `${label} não é um arquivo: ${relativePath}`);
  assert.ok(stat.size > 0, `${label} está vazio: ${relativePath}`);
  return { label, relativePath, bytes: stat.size };
}

const splashPlugin = (app.plugins || []).find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
);
assert.ok(splashPlugin, 'Plugin expo-splash-screen não configurado.');

const assets = [
  requireAsset('Ícone do aplicativo', app.icon),
  requireAsset('Ícone adaptativo Android', app.android?.adaptiveIcon?.foregroundImage),
  requireAsset('Logo do splash Android', splashPlugin[1]?.image),
];

assert.equal(app.version, '2.0.2');
assert.equal(Number(app.android?.versionCode), 32);
assert.equal(String(app.ios?.buildNumber), '32');
assert.equal(app.android?.package, 'br.com.trynexa.app');
assert.equal(app.extra?.financialExecutionEnabled, false);
assert.ok(Number(splashPlugin[1]?.imageWidth || 0) > 0);

console.log(
  JSON.stringify(
    {
      ok: true,
      version: app.version,
      versionCode: app.android.versionCode,
      iosBuildNumber: app.ios.buildNumber,
      package: app.android.package,
      assets,
    },
    null,
    2,
  ),
);

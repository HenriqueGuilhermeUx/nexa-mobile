const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

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
  requireAsset(
    'Ícone adaptativo Android',
    app.android?.adaptiveIcon?.foregroundImage,
  ),
  requireAsset('Logo do splash Android', splashPlugin[1]?.image),
];

// Release contracts: validate consistency and minimum production baseline instead
// of freezing this asset validator to one historical app version.
assert.equal(app.version, pkg.version, 'app.json e package.json devem usar a mesma versão.');
assert.ok(/^\d+\.\d+\.\d+$/.test(String(app.version || '')), 'Versão semver inválida.');
assert.ok(Number(app.android?.versionCode) >= 101, 'Android versionCode deve ser >= 101.');
assert.equal(
  String(app.ios?.buildNumber),
  String(app.android?.versionCode),
  'iOS buildNumber e Android versionCode devem permanecer sincronizados nesta release.',
);
assert.equal(app.android?.package, 'br.com.trynexa.app');
assert.equal(app.ios?.bundleIdentifier, 'br.com.trynexa.app');
assert.equal(app.extra?.financialExecutionEnabled, false);
assert.equal(app.extra?.ledgerOperationsEnabled, true);
assert.equal(app.extra?.balanceSource, 'ledger');
assert.equal(app.extra?.privyOptional, true);
assert.equal(app.extra?.releaseChannel, 'production');
assert.ok(
  Number(app.extra?.androidTargetApi || 0) >= 36,
  'A release deve declarar Android target API 36 ou superior.',
);
assert.ok(Number(splashPlugin[1]?.imageWidth || 0) > 0);

console.log(
  JSON.stringify(
    {
      ok: true,
      version: app.version,
      versionCode: app.android.versionCode,
      iosBuildNumber: app.ios.buildNumber,
      package: app.android.package,
      androidTargetApi: app.extra.androidTargetApi,
      balanceSource: app.extra.balanceSource,
      privyOptional: app.extra.privyOptional,
      assets,
    },
    null,
    2,
  ),
);

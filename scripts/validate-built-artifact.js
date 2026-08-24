const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const target = process.argv[2];
assert.ok(target, 'Informe o diretório exportado ou extraído para validação.');
assert.ok(fs.existsSync(target), `Diretório de validação ausente: ${target}`);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const forbidden = [
  '/withdrawal/pix-request',
  'Primeiros Nexa',
  'Já recebi meu convite',
  'Recebi meu convite',
  'direct_settlement',
];
const required = [
  '/payment/pix/redemption',
  '/kyc/didit/brazil/start',
  '/kyc/didit/me',
];
const matches = new Map(forbidden.map((value) => [value, []]));
const requiredFound = new Map(required.map((value) => [value, false]));

for (const file of walk(target)) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0) continue;
  const content = fs.readFileSync(file);

  for (const value of forbidden) {
    if (content.includes(Buffer.from(value, 'utf8'))) {
      matches.get(value).push(path.relative(target, file));
    }
  }
  for (const value of required) {
    if (content.includes(Buffer.from(value, 'utf8'))) {
      requiredFound.set(value, true);
    }
  }
}

const violations = [...matches.entries()].filter(([, files]) => files.length > 0);
assert.deepEqual(
  violations,
  [],
  `Conteúdo proibido encontrado no artefato: ${JSON.stringify(violations)}`,
);
for (const [value, found] of requiredFound.entries()) {
  assert.equal(found, true, `Rota obrigatória ausente do artefato: ${value}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      target,
      officialPixRoute: '/payment/pix/redemption',
      brazilKycRoutes: ['/kyc/didit/brazil/start', '/kyc/didit/me'],
      forbiddenContentAbsent: forbidden,
    },
    null,
    2,
  ),
);

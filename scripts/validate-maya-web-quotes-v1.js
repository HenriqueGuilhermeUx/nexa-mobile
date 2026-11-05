const fs = require('fs');
const assert = require('assert');
const vm = require('vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/mayaWebActionContracts.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const compiledExports = {};
vm.runInNewContext(compiled.outputText, { exports: compiledExports, URL, Date, Number, Error });
const { createPriceComparisonDraft, comparableTotal, isPlausiblePublicOffer } = compiledExports;
const request = createPriceComparisonDraft('Notebook leve com 16 GB de RAM', 3000);
assert.strictEqual(request.mode, 'read_only');
assert.strictEqual(request.intent, 'price_comparison');
assert.strictEqual(request.budgetBrl, 3000);
assert.throws(() => createPriceComparisonDraft('x'));
assert.throws(() => createPriceComparisonDraft('Notebook com frete incluso', -100));
const q = {
  merchant: 'Loja de testes', product: 'Notebook',
  url: 'https://example.com/produtos/notebook',
  observedAt: new Date().toISOString(),
  currency: 'BRL', itemPrice: 2000, shippingPrice: 45, taxes: 5,
  availability: 'available'
};
assert.strictEqual(comparableTotal(q), 2050);
assert.strictEqual(comparableTotal({ ...q, shippingPrice: undefined }), null);
assert.strictEqual(comparableTotal({ ...q, availability: 'unconfirmed' }), null);
assert.strictEqual(comparableTotal({ ...q, currency: 'USD' }), null);
assert.strictEqual(isPlausiblePublicOffer(q), true);
assert.strictEqual(isPlausiblePublicOffer({ ...q, url: 'http://example.com' }), false);
assert.strictEqual(isPlausiblePublicOffer({ ...q, url: 'https://localhost/foo' }), false);
assert.strictEqual(isPlausiblePublicOffer({ ...q, url: 'https://127.0.0.1/foo' }), false);
assert.strictEqual(isPlausiblePublicOffer({ ...q, observedAt: '2020-01-01T00:00:00Z' }), false);
console.log('PASS Maya Web Actions 09: only read-only drafts and auditable comparable quotes');

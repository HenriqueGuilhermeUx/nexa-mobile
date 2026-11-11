const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function loadTs(path, requireFn) {
  const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: requireFn, Date, Number, Error, URL });
  return exports;
}
const contracts = loadTs('src/lib/mayaWebActionContracts.ts', () => { throw Error('Unexpected import'); });
const {rankVerifiedQuotes} = loadTs('src/maya-actions/verifiedQuoteComparison.ts', (name) => {
  assert.equal(name, '../lib/mayaWebActionContracts');
  return contracts;
});
const now = Date.parse('2026-11-08T12:00:00Z');
const quote = (merchant, itemPrice, extras = {}) => ({
  merchant, product: 'Notebook 16GB', url: 'https://example.com/notebook',
  observedAt: new Date(now - 1000).toISOString(), currency: 'BRL',
  itemPrice, shippingPrice: 20, taxes: 5, availability: 'available', ...extras
});
const result = rankVerifiedQuotes([
  quote('B', 130), quote('A', 100), quote('C', 40, {shippingPrice: undefined}),
  quote('D', 10, {url: 'http://example.com/notebook'}),
  quote('E', 20, {observedAt: '2020-01-01T00:00:00Z'}),
  quote('F', 80, {availability: 'unconfirmed'})
], 135, now);
assert.equal(result.ranked.length, 2);
assert.deepEqual(Array.from(result.ranked, item => item.quote.merchant), ['A', 'B']);
assert.deepEqual(Array.from(result.ranked, item => item.totalBrl), [125, 155]);
assert.deepEqual(Array.from(result.ranked, item => item.withinBudget), [true, false]);
assert.equal(result.excluded.length, 4);
assert.equal(result.evaluatedAt, '2026-11-08T12:00:00.000Z');
assert.throws(() => rankVerifiedQuotes(null, undefined, now), /Lote de ofertas inválido/);
const malformed = rankVerifiedQuotes([null, {}, quote('Valid', 100), { ...quote('Bad', 10), merchant: null }], undefined, now);
assert.deepEqual(Array.from(malformed.ranked, item => item.quote.merchant), ['Valid']);
assert.deepEqual(Array.from(malformed.excluded, item => item.index), [0, 1, 3]);
const overflow = rankVerifiedQuotes([
  quote('Overflow', Number.MAX_VALUE, {shippingPrice: Number.MAX_VALUE, taxes: 0}),
  quote('Finite', 100)
], undefined, now);
assert.deepEqual(Array.from(overflow.ranked, item => item.quote.merchant), ['Finite']);
assert.deepEqual(Array.from(overflow.excluded, item => item.index), [0]);
assert.equal(overflow.excluded[0].reason, 'incomplete_total');
assert.throws(() => rankVerifiedQuotes([], -1, now));
assert.throws(() => rankVerifiedQuotes(Array(101).fill(quote('X', 5)), undefined, now));
console.log('PASS Maya 09C: comparable costs only, stale/unsafe excluded, budget, stable ranking');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const modules = {};
function load(path) {
  if (modules[path]) return modules[path];
  const exports = {};
  modules[path] = exports;
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(code, {
    exports, URL, Date, Number, Map, Error,
    require: ref => {
      if (ref === '../lib/mayaWebActionContracts') return load('src/lib/mayaWebActionContracts.ts');
      if (ref === './verifiedQuoteComparison') return load('src/maya-actions/verifiedQuoteComparison.ts');
      throw Error('Unexpected dependency: ' + ref);
    },
  });
  return exports;
}
const {compareEvidenceBackedQuotes, hasQuoteEvidence} = load('src/maya-actions/quoteEvidence.ts');
const now = Date.parse('2026-11-08T12:00:00Z');
function item(productKey, price, extra = {}) {
  return {
    quote: {
      merchant: 'Loja', product: productKey, url: 'https://loja.example/produto',
      observedAt: new Date(now - 10000).toISOString(), currency: 'BRL',
      itemPrice: price, shippingPrice: 10, taxes: 5, availability: 'available',
      ...(extra.quote || {}),
    },
    evidence: {
      sourceId: 'provider:123', retrievalId: 'request:123',
      sourceUrl: 'https://loja.example/produto', productKey,
      fetchedAt: new Date(now - 5000).toISOString(), ...(extra.evidence || {}),
    },
  };
}
const group = compareEvidenceBackedQuotes([
  item('notebook-8gb', 3000), item('notebook-16gb', 3800), item('notebook-8gb', 2700),
  item('notebook-8gb', 1200, {evidence: {sourceUrl: 'https://other.example/fake'}}),
  item('notebook-8gb', 100, {evidence: {fetchedAt: '2020-01-01T00:00:00Z'}})
], 3000, now);
assert.deepEqual(Array.from(group.groups, g => g.productKey), ['notebook-16gb', 'notebook-8gb']);
assert.deepEqual(Array.from(group.groups[1].comparison.ranked, r => r.totalBrl), [2715, 3015]);
assert.deepEqual(Array.from(group.rejectedIndices), [3, 4]);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceId: ''}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceUrl: 'http://loja.example/produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {quote: {observedAt: new Date(now + 5000).toISOString()}}), now), false);
console.log('PASS Maya 09C evidence: distinct variants, source freshness, merchant-host consistency');

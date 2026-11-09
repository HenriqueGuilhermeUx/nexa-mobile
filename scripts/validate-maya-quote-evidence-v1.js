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
      merchant: 'Loja', product: productKey, url: 'https://loja.com/produto',
      observedAt: new Date(now - 10000).toISOString(), currency: 'BRL',
      itemPrice: price, shippingPrice: 10, taxes: 5, availability: 'available',
      ...(extra.quote || {}),
    },
    evidence: {
      sourceId: 'provider:123', retrievalId: 'request:123',
      sourceUrl: 'https://loja.com/produto', productKey,
      fetchedAt: new Date(now - 5000).toISOString(), ...(extra.evidence || {}),
    },
  };
}
const group = compareEvidenceBackedQuotes([
  item('notebook-8gb', 3000), item('notebook-16gb', 3800), item('notebook-8gb', 2700),
  item('notebook-8gb', 1200, {evidence: {sourceUrl: 'https://other.com/fake'}}),
  item('notebook-8gb', 100, {evidence: {fetchedAt: '2020-01-01T00:00:00Z'}})
], 3000, now);
assert.deepEqual(Array.from(group.groups, g => g.productKey), ['notebook-16gb', 'notebook-8gb']);
assert.deepEqual(Array.from(group.groups[1].comparison.ranked, r => r.totalBrl), [2715, 3015]);
assert.deepEqual(Array.from(group.rejectedIndices), [3, 4]);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceId: ''}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceUrl: 'http://loja.com/produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {quote: {observedAt: new Date(now + 5000).toISOString()}}), now), false);
// Boundary and tampering regressions: evidence must not be treated as verified
// when its retrieval time is outside the freshness window or variant is absent.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {fetchedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString()}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {productKey: ''}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {retrievalId: ''}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {quote: {observedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString()}}), now), false);
// Unsafe provenance URLs and inconsistent chronology must fail closed.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceUrl: 'https://user:secret@loja.com/produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceUrl: 'https://127.0.0.1/produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceUrl: 'https://loja.com:8443/produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {fetchedAt: new Date(now + 1000).toISOString()}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {fetchedAt: 'not-a-date'}}), now), false);
// Merchant offer URLs must also be public HTTPS, not merely host-matched to evidence.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {quote: {url: 'https://user:secret@loja.com/produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {quote: {url: 'https://loja.com:8443/produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {quote: {url: 'https://127.0.0.1/produto'}, evidence: {sourceUrl: 'https://127.0.0.1/produto'}}), now), false);
// Trailing-dot DNS names must not bypass the public-host guard.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceUrl: 'https://localhost./produto'}, quote: {url: 'https://localhost./produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {evidence: {sourceUrl: 'https://loja.local./produto'}, quote: {url: 'https://loja.local./produto'}}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {quote: {url: 'https://loja.com./produto'}, evidence: {sourceUrl: 'https://loja.com./produto'}}), now), false);
// Reserved DNS suffixes are not public merchant endpoints, even over HTTPS.
for (const suffix of ['internal', 'test', 'invalid']) {
  const url = `https://merchant.${suffix}/produto`;
  assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
    quote: {url}, evidence: {sourceUrl: url}
  }), now), false);
}
// Reserved documentation and anonymous-network suffixes are not verified public merchants.
for (const suffix of ['example', 'onion']) {
  const url = `https://merchant.${suffix}/produto`;
  assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
    quote: {url}, evidence: {sourceUrl: url}
  }), now), false);
}
// Invalid evaluation clocks must not bypass freshness checks.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100), Number.NaN), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100), Number.POSITIVE_INFINITY), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100), -1), false);
// Exact freshness boundaries: just inside 24h is valid; exactly 24h is not.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
  quote: {observedAt: new Date(now - 24 * 60 * 60 * 1000 + 1).toISOString()},
  evidence: {fetchedAt: new Date(now - 24 * 60 * 60 * 1000 + 1).toISOString()}
}), now), true);
// Retrieval cannot precede observation, even when both timestamps are recent.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
  quote: {observedAt: new Date(now - 1000).toISOString()},
  evidence: {fetchedAt: new Date(now - 2000).toISOString()}
}), now), false);
// One hour between observation and retrieval is accepted; one extra ms is rejected.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
  quote: {observedAt: new Date(now - 60 * 60 * 1000 - 5000).toISOString()}
}), now), true);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
  quote: {observedAt: new Date(now - 60 * 60 * 1000 - 5001).toISOString()}
}), now), false);
// Host equality is exact: a sibling or lookalike subdomain is not the same merchant.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
  evidence: {sourceUrl: 'https://ofertas.loja.com/produto'}
}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
  evidence: {sourceUrl: 'https://loja.com.evil.org/produto'}
}), now), false);
// Provenance identifiers must be bounded, structured and not arbitrary strings.
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
  evidence: {sourceId: 'provider with spaces'}
}), now), false);
assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
  evidence: {retrievalId: 'x'.repeat(121)}
}), now), false);
// Comparison batches must be bounded even when every individual quote is valid.
assert.deepEqual(Array.from(compareEvidenceBackedQuotes([], 3000, now).groups), []);
assert.deepEqual(Array.from(compareEvidenceBackedQuotes([], 3000, now).rejectedIndices), []);
assert.equal(compareEvidenceBackedQuotes(Array(100).fill(item('notebook-8gb', 100)), 3000, now).groups.length, 1);
assert.throws(() => compareEvidenceBackedQuotes(Array(101).fill(item('notebook-8gb', 100)), 3000, now), /100 ofertas/);
// URL constructor normalizes tabs/newlines; raw evidence must be rejected before parsing.
for (const control of [String.fromCharCode(10), String.fromCharCode(9), String.fromCharCode(13), ' ']) {
  const url = control === ' ' ? ' https://loja.com/produto' : 'https://loja.com/prod' + control + 'uto';
  assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
    quote: {url}, evidence: {sourceUrl: url}
  }), now), false);
}
// WHATWG URL may trim Unicode whitespace; never accept normalized untrusted URLs.
for (const whitespace of ['\u00a0', '\u2028', '\u2029', '\u2003']) {
  const url = whitespace + 'https://loja.com/produto';
  assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
    quote: {url}, evidence: {sourceUrl: url}
  }), now), false);
}
// Budget validation must fail closed before presenting a ranked comparison.
for (const budget of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1000001]) {
  assert.throws(() => compareEvidenceBackedQuotes([item('notebook-8gb', 100)], budget, now), /Orçamento inválido/);
}
// At the exact approved ceiling, the same verified quote remains comparable.
assert.equal(compareEvidenceBackedQuotes([item('notebook-8gb', 100)], 1000000, now).groups[0].comparison.ranked.length, 1);
// Invalid evaluation inputs must fail closed even when no offer survives evidence screening.
for (const budget of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1000001]) {
  assert.throws(() => compareEvidenceBackedQuotes([], budget, now), /Orçamento inválido/);
}
for (const clock of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
  assert.throws(() => compareEvidenceBackedQuotes([], 3000, clock), /Horário de avaliação inválido/);
}
assert.deepEqual(Array.from(compareEvidenceBackedQuotes([], 1000000, now).groups), []);
// Malformed backend payloads must fail with a controlled validation error, not a runtime crash.
for (const batch of [null, undefined, {}, 'not-an-array']) {
  assert.throws(() => compareEvidenceBackedQuotes(batch, 3000, now), /Lote de ofertas inválido/);
}
// Backend timestamps must be strings; coercible objects and symbols cannot count as evidence.
for (const malformed of [null, 123, {}, Symbol('timestamp')]) {
  assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
    evidence: {fetchedAt: malformed}
  }), now), false);
  assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
    quote: {observedAt: malformed}
  }), now), false);
}
// Malformed provenance identifiers (including Symbol) must fail closed without throwing.
for (const malformed of [null, 123, {}, Symbol('identifier')]) {
  for (const field of ['sourceId', 'retrievalId', 'productKey']) {
    assert.equal(hasQuoteEvidence(item('notebook-8gb', 100, {
      evidence: {[field]: malformed}
    }), now), false);
  }
}
// Untrusted backend batches can contain missing envelopes; reject only bad entries.
for (const malformed of [null, undefined, {}, {quote: null}, {evidence: null}, {quote: {}}, {evidence: {}}]) {
  assert.equal(hasQuoteEvidence(malformed, now), false);
  const mixed = compareEvidenceBackedQuotes([item('notebook-8gb', 100), malformed], 3000, now);
  assert.deepEqual(Array.from(mixed.rejectedIndices), [1]);
  assert.equal(mixed.groups.length, 1);
}
console.log('PASS Maya 09C evidence: distinct variants, source freshness, merchant-host consistency');

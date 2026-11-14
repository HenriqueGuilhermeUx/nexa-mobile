#!/usr/bin/env node
// Offline regression checks for QA A evidence gate; synthetic evidence only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const gate = path.join(__dirname, 'maya-actions-wave-a-evidence-gate.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-qa-a-'));
const base = {
  candidateSha: '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e',
  runtime: '2.0.43',
  packageId: 'br.com.trynexa.app',
  easBranch: 'maya-actions-v148-qa',
  androidUpdateId: '01a1a975-d85f-794f-9d67-cf2ac961fbb7',
  cases: Array.from({length: 16}, (_, i) => ({
    id: 'A' + String(i + 1).padStart(2, '0'),
    status: 'PASS', evidenceRef: 'synthetic-' + i,
    testedAt: '2026-11-06T12:00:00Z', device: 'synthetic-android'
  }))
};
function run(data) {
  const file = path.join(dir, 'evidence.json');
  fs.writeFileSync(file, JSON.stringify(data));
  return spawnSync(process.execPath, [gate, file], {encoding: 'utf8'});
}
try {
  assert.equal(run(base).status, 0, 'complete synthetic manifest should parse');
  for (const validTimestamp of ['2026-11-06T12:00:00Z', '2026-11-06T09:00:00-03:00', '2026-11-06T12:00:00.123Z', '2026-11-06T12:00:00+14:00', '2026-11-06T12:00:00-14:00']) {
    const data = structuredClone(base);
    data.cases[0].testedAt = validTimestamp;
    assert.equal(run(data).status, 0, 'valid ISO timestamp must pass: ' + validTimestamp);
  }
  for (const invalidTimestamp of ['2026-11-06T25:00:00Z', '2026-11-06T12:60:00Z', '2026-11-06T12:00:60Z', '2026-11-06T12:00:00+15:00', '2026-11-06T12:00:00+14:01', '2026-11-06T12:00:00-14:30', '2026-11-06T12:00:00+00:60', '2026-11-06T24:00:00Z', '2026-11-06T12:00:00.1234Z']) {
    const data = structuredClone(base);
    data.cases[0].testedAt = invalidTimestamp;
    assert.equal(run(data).status, 1, 'invalid clock or UTC offset must fail: ' + invalidTimestamp);
  }
  for (const invalid of [null, [], 'not-a-manifest', 0, true]) {
    const result = run(invalid);
    assert.equal(result.status, 1, 'non-object manifest must fail closed: ' + JSON.stringify(invalid));
    assert.match(result.stderr, /NO-GO/, 'failure must be explicit');
  }
  for (const timestamp of ['2026-11-06T', 'invalid', '2026-99-99T12:00:00Z', '2026-02-30T12:00:00Z', '2026-04-31T12:00:00Z', '2025-02-29T12:00:00Z', '2099-01-01T00:00:00Z']) {
    const data = structuredClone(base);
    data.cases[0].testedAt = timestamp;
    assert.equal(run(data).status, 1, 'must reject timestamp: ' + timestamp);
  }
  const leap = structuredClone(base);
  leap.cases[0].testedAt = '2024-02-29T12:00:00Z';
  assert.equal(run(leap).status, 1, 'pre-candidate leap date must be rejected');
  // Guardrails: no approval from an incomplete or mismatched QA manifest.
  for (const [field, value] of [
    ['candidateSha', 'f341f01787f50eaa13b363dc8a57b17da1fe5044'],
    ['runtime', '2.0.42'],
    ['packageId', 'br.com.trynexa.mayaqa'],
    ['easBranch', 'maya-actions-v148-qa-wave-b'],
    ['androidUpdateId', '01a1a97d-d9f7-7be1-aed3-229ce41d2128']
  ]) {
    const data = structuredClone(base);
    data[field] = value;
    assert.equal(run(data).status, 1, 'must reject mismatched ' + field);
  }
  const unknown = structuredClone(base);
  unknown.cases.push({ ...unknown.cases[0], id: 'A17' });
  assert.equal(run(unknown).status, 1, 'unknown case must fail');
  const deviceMissing = structuredClone(base);
  deviceMissing.cases[0].device = '  ';
  assert.equal(run(deviceMissing).status, 1, 'missing device must fail');
  for (const badDevice of ['Android\nspoofed', 'Android\tspoofed', 'Android\u0000spoofed', 'Android\u007fspoofed', 'X'.repeat(161)]) {
    const data = structuredClone(base);
    data.cases[0].device = badDevice;
    assert.equal(run(data).status, 1, 'unsafe device metadata must fail');
  }
  const notPassed = structuredClone(base);
  notPassed.cases[0].status = 'PENDING';
  assert.equal(run(notPassed).status, 1, 'pending physical test must fail');
  const duplicate = structuredClone(base);
  duplicate.cases[1].id = 'A01';
  assert.equal(run(duplicate).status, 1, 'duplicate/missing case must fail');
  const reused = structuredClone(base);
  reused.cases[1].evidenceRef = reused.cases[0].evidenceRef;
  assert.equal(run(reused).status, 1, 'reused evidence reference must fail');
  // Do not silently normalize padded audit references; the recorded proof ID must match exactly.
  for (const padded of [' qa/proof-A01', 'qa/proof-A01 ', '\\tqa/proof-A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = padded;
    assert.equal(run(data).status, 1, 'padded evidence reference must fail');
  }
  const reusedWhitespace = structuredClone(base);
  reusedWhitespace.cases[1].evidenceRef = ' ' + reusedWhitespace.cases[0].evidenceRef + ' ';
  assert.equal(run(reusedWhitespace).status, 1, 'whitespace cannot bypass evidence uniqueness');
  for (const badRef of ['evidence\nspoofed', 'evidence\tspoofed', 'evidence\u0000spoofed', 'evidence\u007fspoofed']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = badRef;
    assert.equal(run(data).status, 1, 'control characters in evidence reference must fail');
  }
  // Unicode format controls can invisibly alter or spoof an audit reference.
  for (const invisible of [0x200b, 0x200d, 0x202e, 0xfeff].map(cp => String.fromCodePoint(cp))) {
    const ref = structuredClone(base);
    ref.cases[0].evidenceRef = 'proof' + invisible + '1';
    assert.equal(run(ref).status, 1, 'invisible Unicode in evidence must fail');
    const device = structuredClone(base);
    device.cases[0].device = 'Android' + invisible + 'QA';
    assert.equal(run(device).status, 1, 'invisible Unicode in device must fail');
  }
  // Unicode line/paragraph separators are not Cf, but still split audit log lines.
  for (const separator of [0x2028, 0x2029].map(cp => String.fromCodePoint(cp))) {
    const ref = structuredClone(base);
    ref.cases[0].evidenceRef = 'proof' + separator + '1';
    assert.equal(run(ref).status, 1, 'Unicode line separator in evidence must fail');
    const device = structuredClone(base);
    device.cases[0].device = 'Android' + separator + 'QA';
    assert.equal(run(device).status, 1, 'Unicode line separator in device must fail');
  }
  // Non-breaking and typographic Unicode spaces can spoof otherwise distinct audit metadata.
  for (const spacing of [0x00a0, 0x2007, 0x202f, 0x3000].map(cp => String.fromCodePoint(cp))) {
    const ref = structuredClone(base);
    ref.cases[0].evidenceRef = 'proof' + spacing + 'A01';
    assert.equal(run(ref).status, 1, 'nonstandard Unicode spacing in evidence must fail');
    const device = structuredClone(base);
    device.cases[0].device = 'Android' + spacing + 'QA';
    assert.equal(run(device).status, 1, 'nonstandard Unicode spacing in device must fail');
  }
  const canonicallyEquivalent = structuredClone(base);
  canonicallyEquivalent.cases[0].evidenceRef = 'prova-\u00e9';
  canonicallyEquivalent.cases[1].evidenceRef = 'prova-e\u0301';
  assert.equal(run(canonicallyEquivalent).status, 1, 'NFC-equivalent references must not count as distinct evidence');
  const distinctAccents = structuredClone(base);
  distinctAccents.cases[0].evidenceRef = 'prova-e';
  distinctAccents.cases[1].evidenceRef = 'prova-\u00e9';
  assert.equal(run(distinctAccents).status, 0, 'genuinely distinct Unicode references must remain valid');
  const maxRef = structuredClone(base);
  maxRef.cases[0].evidenceRef = 'E'.repeat(512);
  assert.equal(run(maxRef).status, 0, 'bounded 512-character evidence reference must pass');
  const oversizedRef = structuredClone(base);
  oversizedRef.cases[0].evidenceRef = 'E'.repeat(513);
  assert.equal(run(oversizedRef).status, 1, 'oversized evidence reference must fail');
  for (const unsafeUrl of ['https://user:secret@example.test/evidence', 'https://user@example.test/evidence', 'https://%ZZ@example.test/evidence']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = unsafeUrl;
    assert.equal(run(data).status, 1, 'credential-bearing or malformed evidence URL must fail');
  }
  // URLs with query/fragment may leak signed access tokens or unstable viewer state into audit trails.
  for (const urlWithSecretOrFragment of [
    'https://example.test/private/evidence/A01?token=synthetic',
    'https://example.test/private/evidence/A01#view',
    'https://example.test/private/evidence/A01?',
    'https://example.test/private/evidence/A01#'
  ]) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = urlWithSecretOrFragment;
    assert.equal(run(data).status, 1, 'query/fragment evidence URL must fail: ' + urlWithSecretOrFragment);
  }
  // Loopback HTTPS URLs cannot independently substantiate a QA device run.
  for (const loopbackUrl of ['https://localhost/evidence/A01', 'https://127.0.0.1/evidence/A01', 'https://[::1]/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = loopbackUrl;
    assert.equal(run(data).status, 1, 'loopback evidence URL must fail: ' + loopbackUrl);
  }
  // Private-network HTTPS links are not stable remote audit evidence, even with TLS.
  for (const privateUrl of ['https://10.0.0.5/evidence/A01', 'https://172.16.0.1/evidence/A01', 'https://172.31.255.254/evidence/A01', 'https://192.168.1.1/evidence/A01', 'https://169.254.1.2/evidence/A01', 'https://qa.local/evidence/A01', 'https://proof.internal/evidence/A01', 'https://app.localhost/evidence/A01', 'https://localhost./evidence/A01', 'https://app.localhost./evidence/A01', 'https://qa.local./evidence/A01', 'https://proof.internal./evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = privateUrl;
    assert.equal(run(data).status, 1, 'private-network evidence URL must fail: ' + privateUrl);
  }
  // CGNAT 100.64.0.0/10 is shared carrier space, not independently reachable proof hosting.
  for (const cgnatUrl of ['https://100.64.0.1/evidence/A01', 'https://100.127.255.254/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = cgnatUrl;
    assert.equal(run(data).status, 1, 'CGNAT evidence URL must fail: ' + cgnatUrl);
  }
  for (const outsideCgnat of ['https://100.63.255.255/evidence/A01', 'https://100.128.0.1/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = outsideCgnat;
    assert.equal(run(data).status, 0, 'adjacent IPv4 addresses remain syntactically admissible');
  }
  // IPv6 private and link-local ranges must not be treated as public evidence endpoints.
  for (const privateIpv6Url of ['https://[fc00::1]/evidence/A01', 'https://[fd12:3456::1]/evidence/A01', 'https://[fe80::1]/evidence/A01', 'https://[febf::1]/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = privateIpv6Url;
    assert.equal(run(data).status, 1, 'private IPv6 evidence URL must fail: ' + privateIpv6Url);
  }
  // The unspecified IPv6 address is not a reachable evidence endpoint.
  const unspecifiedIpv6 = structuredClone(base);
  unspecifiedIpv6.cases[0].evidenceRef = 'https://[::]/evidence/A01';
  assert.equal(run(unspecifiedIpv6).status, 1, 'unspecified IPv6 evidence URL must fail');
  // IPv4-mapped IPv6 must not bypass the private/loopback network restriction.
  for (const mappedPrivate of ['https://[::ffff:127.0.0.1]/evidence/A01', 'https://[::ffff:10.1.2.3]/evidence/A01', 'https://[::ffff:192.168.1.1]/evidence/A01', 'https://[::ffff:169.254.1.1]/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = mappedPrivate;
    assert.equal(run(data).status, 1, 'private mapped IPv4 evidence must fail: ' + mappedPrivate);
  }
  const mappedPublic = structuredClone(base);
  mappedPublic.cases[0].evidenceRef = 'https://[::ffff:8.8.8.8]/evidence/A01';
  assert.equal(run(mappedPublic).status, 0, 'public mapped IPv4 reference remains syntactically valid');
  for (const publicIpv6Url of ['https://[2001:4860::1]/evidence/A01', 'https://[fec0::1]/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = publicIpv6Url;
    assert.equal(run(data).status, 0, 'non-private IPv6 reference must remain syntactically valid');
  }
  for (const publicUrl of ['https://172.32.0.1/evidence/A01', 'https://192.169.1.1/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = publicUrl;
    assert.equal(run(data).status, 0, 'public IPv4 evidence URL must remain syntactically valid');
  }
  const insecureUrl = structuredClone(base);
  insecureUrl.cases[0].evidenceRef = 'http://example.test/private/evidence/A01';
  assert.equal(run(insecureUrl).status, 1, 'remote evidence references must use HTTPS');
  // Remote evidence cannot bypass transport checks with a non-HTTP URI scheme.
  for (const unsafeScheme of ['ftp://example.test/evidence/A01', 'file:///tmp/evidence/A01', 'ws://example.test/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = unsafeScheme;
    assert.equal(run(data).status, 1, 'remote evidence must reject unsupported URI scheme: ' + unsafeScheme);
  }
  for (const protocolRelative of ['//example.test/evidence/A01', '  //example.test/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = protocolRelative;
    assert.equal(run(data).status, 1, 'protocol-relative evidence must fail closed');
  }
  // Opaque schemes have no // delimiter; they must not masquerade as local audit IDs.
  for (const opaqueScheme of ['javascript:alert(1)', 'data:text/plain,proof', 'mailto:qa@example.test', 'urn:qa:evidence:A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = opaqueScheme;
    assert.equal(run(data).status, 1, 'opaque URI scheme must fail closed: ' + opaqueScheme);
  }
  // WHATWG URL parsing may normalize backslashes into slashes; audit refs must remain unambiguous.
  for (const ambiguousRef of ['https:\\example.test/evidence/A01', 'https:\\\\example.test/evidence/A01', 'qa\\proof-A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = ambiguousRef;
    assert.equal(run(data).status, 1, 'backslash in evidence reference must fail closed');
  }
  // WHATWG URL accepts scheme-without-authority forms; audit URLs must be explicit HTTPS://.
  for (const ambiguousHttps of ['https:example.test/evidence/A01', 'https:/example.test/evidence/A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = ambiguousHttps;
    assert.equal(run(data).status, 1, 'HTTPS evidence must include explicit // authority');
  }
  // Absolute paths must not be accepted as private relative evidence IDs.
  for (const absoluteRef of ['/tmp/private/A01', '/qa/a01/proof', '/']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = absoluteRef;
    assert.equal(run(data).status, 1, 'absolute local evidence path must fail: ' + absoluteRef);
  }
  // Do not allow local audit references to escape their evidence directory.
  for (const traversal of ['../private/A01', 'qa/../../private/A01', './qa-proof-A01', 'qa/./proof-A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = traversal;
    assert.equal(run(data).status, 1, 'dot-segment local evidence reference must fail: ' + traversal);
  }
  for (const encodedTraversal of ['%2e%2e/private/A01', 'qa/%2E%2E/private/A01', 'qa/.%2e/private/A01', 'qa/%2e./private/A01', '%2e/qa-proof-A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = encodedTraversal;
    assert.equal(run(data).status, 1, 'encoded dot segment must fail: ' + encodedTraversal);
  }
  // Encoded slashes/backslashes can conceal path segments when decoded downstream.
  for (const encodedSeparator of ['qa%2f..%2fprivate/A01', 'qa%2Fproof-A01', 'qa%5c..%5cprivate/A01', 'qa%5Cproof-A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = encodedSeparator;
    assert.equal(run(data).status, 1, 'encoded path separator must fail: ' + encodedSeparator);
  }
  // A second URL decode can turn %252e%252e or %252f into traversal separators.
  for (const doubleEncoded of ['qa/%252e%252e/private/A01', 'qa%252f..%252fprivate/A01', 'qa%255c..%255cprivate/A01', 'qa/%25proof-A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = doubleEncoded;
    assert.equal(run(data).status, 1, 'double-encoded evidence must fail: ' + doubleEncoded);
  }
  // Invalid percent escapes must not be accepted as local audit IDs.
  for (const malformedPercent of ['qa/proof%G01', 'qa/proof%', 'qa/proof%2', 'qa/proof%GG']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = malformedPercent;
    assert.equal(run(data).status, 1, 'malformed percent escape must fail: ' + malformedPercent);
  }
  const harmlessPercent = structuredClone(base);
  harmlessPercent.cases[0].evidenceRef = 'qa/proof%20A01';
  assert.equal(run(harmlessPercent).status, 0, 'non-traversal percent-encoded reference remains valid');
  // Empty local path segments must fail, without rejecting explicit HTTPS proof URLs.
  for (const emptySegment of ['qa//proof-A01', 'qa/proof-A01/', 'qa///proof-A01']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = emptySegment;
    assert.equal(run(data).status, 1, 'ambiguous empty local path segment must fail: ' + emptySegment);
  }
  // A local audit ID with ? or # can be silently truncated by a URL-based evidence viewer.
  for (const ambiguousLocal of ['qa/proof-A01?token=synthetic', 'qa/proof-A01#fragment', 'qa/proof-A01?', 'qa/proof-A01#']) {
    const data = structuredClone(base);
    data.cases[0].evidenceRef = ambiguousLocal;
    assert.equal(run(data).status, 1, 'local query/fragment delimiter must fail: ' + ambiguousLocal);
  }
  const nestedLocal = structuredClone(base);
  nestedLocal.cases[0].evidenceRef = 'qa/a01/proof';
  assert.equal(run(nestedLocal).status, 0, 'safe nested local audit reference must remain valid');
  const localAuditId = structuredClone(base);
  localAuditId.cases[0].evidenceRef = 'qa-a-local-proof-A01';
  assert.equal(run(localAuditId).status, 0, 'scheme-free local evidence ID must remain valid');
  const safeUrl = structuredClone(base);
  safeUrl.cases[0].evidenceRef = 'https://example.test/private/evidence/A01';
  assert.equal(run(safeUrl).status, 0, 'credential-free evidence URL must remain valid');
  const missing = structuredClone(base);
  missing.cases[0].evidenceRef = '';
  assert.equal(run(missing).status, 1, 'missing evidence must fail');
  console.log('PASS: QA A gate synthetic regression checks; no physical QA asserted');
} finally {
  fs.rmSync(dir, {recursive: true, force: true});
}

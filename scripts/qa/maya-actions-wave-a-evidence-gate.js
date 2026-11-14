#!/usr/bin/env node
// QA A evidence gate: offline only; never contacts EAS, GitHub or production.
// Usage: node scripts/qa/maya-actions-wave-a-evidence-gate.js path/to/private-redacted-evidence.json
// Expected JSON: { candidateSha, runtime, packageId, cases: [{ id, status, evidenceRef }] }
// Do not commit evidence containing credentials, customer identifiers or financial data.
const fs = require('node:fs');
const ids = Array.from({ length: 16 }, (_, i) => 'A' + String(i + 1).padStart(2, '0'));
const file = process.argv[2];
// Date.parse normalizes impossible calendar dates in some runtimes (e.g. February 30).
function validClockAndOffset(timestamp) {
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(timestamp);
  if (!match) return false;
  const hour = Number(match[1]), minute = Number(match[2]), second = Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[4] !== 'Z') {
    const offsetHour = Number(match[6]), offsetMinute = Number(match[7]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return true;
}
function validCalendarDate(timestamp) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(timestamp);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}
if (!file) {
  console.error('BLOCKED: provide a local, redacted evidence JSON path. No device approval inferred.');
  process.exit(2);
}
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch { console.error('BLOCKED: evidence file missing or invalid JSON'); process.exit(2); }
if (data === null || typeof data !== 'object' || Array.isArray(data)) {
  console.error('NO-GO: evidence manifest must be a JSON object');
  process.exit(1);
}
const failures = [];
if (data.candidateSha !== '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e') failures.push('candidate SHA mismatch');
if (data.runtime !== '2.0.43') failures.push('runtime mismatch');
// EAS OTA QA A is delivered to the official app identity on a QA-enabled binary.
// A standalone may be useful for feature QA, but cannot prove receipt of this EAS update.
if (data.packageId !== 'br.com.trynexa.app') failures.push('EAS QA app package mismatch (standalone APK is not OTA evidence)');
// Bind the manifest to the frozen QA A EAS update; an arbitrary QA or production OTA is not evidence for this candidate.
if (data.easBranch !== 'maya-actions-v148-qa') failures.push('QA EAS branch mismatch');
if (data.androidUpdateId !== '01a1a975-d85f-794f-9d67-cf2ac961fbb7') failures.push('QA Android update mismatch');
if (!Array.isArray(data.cases)) failures.push('cases must be an array');
const cases = Array.isArray(data.cases) ? data.cases : [];
for (const id of ids) {
  const matches = cases.filter(c => c && c.id === id);
  if (matches.length !== 1) { failures.push(id + ': missing or duplicate'); continue; }
  const c = matches[0];
  if (c.status !== 'PASS') failures.push(id + ': not PASS');
  if (typeof c.evidenceRef !== 'string' || !c.evidenceRef.trim()) failures.push(id + ': evidence reference missing');
  // Reject control characters that can corrupt audit logs or conceal a reused reference.
  if (typeof c.evidenceRef === 'string' && /[\x00-\x1f\x7f\u2028\u2029\p{Cf}\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/u.test(c.evidenceRef)) failures.push(id + ': evidence reference contains control characters');
  if (typeof c.evidenceRef === 'string' && c.evidenceRef.length > 512) failures.push(id + ': evidence reference too long');
  // Audit references must be exact: silently trimming whitespace can conceal incorrect or reused proof IDs.
  if (typeof c.evidenceRef === 'string' && c.evidenceRef !== c.evidenceRef.trim()) failures.push(id + ': evidence reference has surrounding whitespace');
  // Backslashes can be interpreted as URL separators by WHATWG parsers; reject ambiguous audit references.
  if (typeof c.evidenceRef === 'string' && c.evidenceRef.includes('\\')) failures.push(id + ': evidence reference contains backslash');
  // Absolute filesystem paths cannot be treated as private evidence IDs.
  if (typeof c.evidenceRef === 'string' && c.evidenceRef.startsWith('/')) failures.push(id + ': absolute evidence path is not allowed');
  // Repeated or trailing separators create empty path components and ambiguous local proof IDs.
  // HTTPS URLs are parsed separately; this check applies only to scheme-free local references.
  if (typeof c.evidenceRef === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(c.evidenceRef) && c.evidenceRef.split('/').some(part => part === '')) failures.push(id + ': empty local evidence path segment');
  // Local audit IDs must not resolve outside the private evidence directory.
  if (typeof c.evidenceRef === 'string' && c.evidenceRef.split('/').some(part => part === '..' || part === '.')) failures.push(id + ': evidence reference contains path traversal');
  // Percent-encoded dot segments may be decoded by evidence viewers or storage adapters.
  if (typeof c.evidenceRef === 'string' && c.evidenceRef.split('/').some(part => /^(?:\.|%2e){1,2}$/i.test(part) && /%2e/i.test(part))) failures.push(id + ': encoded path traversal is not allowed');
  // Encoded separators can become traversal after a downstream URL decode; fail closed for local IDs.
  if (typeof c.evidenceRef === 'string' && /%(?:2f|5c)/i.test(c.evidenceRef)) failures.push(id + ': encoded path separator is not allowed');
  // Query/fragment delimiters are not stable local audit IDs; downstream viewers may strip them.
  if (typeof c.evidenceRef === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(c.evidenceRef) && /[?#]/.test(c.evidenceRef)) failures.push(id + ': local evidence reference contains query or fragment delimiter');
  // Reject malformed percent escapes: downstream decoders disagree on their interpretation.
  if (typeof c.evidenceRef === 'string' && /%(?![0-9a-f]{2})/i.test(c.evidenceRef)) failures.push(id + ': malformed percent escape in evidence reference');
  // Reject encoded percent signs: a second decoding pass could reveal %2e, %2f or %5c traversal.
  if (typeof c.evidenceRef === 'string' && /%25/i.test(c.evidenceRef)) failures.push(id + ': double-encoded evidence reference is not allowed');
  // Do not allow credentials embedded in private evidence URLs to enter QA audit logs.
  // Protocol-relative URLs inherit an unknown scheme and must never count as auditable evidence.
  if (typeof c.evidenceRef === 'string' && /^\/\//.test(c.evidenceRef.trim())) failures.push(id + ': protocol-relative evidence URL is not allowed');
  // Reject all URI schemes, including opaque javascript:, data: and mailto: references.
  // Only explicit HTTPS URLs or scheme-free local audit IDs are admissible.
  if (typeof c.evidenceRef === 'string' && /^[a-z][a-z0-9+.-]*:/i.test(c.evidenceRef.trim())) {
    try {
      const url = new URL(c.evidenceRef.trim());
      if (!/^https:\/\//i.test(c.evidenceRef.trim())) failures.push(id + ': evidence HTTPS URL must use explicit // authority');
      if (url.protocol !== 'https:') failures.push(id + ': evidence URL must use HTTPS');
      if (url.username || url.password) failures.push(id + ': evidence URL contains credentials');
      // Loopback hosts cannot serve as remotely auditable QA evidence and may point at a tester's private machine.
      if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())) failures.push(id + ': loopback evidence URL is not allowed');
      // Private, link-local and documentation-only network hosts are not independently reachable audit references.
      const host = url.hostname.toLowerCase().replace(/\.$/, ''); // DNS trailing dot is equivalent to the same hostname without it.
      const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)?.slice(1).map(Number);
      // IPv6 ULA (fc00::/7) and link-local (fe80::/10) are not remotely auditable.
      // WHATWG URL.hostname encloses IPv6 literals in brackets.
      const ipv6 = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : null;
      const firstHextet = ipv6 ? parseInt(ipv6.split(':')[0], 16) : NaN;
      const privateIpv6 = ipv6 === '::' || (Number.isFinite(firstHextet) &&
        ((firstHextet & 0xfe00) === 0xfc00 || (firstHextet & 0xffc0) === 0xfe80));
      // IPv4-mapped IPv6 (::ffff:a.b.c.d) can hide loopback/private IPv4 from dotted-host checks.
      // WHATWG URL canonicalizes dotted mapped literals to two hexadecimal hextets.
      const mapped = ipv6 && /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ipv6);
      const mappedOctets = mapped ? [parseInt(mapped[1], 16) >> 8, parseInt(mapped[1], 16) & 255,
        parseInt(mapped[2], 16) >> 8, parseInt(mapped[2], 16) & 255] : null;
      // RFC 5737 TEST-NET addresses are documentation-only and cannot host real device proof.
      const documentationIpv4 = a => a && ((a[0] === 192 && a[1] === 0 && a[2] === 2) ||
        (a[0] === 198 && a[1] === 51 && a[2] === 100) ||
        (a[0] === 203 && a[1] === 0 && a[2] === 113));
      // RFC 3849 2001:db8::/32 is reserved for examples, not evidence hosting.
      const documentationIpv6 = ipv6 && /^2001:0?db8(?::|$)/i.test(ipv6);
      // Multicast (224/4) and limited broadcast (255.255.255.255) cannot host independently auditable HTTPS evidence.
      const nonUnicastIpv4 = a => a && a[0] >= 224;
      const privateMapped = mappedOctets && (mappedOctets[0] === 0 || mappedOctets[0] === 10 || mappedOctets[0] === 127 ||
        (mappedOctets[0] === 172 && mappedOctets[1] >= 16 && mappedOctets[1] <= 31) ||
        (mappedOctets[0] === 192 && mappedOctets[1] === 168) ||
        (mappedOctets[0] === 169 && mappedOctets[1] === 254) ||
        (mappedOctets[0] === 100 && mappedOctets[1] >= 64 && mappedOctets[1] <= 127));
      if (nonUnicastIpv4(octets) || nonUnicastIpv4(mappedOctets) || privateMapped || privateIpv6 || documentationIpv6 || documentationIpv4(octets) || documentationIpv4(mappedOctets) || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') ||
          (octets && (octets[0] === 10 || octets[0] === 0 || octets[0] === 127 ||
          (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
          (octets[0] === 192 && octets[1] === 168) ||
          (octets[0] === 169 && octets[1] === 254) ||
          (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)))) failures.push(id + ': private-network evidence URL is not allowed');
      // Query strings and fragments may carry access tokens or mutable viewer state; store a stable proof URL only.
      if (url.search || url.hash || /[?#]/.test(c.evidenceRef)) failures.push(id + ': evidence URL must not contain query or fragment');
    } catch { failures.push(id + ': malformed evidence URL'); }
  }
  if (typeof c.testedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(c.testedAt) ||
      !Number.isFinite(Date.parse(c.testedAt)) ||
      !validCalendarDate(c.testedAt) ||
      !validClockAndOffset(c.testedAt) ||
      new Date(Date.parse(c.testedAt)).toISOString().slice(0, 10) < '2026-11-04' ||
      Date.parse(c.testedAt) > Date.now()) failures.push(id + ': invalid or future timestamp');
  if (typeof c.device !== 'string' || !c.device.trim()) failures.push(id + ': device missing');
  // Preserve exact device identifiers; surrounding whitespace can obscure audit comparisons.
  if (typeof c.device === 'string' && c.device !== c.device.trim()) failures.push(id + ': device metadata has surrounding whitespace');
  // Keep device metadata printable and bounded; it is copied into private audit reports.
  if (typeof c.device === 'string' && (/[\x00-\x1f\x7f\u2028\u2029\p{Cf}\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/u.test(c.device) || c.device.length > 160)) failures.push(id + ': invalid device metadata');
}
// Each physical test must point to its own evidence; normalize canonically equivalent Unicode to prevent duplicate-proof bypasses.
const refs = cases.filter(c => c && typeof c.evidenceRef === 'string' && c.evidenceRef.trim())
  .map(c => c.evidenceRef.trim().normalize('NFC'));
if (new Set(refs).size !== refs.length) failures.push('duplicate evidence reference');
if (cases.some(c => !ids.includes(c?.id))) failures.push('unknown case ID');
if (failures.length) {
  console.error('NO-GO: ' + failures.join('; '));
  process.exit(1);
}
console.log('Evidence manifest structurally complete (16/16). NOT a device verification, CI approval, or production authorization.');

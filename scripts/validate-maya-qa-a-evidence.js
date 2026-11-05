#!/usr/bin/env node
// QA A evidence gate: offline only. Does not install, publish or call an API.
const fs = require('node:fs');
const path = require('node:path');
const required = ['A01','A02','A03','A04','A05','A06','P01','P02','P03','P04','P05','R01','R02','R03','R04','R05'];
function validate(e) {
  const errors = [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['evidence must be an object'];
  if (e.runtime !== '2.0.43') errors.push('runtime mismatch');
  if (e.versionCode !== 148) errors.push('versionCode mismatch');
  if (e.releaseSha !== '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e') errors.push('QA A SHA mismatch');
  if (e.updateId !== '01a1a975-d85f-794f-9d67-cf2ac961fbb7') errors.push('QA A update mismatch');
  if (![e.deviceModel, e.androidVersion, e.testedAt].every(v => typeof v === 'string' && v.trim())) errors.push('device metadata missing');
  if (typeof e.testedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(e.testedAt) || !Number.isFinite(Date.parse(e.testedAt))) errors.push('testedAt must be an ISO timestamp with timezone');
  // A future-dated capture cannot substantiate a completed on-device QA session.
  if (typeof e.testedAt === 'string' && Number.isFinite(Date.parse(e.testedAt)) && Date.parse(e.testedAt) > Date.now() + 5 * 60 * 1000) errors.push('testedAt is in the future');
  if (!Array.isArray(e.cases)) errors.push('cases missing');
  const seen = new Set();
  const evidenceRefs = new Set();
  if (/fixture|placeholder|simulat|emulat|test data/i.test(String(e.deviceModel))) errors.push('device metadata appears synthetic');
  for (const c of Array.isArray(e.cases) ? e.cases : []) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) { errors.push('invalid case object'); continue; }
    if (!required.includes(c.id) || seen.has(c.id)) errors.push('unknown or duplicate case: ' + c.id);
    seen.add(c.id);
    if (typeof c.evidenceRef === 'string' && c.evidenceRef.trim()) {
      const ref = c.evidenceRef.trim();
      if (evidenceRefs.has(ref)) errors.push('duplicate evidence reference: ' + c.id);
      evidenceRefs.add(ref);
      // Evidence must be a local, reviewable artifact path, never a remote URL or traversal.
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|\\\\)/i.test(ref) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(ref) || /[?#\x00-\x1f]/.test(ref) || !/\.(?:png|jpe?g|webp|pdf|mp4)$/i.test(ref)) errors.push('unsafe evidence reference: ' + c.id);
    }
    if (c.status !== 'PASS') errors.push('not PASS: ' + c.id);
    if (![c.observed, c.evidenceRef].every(v => typeof v === 'string' && v.trim())) errors.push('missing observation/evidence: ' + c.id);
    if (/\b(?:fixture|placeholder|todo|tbd|n\/a|simulated|synthetic)\b/i.test(String(c.observed)) ||
        /\b(?:fixture|placeholder|todo|tbd|n\/a|simulated|synthetic)\b/i.test(String(c.evidenceRef))) errors.push('synthetic/placeholder evidence: ' + c.id);
  }
  for (const id of required) if (!seen.has(id)) errors.push('missing case: ' + id);
  if (e.ci !== 'success' || e.explicitApproval !== true) errors.push('CI/approval missing');
  return errors;
}
// Verify artifacts on disk as well as their metadata. No network access or writes.
function verifyEvidenceFiles(e, root) {
  const errors = [];
  if (!e || !Array.isArray(e.cases)) return ['cases missing for artifact verification'];
  if (typeof root !== 'string' || !root.trim()) return ['evidence root missing'];
  const base = path.resolve(root);
  for (const c of e.cases) {
    if (!c || typeof c.evidenceRef !== 'string') continue;
    const ref = c.evidenceRef.trim();
    // Repeat the metadata gate here: this function can also be called directly.
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/|\\\\)/i.test(ref) ||
        /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(ref) ||
        /[?#\x00-\x1f]/.test(ref) || !/\.(?:png|jpe?g|webp|pdf|mp4)$/i.test(ref)) {
      errors.push('unsafe evidence reference: ' + c.id);
      continue;
    }
    const target = path.resolve(base, ref);
    if (!target.startsWith(base + path.sep)) {
      errors.push('artifact outside evidence root: ' + c.id);
      continue;
    }
    try {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0)
        errors.push('artifact not a nonempty regular file: ' + c.id);
      else if (fs.realpathSync(target) !== target)
        errors.push('artifact path contains symlink: ' + c.id);
    } catch {
      errors.push('artifact missing/unreadable: ' + c.id);
    }
  }
  return errors;
}
if (require.main === module) {
  let data;
  try { data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); }
  catch (err) { console.error('NO-GO: invalid/missing evidence JSON:', err.message); process.exit(2); }
  const errors = validate(data);
  if (!errors.length) errors.push(...verifyEvidenceFiles(data, process.argv[3] || process.cwd()));
  if (errors.length) { console.error('NO-GO:\n' + errors.join('\n')); process.exit(1); }
  console.log('Evidence structurally complete; human review and runtime verification still required. NO AUTOMATIC PROMOTION.');
}
module.exports = { validate, verifyEvidenceFiles };

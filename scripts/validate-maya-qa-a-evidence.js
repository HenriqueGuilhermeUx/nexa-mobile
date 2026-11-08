#!/usr/bin/env node
// QA A evidence gate: offline only. Does not install, publish or call an API.
const fs = require('node:fs');
const path = require('node:path');
const required = ['A01','A02','A03','A04','A05','A06','P01','P02','P03','P04','P05','R01','R02','R03','R04','R05'];
function validate(e) {
  const errors = [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['evidence must be an object'];
  if (e.applicationId !== 'br.com.trynexa.app') errors.push('QA A applicationId mismatch');
  if (e.runtime !== '2.0.43') errors.push('runtime mismatch');
  if (e.versionCode !== 148) errors.push('versionCode mismatch');
  if (e.releaseSha !== '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e') errors.push('QA A SHA mismatch');
  if (e.updateId !== '01a1a975-d85f-794f-9d67-cf2ac961fbb7') errors.push('QA A update mismatch');
  if (![e.deviceModel, e.androidVersion, e.testedAt].every(v => typeof v === 'string' && v.trim())) errors.push('device metadata missing');
  if (typeof e.testedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(e.testedAt) || !Number.isFinite(Date.parse(e.testedAt))) errors.push('testedAt must be an ISO timestamp with timezone');
  // Date.parse can normalize impossible days (e.g. February 30); reject them explicitly.
  if (typeof e.testedAt === 'string') {
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})T/.exec(e.testedAt);
    if (dateParts) {
      const year = Number(dateParts[1]), month = Number(dateParts[2]), day = Number(dateParts[3]);
      const calendarDate = new Date(0);
      // Date.UTC maps years 00–99 to 1900–1999; set the literal Gregorian year.
      calendarDate.setUTCFullYear(year, month - 1, day);
      if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() + 1 !== month || calendarDate.getUTCDate() !== day)
        errors.push('testedAt has an impossible calendar date');
    }
  }
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
      // Canonicalize harmless path aliases so one artifact cannot satisfy multiple cases.
      const canonicalRef = path.posix.normalize(ref.split(String.fromCharCode(92)).join('/')).toLowerCase();
      if (evidenceRefs.has(canonicalRef)) errors.push('duplicate evidence reference: ' + c.id);
      evidenceRefs.add(canonicalRef);
      // Evidence must be a local, reviewable artifact path, never a remote URL or traversal.
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|\\\\)/i.test(ref) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(ref) || /[\\?#:\x00-\x1f]/.test(ref) || !/\.(?:png|jpe?g|webp|pdf|mp4)$/i.test(ref)) errors.push('unsafe evidence reference: ' + c.id);
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
// Fail closed on renamed text/empty placeholders masquerading as screenshots or recordings.
// This is a format sanity check, not proof that a capture is genuine.
function hasExpectedMediaSignature(file, extension) {
  const fd = fs.openSync(file, 'r');
  try {
    const bytes = Buffer.alloc(16);
    const length = fs.readSync(fd, bytes, 0, bytes.length, 0);
    if (extension === '.png') {
      if (length < 16 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return false;
      // Require a complete IHDR and terminal IEND; a PNG signature alone is not a screenshot.
      const size = fs.fstatSync(fd).size;
      if (size < 45 || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii',12,16) !== 'IHDR') return false;
      const header = Buffer.alloc(25);
      // Reject implausibly large dimensions before treating a PNG as reviewable evidence.
      if (fs.readSync(fd,header,0,25,8) !== 25 ||
          header.readUInt32BE(8) === 0 || header.readUInt32BE(12) === 0 ||
          header.readUInt32BE(8) > 16384 || header.readUInt32BE(12) > 16384 ||
          // IHDR permits only defined bit-depth/color combinations, compression/filter 0 and interlace 0/1.
          !({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]}[header[17]] || []).includes(header[16]) ||
          header[18] !== 0 || header[19] !== 0 || header[20] > 1) return false;
      // IHDR CRC binds dimensions and encoding fields to the actual PNG header.
      // A modified header with a stale CRC is not a structurally valid capture.
      const ihdrBytes = Buffer.alloc(17);
      if (fs.readSync(fd, ihdrBytes, 0, 17, 12) !== 17) return false;
      let crc = 0xffffffff;
      for (const byte of ihdrBytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++)
          crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      const storedCrc = Buffer.alloc(4);
      if (fs.readSync(fd, storedCrc, 0, 4, 29) !== 4 ||
          storedCrc.readUInt32BE(0) !== ((crc ^ 0xffffffff) >>> 0)) return false;
      let offset = 8, chunks = 0, sawData = false;
      while (offset + 12 <= size && chunks++ < 100000) {
        const chunk = Buffer.alloc(8);
        if (fs.readSync(fd,chunk,0,8,offset) !== 8) return false;
        const dataLength = chunk.readUInt32BE(0);
        const type = chunk.toString('ascii',4,8);
        if (dataLength > size - offset - 12) return false;
        if (type === 'IDAT' && dataLength > 0) {
          // A corrupted IDAT payload is not usable QA evidence even with a valid PNG header.
          // Stream the CRC to avoid allocating an untrusted chunk-sized buffer.
          let chunkCrc = 0xffffffff;
          let remaining = dataLength + 4; // chunk type plus payload
          let position = offset + 4;
          const buffer = Buffer.alloc(8192);
          while (remaining > 0) {
            const count = Math.min(remaining, buffer.length);
            if (fs.readSync(fd, buffer, 0, count, position) !== count) return false;
            for (let i = 0; i < count; i++) {
              chunkCrc ^= buffer[i];
              for (let bit = 0; bit < 8; bit++)
                chunkCrc = (chunkCrc >>> 1) ^ ((chunkCrc & 1) ? 0xedb88320 : 0);
            }
            position += count;
            remaining -= count;
          }
          const checksum = Buffer.alloc(4);
          if (fs.readSync(fd, checksum, 0, 4, offset + 8 + dataLength) !== 4 ||
              checksum.readUInt32BE(0) !== ((chunkCrc ^ 0xffffffff) >>> 0)) return false;
          sawData = true;
        }
        if (type === 'IEND') {
          // The zero-length IEND chunk has a fixed CRC; reject a forged terminator.
          const terminatorCrc = Buffer.alloc(4);
          return dataLength === 0 && sawData && offset + 12 === size &&
            fs.readSync(fd, terminatorCrc, 0, 4, offset + 8) === 4 &&
            terminatorCrc.readUInt32BE(0) === 0xae426082;
        }
        offset += 12 + dataLength;
      }
      return false;
    }
    if (extension === '.jpg' || extension === '.jpeg') {
      // A three-byte SOI prefix is not a JPEG capture; require a terminal EOI marker.
      const size = fs.fstatSync(fd).size;
      if (size < 4 || length < 3 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return false;
      const end = Buffer.alloc(2);
      return fs.readSync(fd, end, 0, 2, size - 2) === 2 && end[0] === 255 && end[1] === 217;
    }
    if (extension === '.webp') {
      // RIFF declares the complete file length; a 12-byte WEBP prefix is not a capture.
      const size = fs.fstatSync(fd).size;
      if (size < 20 || bytes.toString('ascii',0,4) !== 'RIFF' ||
          bytes.toString('ascii',8,12) !== 'WEBP' || bytes.readUInt32LE(4) !== size - 8) return false;
      const chunk = Buffer.alloc(8);
      if (fs.readSync(fd, chunk, 0, 8, 12) !== 8) return false;
      const type = chunk.toString('ascii',0,4);
      const payload = chunk.readUInt32LE(4);
      return ['VP8 ', 'VP8L', 'VP8X'].includes(type) && payload > 0 &&
        20 + payload + (payload % 2) <= size;
    }
    if (extension === '.pdf') {
      // A bare PDF header is not a complete reviewable document.
      const size = fs.fstatSync(fd).size;
      if (size < 10 || bytes.toString('ascii',0,5) !== '%PDF-') return false;
      const tail = Buffer.alloc(Math.min(size, 1024));
      if (fs.readSync(fd, tail, 0, tail.length, size - tail.length) !== tail.length) return false;
      return /%%EOF\s*$/.test(tail.toString('latin1'));
    }
    if (extension === '.mp4') {
      // The first ISO BMFF box must fit the file; an 'ftyp' token alone is not a video.
      const size = fs.fstatSync(fd).size;
      if (size < 16 || length < 16 || bytes.toString('ascii', 4, 8) !== 'ftyp') return false;
      const boxSize = bytes.readUInt32BE(0);
      // Extended-size and size-to-EOF boxes are not accepted by this conservative QA gate.
      if (boxSize < 16 || boxSize > size) return false;
      return /^[\x20-\x7e]{4}$/.test(bytes.toString('latin1', 8, 12));
    }
    return false;
  } finally { fs.closeSync(fd); }
}
// Verify artifacts on disk as well as their metadata. No network access or writes.
function verifyEvidenceFiles(e, root) {
  const errors = [];
  if (!e || !Array.isArray(e.cases)) return ['cases missing for artifact verification'];
  // Standalone callers must enforce device/session metadata as well as disk checks.
  if (![e.deviceModel, e.androidVersion, e.testedAt].every(v => typeof v === 'string' && v.trim()) ||
      /fixture|placeholder|simulat|emulat|test data/i.test(String(e.deviceModel)))
    errors.push('device metadata missing or synthetic for artifact verification');
  if (typeof e.testedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(e.testedAt) ||
      !Number.isFinite(Date.parse(e.testedAt)) || Date.parse(e.testedAt) > Date.now() + 5 * 60 * 1000)
    errors.push('invalid QA session timestamp for artifact verification');
  // Date.parse may normalize impossible calendar days; reject those in the standalone gate too.
  if (typeof e.testedAt === 'string') {
    const parts = /^(\d{4})-(\d{2})-(\d{2})T/.exec(e.testedAt);
    if (parts) {
      const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
      const calendarDate = new Date(0);
      calendarDate.setUTCFullYear(year, month - 1, day);
      if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() + 1 !== month || calendarDate.getUTCDate() !== day)
        errors.push('impossible QA session calendar date for artifact verification');
    }
  }
  // Standalone verification must bind artifacts to the exact QA A binary/update,
  // not merely to a caller-provided success/approval flag.
  if (e.applicationId !== 'br.com.trynexa.app' || e.runtime !== '2.0.43' || e.versionCode !== 148 ||
      e.releaseSha !== '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e' ||
      e.updateId !== '01a1a975-d85f-794f-9d67-cf2ac961fbb7')
    errors.push('QA A release identity mismatch for artifact verification');
  // Direct callers must not treat disk artifacts as approved QA without CI and human sign-off.
  if (e.ci !== 'success' || e.explicitApproval !== true) errors.push('CI/approval missing for artifact verification');
  // A standalone artifact check must never pass an empty or partial QA matrix.
  const suppliedIds = new Set(e.cases.filter(c => c && typeof c === 'object').map(c => c.id));
  const missingIds = required.filter(id => !suppliedIds.has(id));
  if (missingIds.length) errors.push('missing case(s) for artifact verification: ' + missingIds.join(', '));
  if (typeof root !== 'string' || !root.trim()) return ['evidence root missing'];
  const base = path.resolve(root);
  const physicalArtifacts = new Set();
  const canonicalArtifacts = new Set();
  const caseIds = new Set();
  for (const c of e.cases) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.evidenceRef !== 'string') {
      errors.push('invalid case object for artifact verification');
      continue;
    }
    if (typeof c.id !== 'string' || !required.includes(c.id) || caseIds.has(c.id)) {
      errors.push('unknown or duplicate case: ' + c.id);
      continue;
    }
    caseIds.add(c.id);
    // This standalone gate must not accept failed or unobserved cases.
    if (c.status !== 'PASS' || typeof c.observed !== 'string' || !c.observed.trim()) {
      errors.push('case not approved for artifact verification: ' + c.id);
      continue;
    }
    // Reject placeholder observations and references even when called without validate().
    if (/\b(?:fixture|placeholder|todo|tbd|n\/a|simulated|synthetic)\b/i.test(c.observed) ||
        /\b(?:fixture|placeholder|todo|tbd|n\/a|simulated|synthetic)\b/i.test(c.evidenceRef)) {
      errors.push('synthetic/placeholder evidence: ' + c.id);
      continue;
    }
    const ref = c.evidenceRef.trim();
    // Repeat the metadata gate here: this function can also be called directly.
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/|\\\\)/i.test(ref) ||
        /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(ref) ||
        /[\\?#:\x00-\x1f]/.test(ref) || !/\.(?:png|jpe?g|webp|pdf|mp4)$/i.test(ref)) {
      errors.push('unsafe evidence reference: ' + c.id);
      continue;
    }
    const canonicalRef = path.posix.normalize(ref).toLowerCase();
    if (canonicalArtifacts.has(canonicalRef)) {
      errors.push('duplicate evidence reference: ' + c.id);
      continue;
    }
    canonicalArtifacts.add(canonicalRef);
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
      else if (!hasExpectedMediaSignature(target, path.extname(ref).toLowerCase()))
        errors.push('artifact content does not match media extension: ' + c.id);
      else {
        // Hard links have distinct paths but reference the same underlying capture.
        const identity = `${stat.dev}:${stat.ino}`;
        if (physicalArtifacts.has(identity)) errors.push('duplicate physical evidence artifact: ' + c.id);
        physicalArtifacts.add(identity);
      }
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

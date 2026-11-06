#!/usr/bin/env node
/**
 * QA-only compatibility gate for the frozen Android v148 binary.
 * Never use this in place of a strict Expo Doctor for native upgrades or
 * a production AAB release. Any unrecognized issue is a hard failure.
 */
const { spawnSync } = require('node:child_process');

const allowed = new Map([
  ['expo', '~57.0.32 57.0.31'],
  ['expo-build-properties', '~57.0.23 57.0.22'],
  ['expo-constants', '~57.0.23 57.0.22'],
  ['expo-dev-client', '~57.0.21 57.0.20'],
  ['expo-image-picker', '~57.0.21 57.0.20'],
  ['expo-router', '~57.0.30 57.0.29'],
  ['expo-splash-screen', '~57.0.11 57.0.10'],
  ['expo-updates', '~57.0.27 57.0.26'],
]);

function validateDoctorResult(status, rawLog) {
  if (status === 0) return { ok: true, reason: 'Expo Doctor: all checks passed.' };
  const log = String(rawLog).replace(/\x1b\[[0-9;]*m/g, '');
  if (!log.includes('20/21 checks passed. 1 checks failed.') ||
      !log.includes('Check that packages match versions required by installed Expo SDK') ||
      !log.includes('Patch version mismatches') ||
      /Major version mismatches|Minor version mismatches|Other issues/i.test(log)) {
    return { ok: false, reason: 'Unexpected Expo Doctor error.' };
  }
  const rows = log.match(/package\s+expected\s+found([\s\S]*?)Changelogs:/);
  if (!rows) return { ok: false, reason: 'Missing version mismatch table.' };
  const parsed = rows[1].trim().split(/\r?\n/)
    .map(row => row.trim().split(/\s+/).join(' ')).filter(Boolean);
  if (parsed.length !== allowed.size) {
    return { ok: false, reason: 'Unexpected number of SDK patch differences.' };
  }
  for (const row of parsed) {
    const [name, expected, installed] = row.split(' ');
    if (allowed.get(name) !== `${expected} ${installed}`) {
      return { ok: false, reason: 'Unrecognized SDK patch difference: ' + row };
    }
  }
  return {
    ok: true,
    reason: 'QA ONLY: 20/21 Expo Doctor checks passed; exactly eight reviewed SDK 57 PATCH mismatches. No native dependency updates performed.',
  };
}

if (require.main === module) {
  const result = spawnSync('npx', ['expo-doctor'], {
    encoding: 'utf8', timeout: 120000, env: { ...process.env, CI: '1' },
  });
  const log = String(result.stdout || '') + '\n' + String(result.stderr || '');
  process.stdout.write(log);
  const verdict = validateDoctorResult(result.status, log);
  console.log(verdict.reason);
  if (result.error || result.signal || !verdict.ok) process.exit(1);
}

module.exports = { validateDoctorResult };

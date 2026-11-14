# Maya Actions QA A — CI and physical acceptance gate (2026-11-14)

Scope: `HenriqueGuilhermeUx/nexa-mobile`, QA evidence branch only. This is an executable operator runbook, **not** proof of CI success, physical testing, or release approval.

## Exact references checked
- Cumulative integration: `integration/maya-actions-v148` at `6f1c9fd1bf16fc0046228993a83118390da62760`.
- QA evidence HEAD before this document: `0e966b2892792fdead16b53b89dce8a592110f26`; comparison: 113 ahead, 7 behind, 7 changed QA-only files.
- QA A frozen candidate: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`, runtime `2.0.43`, EAS QA branch `maya-actions-v148-qa`, Android update `01a1a975-d85f-794f-9d67-cf2ac961fbb7`.
- PR #142 reviews returned `[]`; PR-event workflow query and combined commit statuses for `0e966b28` returned `[]`. **Neither empty response proves CI passed or failed.**

## Reproducible acceptance procedure (read-only, no production actions)

1. Inspect GitHub Actions across **all** events for the exact QA HEAD (not just PR-triggered runs), then record the run URL, event, `head_sha`, workflow name, conclusion, and jobs. If none exists, mark CI `UNKNOWN` / gate `BLOCKED`; never infer success.
2. On a QA-enabled compatible Android device, independently observe package `br.com.trynexa.app`, versionCode 148, runtime `2.0.43`, EAS branch and Android update ID. A standalone `br.com.trynexa.mayaqa` APK is not evidence of receipt of the EAS QA A update.
3. Run A01–A16 exactly as documented in `docs/qa/maya-actions-wave-a-a01-a16-evidence-20261111.md`; keep distinct, privately stored, redacted proof per case. Do not commit screenshots, account IDs, tokens, financial data or OTP.
4. Validate the local redacted manifest: `node scripts/qa/maya-actions-wave-a-evidence-gate.js /private/redacted.json`. Exit code 0 establishes **structural completeness only**; it does not certify observed behavior. Run the offline regression suite: `node --test scripts/qa/maya-actions-wave-a-evidence-gate.test.js`, and capture its actual output and SHA.
5. Review the seven commits behind integration and each changed file before selective promotion. Do not merge the 113+ commit divergent QA history wholesale. Require exact-SHA CI, Android export/TS checks, native compatibility, Wallet/Pix/USDC/Didit/login/Staff/Nexa PJ regressions and explicit release authorization before any promotion.

## Wave gates
| Wave | Gate |
|---|---|
| 01 | Merged per plan; A01–A16 device evidence pending; NO-GO |
| 02 | Merged per plan; A01–A16 device evidence pending; NO-GO |
| 03 | Authenticated read-only integration per plan; device QA pending |
| 04 | Manual sharing only; QA C per plan, no auto-send |
| 05 | Preflight controls pending; no money movement |
| 06 | Blocked: separate approval, strong auth, antifraud, idempotency |
| 07 | Scheduler/opt-in/audit not approved |
| 08 | External connector authentication and data boundaries pending |
| 09 | Read-only search contracts; real-price backend not homologated |
| 10 | Form review only; no external submission |
| 11 | Checkout/purchase blocked |
| 12 | Reservation/booking blocked |

**Decision: production NO-GO.** No feature branch, cumulative integration, production OTA, payment, purchase, reservation, or external send is authorized by this document. PR #185 and other repositories are out of scope.

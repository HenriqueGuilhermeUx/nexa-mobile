# Maya Actions v148 — QA regression gate for PR #142 (11 Nov 2026)

Scope: **QA-only** verification of the reported agenda/calendar and read-only activity defects in [PR #142](https://github.com/HenriqueGuilhermeUx/nexa-mobile/pull/142). This checklist does **not** certify a fix, merge PR #142, or replace the independent QA A A01–A16 matrix.

## Reproduction and acceptance checks (all PENDING)

| ID | Reproduction / expected result | Status | Evidence |
|---|---|---|---|
| D-R01 | Open reminder draft with empty date/time; tap Review. Show a visible, actionable validation message; do not silently ignore the tap. | PENDING | — |
| D-R02 | Enter invalid date/time, including impossible day and past date; show validation without crash or scheduling. | PENDING | — |
| D-R03 | Select a valid future day in local calendar and set hour/minute; review displays correct local timezone and final timestamp before saving. | PENDING | — |
| D-R04 | Create and reopen a reminder; draft appears in an obvious position and the saved value persists after app restart. | PENDING | — |
| D-R05 | Deny notification permission; the UI remains usable, communicates inability to notify and never claims delivery. | PENDING | — |
| D-R06 | On activity read-only screen, map known technical statuses to intelligible Portuguese labels without altering source status. | PENDING | — |
| D-R07 | Show transaction amount only for explicit BRL metadata (amountBrl or currency=BRL); unknown currency/units must not be inferred or displayed as BRL. | PENDING | — |
| D-R08 | No raw personal IDs/CPF or secrets in UI/logs; no payment, transfer, swap or external submission. | PENDING | — |

## Evidence required per case

Record sanitized test account, device/Android version, package, versionCode 148, runtime 2.0.43, build/commit SHA, EAS channel/update ID **if applicable**, timestamp with timezone, steps, observed outcome, PASS/FAIL/BLOCKED, and private evidence link. Do not commit personal or financial data, credentials, tokens or screenshots.

**Isolation:** PR #142 targets a frozen Wave D QA base, not production. The standalone QA D package `br.com.trynexa.mayaqad` does not prove EAS OTA receipt in `br.com.trynexa.app`. Verify exact binary before any testing. Keep QA A A01–A16 independent; a successful D regression run does not automatically approve QA A.

**Gate:** NO-GO until CI of the exact tested SHA, native/runtime compatibility, all applicable device evidence, explicit reviewer approval and no critical regressions. Never publish production OTA or promote to `integration/maya-actions-v148` based on this checklist alone. No real financial operations.

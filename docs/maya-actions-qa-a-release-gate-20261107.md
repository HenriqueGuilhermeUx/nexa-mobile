# Maya Actions QA A — release gate (07/11/2026)

Scope: waves 01 (local reminders) and 02 (local planning) only. This document is a **test protocol**, not a test result or approval.

## Immutable identity
- QA A release commit: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`
- EAS Android update: `01a1a975-d85f-794f-9d67-cf2ac961fbb7`
- Runtime: `2.0.43`; Android build: `148`
- EAS QA branch: `maya-actions-v148-qa` (never `production`).
- Standalone QA APK `br.com.trynexa.mayaqa` is not interchangeable with the production package `br.com.trynexa.app`.

## Device verification
Capture device model, Android version, installed package, version/build, EAS update ID, test timestamp with timezone, and evidence for each case. Test on a physical device; the reported standalone APK “OK” on 06/11 is useful feedback, **not** a completed regression sign-off.

| ID | Manual acceptance condition |
|---|---|
| A01 | Create a future local reminder and see its exact scheduled time |
| A02 | Notification permission denied: safe fallback without false success |
| A03 | Permission granted: reminder delivered on the device |
| A04 | Cancel reminder; verify it does not notify |
| A05 | Complete reminder; confirm persisted state |
| A06 | Reopen app; reminders persist without duplicate schedules |
| P01 | Create a local goal with BRL amount |
| P02 | Reject malformed, negative, and non-finite amounts |
| P03 | Update goal/progress; verify correct values |
| P04 | Reopen app; goal and progress persist per account |
| P05 | Planning figures never appear as Wallet balance or financial transaction |
| R01 | Existing login/session works without clearing user data |
| R02 | Wallet balances/history read correctly; no real transfers |
| R03 | Pix/USDC routes and confirmation safeguards remain intact; no real orders |
| R04 | Didit/KYC and Staff routes remain available |
| R05 | Background/foreground restart and update compatibility do not regress |

## Offline evidence gate
The evidence JSON must contain all 16 PASS cases with unique, locally reviewable capture paths and explicit human approval. Run:

```sh
node --test scripts/validate-maya-qa-a-evidence.test.js
node scripts/validate-maya-qa-a-evidence.js /path/to/qa-a-evidence.json /path/to/captures
```

The script verifies metadata and basic media integrity; **it cannot prove capture authenticity, correct UX, CI approval, or device compatibility**. A human reviewer must inspect the actual captures and record the corresponding CI run URL and SHA. Never put customer credentials, private keys, OTPs, wallet seeds, or personal transaction data into evidence.

## Promotion decision
**NO-GO by default.** GO requires: green checks for the exact candidate SHA; 16 device cases with reviewed evidence; confirmed Android package/runtime/update identity; explicit approval; Wallet/Pix/USDC/Didit/login/Staff regression sign-off. Do not merge unapproved wave changes into `integration/maya-actions-v148`. Do not publish production OTA from this protocol. Any staged QA OTA must use a distinct QA branch and must not change the existing production v148.

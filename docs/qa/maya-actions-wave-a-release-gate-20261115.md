# Maya Actions QA A — live release-gate checkpoint (2026-11-15)

Scope: `HenriqueGuilhermeUx/nexa-mobile` only. Evidence and review checkpoint; **not** a release authorization.

## Fresh repository observations
- Integration `integration/maya-actions-v148`: `6f1c9fd1bf16fc0046228993a83118390da62760`.
- QA evidence branch comparison against integration before this checkpoint: **131 ahead, 7 behind**, 11 changed paths, all QA workflow/docs/offline scripts. Never merge the diverged QA branch wholesale.
- PR #142 concerns QA D reminder/calendar and read-only activity display fixes, **not** a QA A approval. Review query returned no reviews.
- PR-triggered workflow query and combined commit-status query for `07cd7fc3aefe055070618a59bdaf00e7865e5a09` both returned empty arrays. These endpoints do **not** establish push/workflow_dispatch/check-run outcomes; CI is **unverified**, not green.
- Frozen QA A release candidate remains `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`, Android runtime `2.0.43`, package `br.com.trynexa.app`, EAS QA branch `maya-actions-v148-qa`, Android update `01a1a975-d85f-794f-9d67-cf2ac961fbb7` per execution plan. Do not equate historical EAS publication with present device receipt.

## Twelve-wave disposition (no new approval inferred)
| Wave | Isolated branch | Gate |
|---|---|---|
| 01 | `feat/maya-actions-01-agenda-v148` | PR #122 merged per plan; QA A A01–A16 device proof pending; NO-GO |
| 02 | `feat/maya-actions-02-planejamento-v148` | PR #124 merged per plan; same QA A hold |
| 03 | `feat/maya-actions-03-leitura-movimentacoes-v148` | PR #134 merged per plan; authenticated read-only; device QA pending |
| 04 | `feat/maya-actions-04-comunicacao-assistida-v148` | PR #132 merged per plan; QA C, manual share only |
| 05 | `feat/maya-actions-05-wallet-preflight-v148` | No new approval; preflight only |
| 06 | `feat/maya-actions-06-wallet-execucao-v148` | Blocked: no financial execution |
| 07 | `feat/maya-actions-07-automacoes-v148` | Consent/scheduler/audit pending |
| 08 | `feat/maya-actions-08-integracoes-v148` | Auth and data boundaries pending |
| 09 | `feat/maya-actions-09-pesquisa-cotacoes-v148` | PR #123/#127 merged per plan; real quote backend not homologated; read-only |
| 10 | `feat/maya-actions-10-formularios-inscricoes-v148` | PR #125 merged per plan; review only, no submission |
| 11 | `feat/maya-actions-11-compras-checkout-v148` | Checkout/purchases blocked |
| 12 | `feat/maya-actions-12-reservas-servicos-v148` | Booking blocked |

Individual feature-branch head SHAs were not retrieved in this checkpoint and are deliberately not invented.

## Next executable acceptance sequence
1. Retrieve **all** applicable Actions/check-run results for the exact QA evidence SHA (including push and manual triggers); retain run URLs and conclusions. Empty PR-only queries are insufficient.
2. On a QA-enabled Android binary, collect 16 distinct redacted physical A01–A16 proofs and validate with `node scripts/qa/maya-actions-wave-a-evidence-gate.js /private/redacted.json`. Synthetic tests cannot replace device evidence.
3. Review the seven behind commits individually and PR #142 independently; cherry-pick only reviewed, approved changes into integration after CI and regression gates.
4. Verify TS, Android export, Wallet/Pix/USDC/Didit/login/Staff/Nexa PJ regression and runtime before any separate staged QA OTA. **Production NO-GO**.
5. Then prioritize wave 09 real quotes via isolated, authenticated, read-only backend and wave 10 form preparation without submission.

No production OTA, staged OTA, merge, payment, purchase, reservation or external send was performed by this checkpoint. PR #185 is out of scope.

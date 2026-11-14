# Maya Actions — QA A release gate / wave inventory (2026-11-13)

Scope: `HenriqueGuilhermeUx/nexa-mobile` only. This is an engineering checkpoint, not a production approval or evidence of a device test.

## Immutable release references
- Integration base observed: `6f1c9fd1bf16fc0046228993a83118390da62760` (`integration/maya-actions-v148`).
- Frozen QA A candidate: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`.
- Android runtime: `2.0.43`; production Android v148 remains unchanged.
- QA A EAS update: `01a1a975-d85f-794f-9d67-cf2ac961fbb7`, QA EAS branch `maya-actions-v148-qa`; does not prove device receipt.
- QA evidence branch compared with integration: 72 ahead / 7 behind at inspection; do **not** merge the diverged QA history as a whole.
- PR #142 reviews: none returned. Commit-specific workflow query for `d459e608891cbbc7736910fb0b793dcf19118f27` returned no PR-triggered runs (not a comprehensive Actions check).

## Wave disposition (based on integration execution plan; NOT fresh approval)
| Wave | Isolated branch | Verified plan / current gate |
|---|---|---|
| 01 | `feat/maya-actions-01-agenda-v148` | PR #122 merged per plan; QA A physical A01-A16 incomplete; NO-GO |
| 02 | `feat/maya-actions-02-planejamento-v148` | PR #124 merged per plan; QA A physical A01-A16 incomplete; NO-GO |
| 03 | `feat/maya-actions-03-leitura-movimentacoes-v148` | PR #134 merged per plan; authenticated read-only; device regression pending |
| 04 | `feat/maya-actions-04-comunicacao-assistida-v148` | PR #132 merged per plan; QA C only, manual sharing |
| 05 | `feat/maya-actions-05-wallet-preflight-v148` | Branch present; quote/fee/recipient checks required; no execution |
| 06 | `feat/maya-actions-06-wallet-execucao-v148` | Branch present; blocked pending strong auth, antifraud and separate approval |
| 07 | `feat/maya-actions-07-automacoes-v148` | Branch present; scheduler/consent/audit required |
| 08 | `feat/maya-actions-08-integracoes-v148` | Branch present; external auth/data boundaries required |
| 09 | `feat/maya-actions-09-pesquisa-cotacoes-v148` | PR #123/#127 merged per plan; no homologated real-price backend; read-only only |
| 10 | `feat/maya-actions-10-formularios-inscricoes-v148` | PR #125 merged per plan; review contracts only; no submission |
| 11 | `feat/maya-actions-11-compras-checkout-v148` | Branch present; checkout/payment blocked |
| 12 | `feat/maya-actions-12-reservas-servicos-v148` | Branch present; booking blocked |

## Next testable promotion gate
1. Run offline evidence regression workflow at the exact QA evidence branch SHA; record run URL and conclusion. An empty PR-triggered workflow query does not mean no push workflow ran.
2. Collect private redacted, distinct A01-A16 physical test records with candidate SHA, runtime, package, EAS update ID, timestamp, device and evidenceRef; run `node scripts/qa/maya-actions-wave-a-evidence-gate.js /private/redacted.json` locally. The synthetic regression passing does not prove real physical QA.
3. Review PR #142 and reconcile 7 behind commits by reviewing diffs; cherry-pick only approved changes into integration. Never promote the QA evidence branch wholesale.
4. Revalidate Android export, TypeScript, Wallet/Pix/USDC/Didit/login/Staff/Nexa PJ regression and EAS runtime before any staged update. Production remains NO-GO until device verification and explicit release approval.
5. Only then advance 09 isolated backend read-only quotes, then 10 form review. No external sends, payments, reservations or purchases.

No OTA, merge, payment, purchase, reservation, or external send is authorized by this file. PR #185 is explicitly out of scope.

## Checkpoint 2026-11-14 — QA A IPv6 unspecified
- QA branch HEAD: `70708b3a92c28e5fe68386505b70b3ac028595e3` (code `b77bcf1c9ad3d8a4fc575a566cc353879fa90015`; regression `70708b3a92c28e5fe68386505b70b3ac028595e3`).
- Integration base at inspection: `6f1c9fd1bf16fc0046228993a83118390da62760`; 89 ahead / 7 behind **before** this two-commit increment. Do not merge QA branch wholesale.
- PR #142 review query returned no reviews; commit `032c046db96b4e31548afcc767d869dbc870c607` PR-triggered workflow query and combined statuses returned empty arrays. Neither result establishes CI success or failure.
- Waves 01/02: QA A evidence gate remains NO-GO until A01-A16 physical proof, CI and runtime verification. Waves 03/04: existing integrated work only, device QA pending per plan. Waves 05/06/07/08: unchanged, no external/financial actions authorized. Wave 09: backend real quotes not homologated, read-only only. Wave 10: review-only; no submission. Waves 11/12: blocked for checkout/reservations. All 12 feature branches left untouched.
- New check: reject IPv6 unspecified host `https://[::]/evidence/A01` and add one synthetic regression; no real evidence, no device test and no OTA. CI for new SHA not yet confirmed.

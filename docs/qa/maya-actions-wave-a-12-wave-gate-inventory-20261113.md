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

## Checkpoint 2026-11-14 — CI visibility and promotion hold
- Latest inspected QA evidence SHA: `7b6867914630d995f155a14f4e7ae37981d24ef7` (device-ID whitespace regression). This is a reference SHA, **not** a CI-approved candidate.
- Live comparison against `integration/maya-actions-v148` at `6f1c9fd1bf16fc0046228993a83118390da62760`: 104 commits ahead / 7 behind; seven changed files, limited to QA workflow, QA documents and offline QA scripts. Do not merge the divergent history wholesale.
- PR #142 review query: empty; PR-triggered workflow runs for `7b686791`: empty; combined commit statuses: empty. The workflow query is PR-event-only, so push/workflow_dispatch and check-run results are **not established** by this inspection. Never translate an empty response to CI green.
- Release gate: 01/02 remain blocked on 16 distinct device records A01-A16, runtime/package/update receipt and successful CI for the **exact** release SHA. Prior standalone APK 'OK' is insufficient. No device evidence was added or fabricated.
- Other waves: 03 read-only integrated per execution plan, 04 QA C only; 05-08 no new approval; 09 real-price backend unhomologated; 10 review-only; 11/12 execution blocked. No feature branch, cumulative integration, OTA or external operation changed by this checkpoint.
- Next verification: inspect push-triggered Actions and check-runs separately, obtain CI run URL and exact head SHA, then review the seven behind commits one by one before any selective cherry-pick. Keep production NO-GO.

## Checkpoint 2026-11-14 — reserved-address evidence gate
- Baseline `integration/maya-actions-v148`: `6f1c9fd1bf16fc0046228993a83118390da62760`; QA comparison before this increment: **105 ahead / 7 behind**, seven QA-only files. PR #142 reviews: `[]`. Previous QA SHA `e07b026fbdf0d896e7158382c7d565e1d3492715`: PR-triggered workflow runs `[]`, combined statuses `[]` (inconclusive, not CI approval).
- Offline gate change `2472ae1f89f742419cb0782010c7bae8d457f111`: reject RFC 5737 TEST-NET IPv4 and RFC 3849 documentation IPv6 evidence URLs, including IPv4-mapped IPv6. Regression cases added in `92e212d99db21432f3f3c64fa2dcaa59186a0045`. Synthetic tests **not yet confirmed run in CI**; no physical evidence inferred.
- Wave 01: merged per plan, QA A A01–A16 still NO-GO. Wave 02: merged per plan, same physical QA hold. Wave 03: read-only integration per plan, device QA pending. Wave 04: QA C only, no auto-send. Wave 05: preflight pending. Wave 06: financial execution blocked. Wave 07: automation consent/scheduler pending. Wave 08: integrations pending. Wave 09: real quote backend unhomologated. Wave 10: review-only, no submission. Wave 11: purchases blocked. Wave 12: reservations blocked.
- No wave feature branch changed; integration not promoted; production OTA remains NO-GO. PR #185 and other projects untouched. Next: exact-SHA CI evidence, device A01–A16 and review of divergence before selective promotion.

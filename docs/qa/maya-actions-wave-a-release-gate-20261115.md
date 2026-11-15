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

## Follow-up verified checkpoint — 2026-11-15

- QA-only validator fix: `52e3bda0d6e781d9ee73a66b55145c9c54f34133`; regression additions: `cdcda14f92cb6f12bb84cb46ddfc895d907ddc1c`. Percent-encoded local proof references now normalize before duplicate detection; distinct IDs remain admissible. Tests committed, execution/CI not yet verified.
- Integration HEAD checked: `6f1c9fd1bf16fc0046228993a83118390da62760`. Before these changes, QA branch was 132 ahead / 7 behind, 12 QA-only changed paths. No promotion.
- PR #142 reviews: none returned. Previous QA checkpoint SHA `2106e9f0`: PR-filtered workflow runs and combined statuses returned empty; this is **not** a complete CI verdict.
- Branch HEADs below were individually fetched from GitHub; SHA is branch state, **not** approval:

| Wave | Verified branch HEAD | Integration comparison (ahead/behind) | Gate |
|---|---|---|---|
| 01 | `a367f5fd9cb6993f0447ad31124df9330d92c4f7` | 43 / 25 | QA A A01–A16 pending |
| 02 | `7936a51573a72603aa40fa7fe5e566ba86cb4adb` | 163 / 20 | QA A A01–A16 pending |
| 03 | `7f0f3eb84df6ecfdd490b678c10d1de2924e183d` | 7 / 10 | Read-only; QA pending |
| 04 | `2c34a4b787c786fc040102e6e25c32c7db9a880f` | 14 / 11 | QA C manual-share only |
| 05 | `79d298f94f48316ae20a6f08116af6363ff37cb2` | 0 / 25 | Preflight not approved |
| 06 | `79d298f94f48316ae20a6f08116af6363ff37cb2` | 0 / 25 | Financial execution blocked |
| 07 | `79d298f94f48316ae20a6f08116af6363ff37cb2` | 0 / 25 | Scheduler/consent pending |
| 08 | `79d298f94f48316ae20a6f08116af6363ff37cb2` | 0 / 25 | Integrations pending |
| 09 | `d6cf4af665040ae4bb2dd33526d9562a144a7f22` | 6 / 23 | Real quote backend not homologated |
| 10 | `31d0d19da3d9206d8e21107c1dd422b8df3b048b` | 4 / 17 | Review only; no submissions |
| 11 | `fa2348ca821fbb2d5ff1fb9e17a356e16e39589f` | 1 / 23 | Checkout blocked |
| 12 | `23c1f210e437f196564a1ff2e2e0de789f44375f` | 1 / 23 | Reservations blocked |

All comparisons use `integration/maya-actions-v148` as base. The shared HEAD for 05–08 reflects branches without independent advances relative to their common base; it does not authorize implementation or merging. **Production NO-GO.**

## Incremental checkpoint — 2026-11-15 (missing-case gate)
- QA-only regression commit `e60c4797a70087e0dc8aad3239cf494545ab9be2`: synthetic negative cases for missing/null/object/empty/string `cases` and non-`PASS` statuses. This adds tests only; **execution remains unverified**.
- Pre-commit comparison to integration: 136 ahead / 7 behind; integration SHA `6f1c9fd1bf16fc0046228993a83118390da62760`; no merge.
- PR search surfaced #142 (QA D) and #136 (09C review-only); neither authorizes QA A or production. PR-filtered workflow runs for prior QA SHA returned none, which is not evidence of green CI.
- Wave SHAs remain as listed above until individually refreshed. QA A A01–A16 physical proofs remain pending. Backend 09 not homologated; wave 10 review-only. **Production NO-GO.**

## QA A incremental checkpoint — malformed case records (2026-11-15)
- Regression-only commit `4e7505ae4aab1232dbae8265326ace771338da36` adds six negative synthetic per-case inputs (`null`, boolean, number, string, array, empty object). The gate must return exit code 1 and `NO-GO` for each; test execution/CI is not yet verified.
- Integration comparison before this increment: `6f1c9fd1bf16fc0046228993a83118390da62760` base, QA branch 138 ahead / 7 behind; no merge or production OTA.
- QA SHA `feba41cd80070c422caee51257a217f5238522a6`: PR-triggered workflow runs empty; combined commit statuses empty; PR #142 reviews empty. These results are inconclusive for full Actions/check-run coverage, not a green CI verdict.
- Wave 01/02 A01–A16 device proofs remain unverified; wave 09 backend not homologated; wave 10 review only. Individual branch SHAs are last verified values in the table above, not refreshed in this checkpoint. **Production NO-GO.**

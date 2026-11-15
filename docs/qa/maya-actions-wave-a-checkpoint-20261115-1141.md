# Maya Actions QA A — checkpoint 2026-11-15 11:41 BRT

Scope: `HenriqueGuilhermeUx/nexa-mobile` only. **Not a release authorization.**

## Verified increment
- Commit `8b1c90e2eea749160ed7cbd6801833c8a4232b59` adds three synthetic rejection cases to `scripts/qa/maya-actions-wave-a-cardinality.test.js`: impossible February 30, UTC offset +14:30, and hour 24:00. The suite now declares 17 negative cases. This is **test code committed**, not evidence that the suite ran.
- Integration base `6f1c9fd1bf16fc0046228993a83118390da62760` unchanged; QA evidence branch **150 ahead / 7 behind** after increment. Do not merge this diverged QA branch wholesale.
- Previous QA SHA `93372b57b7458687a080abeb411ce509c17a9146`: PR-filtered workflow runs **[]** and combined statuses **[]**. These APIs do not cover every check or trigger; CI approval **unverified**.
- Related PR search: #142 QA D, #136 wave 09C review-only, #137 standalone QA D, #139/#140 OTA gating, #152 promotion workflow. None proves QA A approval. No PR merged in this execution.

## Twelve waves — fresh branch comparisons (base integration)
| Wave | Branch suffix | Ahead / behind | Disposition |
|---|---|---|---|
| 01 | 01-agenda | 43 / 25 | QA A A01–A16 physical evidence pending |
| 02 | 02-planejamento | 163 / 20 | Same QA A hold |
| 03 | 03-leitura-movimentacoes | 7 / 10 | Read-only; physical QA pending |
| 04 | 04-comunicacao-assistida | 14 / 11 | Manual share only; no autonomous send |
| 05 | 05-wallet-preflight | 0 / 25 | No new approval |
| 06 | 06-wallet-execucao | 0 / 25 | Financial execution blocked |
| 07 | 07-automacoes | 0 / 25 | Consent/scheduler pending |
| 08 | 08-integracoes | 0 / 25 | Authentication/data boundaries pending |
| 09 | 09-pesquisa-cotacoes | 6 / 23 | Real quote backend not homologated |
| 10 | 10-formularios-inscricoes | 4 / 17 | Review only; no submission |
| 11 | 11-compras-checkout | 1 / 23 | Purchase blocked |
| 12 | 12-reservas-servicos | 1 / 23 | Booking blocked |

These are fresh compare counts, **not independently retrieved branch HEAD SHAs**. Last individually verified SHAs remain in `docs/qa/maya-actions-wave-a-release-gate-20261115.md`; no SHA refresh is asserted here.

## Gates
QA A candidate `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`; runtime `2.0.43`; EAS QA branch `maya-actions-v148-qa`; Android update `01a1a975-d85f-794f-9d67-cf2ac961fbb7` per execution plan. **A01–A16 device proof and exact-SHA CI still unverified. Production NO-GO.** No merge, staged/production OTA, financial action, checkout, reservation, external submission or change to PR #185.

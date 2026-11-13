# Maya Actions QA A — verified checkpoint, 2026-11-13

Baseline integration/maya-actions-v148: 6f1c9fd1bf16fc0046228993a83118390da62760.
QA branch before this commit: b6d2d3a25707548b1a70b989545ff12cd4894343.

CI run https://github.com/HenriqueGuilhermeUx/nexa-mobile/actions/runs/43395661063 completed SUCCESS for b6d2d3a2. Both synthetic evidence regression and fail-closed-without-physical-evidence steps succeeded. This verifies only the offline evidence gate, not Android runtime or device QA.

PR #142 remained open with no reviews in the GitHub reviews endpoint at this checkpoint.

Wave 01 reminders: offline gate green, physical A01–A16 evidence incomplete; NO-GO.
Wave 02 planning: offline gate green, physical A01–A16 evidence incomplete; NO-GO.
Waves 03–08: no change or approval in this checkpoint.
Wave 09: contracts/manual research only; no live quotes backend verified.
Wave 10: review-only form contracts; no external submission.
Waves 11–12: no purchases or bookings enabled.

Next release gates: collect device-specific A01–A16 evidence with tester approval and no PII; run TypeScript, Android QA export and Wallet/KYC regressions on exact candidate SHA; review branch divergence and PR diff; keep production OTA blocked until all checks pass. No merge, OTA, payment, reservation or external submission authorized by this document.

## Rechecagem de 13/11/2026 — gate de promoção
- Comparação GitHub `integration/maya-actions-v148...qa/maya-actions-wave-a-evidence-20261111`: integração `6f1c9fd1bf16fc0046228993a83118390da62760`, base comum `f341f01787f50eaa13b363dc8a57b17da1fe5044`, QA **71 commits à frente e 7 atrás**. A divergência exige revisão de diff; não executar merge automático.
- Arquivos distintos na comparação: workflow offline, roteiro A01–A16, checkpoints QA, gate JS e seus testes. Nenhum arquivo Wallet, Pix, USDC, Didit, Staff ou Nexa PJ consta desse diff.
- PR #142: endpoint de reviews consultado novamente, retornou `[]` (sem aprovação registrada). Consulta de workflow runs associada ao commit `63beaa8b339528a7e935e580c90a2792af305b4f` retornou `[]`; status combinados desse SHA também `[]`. Esses endpoints **não cobrem necessariamente todos os eventos Actions**, portanto resultado vazio é inconclusivo, não falha nem aprovação.
- SHA do release candidate físico QA A continua `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`, distinto do SHA desta branch documental. Nenhum teste físico A01–A16 novo foi comprovado nesta rechecagem.
- Decisão: **NO-GO** para integração e OTA production. Próximo passo verificável: obter logs/checks completos do SHA candidato e evidências individuais de dispositivo, com revisão humana da PR antes de promover. Ondas 09/10 continuam sem backend real homologado ou envio externo.

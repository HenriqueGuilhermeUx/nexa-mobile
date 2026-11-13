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

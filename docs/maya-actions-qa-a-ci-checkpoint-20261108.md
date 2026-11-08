# Maya Actions QA A — CI evidence checkpoint (2026-11-08)

Scope: wave 01 reminders and wave 02 local planning. This record is **engineering evidence only**, not physical-device QA approval or permission to publish.

## Verified GitHub evidence

- Wave 02 feature branch: `feat/maya-actions-02-planejamento-v148`
- Tested HEAD: `9deb7fb870e021bb695f2a43cf3e5ada6b5b06f6`
- GitHub Actions run: https://github.com/HenriqueGuilhermeUx/nexa-mobile/actions/runs/42443748150
- Run conclusion: **success**; event: push; job `evidence-unit-tests`: success.
- Confirmed successful steps: `Offline evidence gate regression tests` and `Wave 02 planning safety and navigation checks`.
- Previous intermediate SHA `0f993a020111481af9dce86860e00b8f9eef503e` had a **failed** run (https://github.com/HenriqueGuilhermeUx/nexa-mobile/actions/runs/42443742605); do not claim every commit passed.
- Cumulative integration branch remains `integration/maya-actions-v148` at `f341f01787f50eaa13b363dc8a57b17da1fe5044` at the time of this checkpoint. No merge is authorized by this record.

## Explicit release gate

**NO-GO for production** until all 16 QA A cases (A01–A06, P01–P05, R01–R05) have real-device evidence, signed human approval, and regression verification of Android v148 / runtime 2.0.43, login, Wallet, Pix, USDC, Didit, Staff and Nexa PJ. A successful isolated unit-test workflow does not establish an end-to-end app build, EAS OTA compatibility, or device QA.

The previously published QA A update is tied to frozen release SHA `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`, Android update `01a1a975-d85f-794f-9d67-cf2ac961fbb7`, EAS QA branch `maya-actions-v148-qa`. The newer feature HEAD above is **not** that published QA update. No OTA publication, payment, reservation, external message or financial operation is implied by this checkpoint.

Next engineering action: collect and verify the 16 physical QA A cases against the exact installed binary/update; only then consider a separately reviewed cumulative integration and QA-only staged release. Wave 09 backend-isolated quotes and wave 10 form review remain subsequent priorities.

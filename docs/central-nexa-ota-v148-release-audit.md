# Central Nexa v148 — Canary production rollout decision (2026-11-12)

## Verified baseline

- EAS Expo project: b3faabec-283a-4ba2-88b5-f096304e68aa
- EAS channel production maps exclusively to EAS branch production.
- Latest verified Android production update before release:
  - Update: 01a1cc3f-1c54-7c1f-bc46-c0747e330176
  - Group: db9fba55-40ca-4a60-8a53-e89f0960c8fb
  - Timestamp: 2026-11-11T20:14:10.516Z
  - Source Git commit: a97dea14a6235be6332fc106370c70665de9fef3
- New release Git branch is based exactly on that source commit. It changes only Central screen, support links, entry points and private push opt-in logic plus CI/docs; no native or financial files.
- Expo QA branch central-nexa-v148-qa received validated Android updates. EAS API will require the QA git SHA to match the release HEAD immediately before production.
- Expo runtimeVersion policy appVersion remains 2.0.43; versionCode 148.

## Intended production action

- Canary: Android-only EAS Update, rollout to 10% of compatible installations using the existing production branch.
- Triggered only by commit message prefix release(central): rollout-10.
- Workflow will hard stop if last production Android Git SHA differs from a97dea..., production channel mapping is different, or latest QA update Git SHA does not match the candidate HEAD.
- Existing EAS configuration, dependencies and financial code are unchanged, and production environment settings come from eas.json.
- The in-app chat backend is not yet enabled, so the new Central provides official Theo WhatsApp/Telegram help and KYC guidance until its authenticated API is homologated.
- Remote push and marketing campaigns are NOT enabled.
- If anything fails, do not force the rollout. No financial transactions or external customer messages are triggered by this operation.

## Rollback

Previous production group: db9fba55-40ca-4a60-8a53-e89f0960c8fb.
If canary causes regressions, stop/invalidate the rollout and republish the known-good EAS update using Expo's rollback mechanism, then check native version and app status. Avoid deleting user data or clearing application storage.

## QA completion

CI of minimal production baseline: PASS.
QA upload to unlinked Expo branch: PASS.
Automated EAS GraphQL channel and source SHA audit: PASS.
Physical device smoke test: NOT VERIFIED.

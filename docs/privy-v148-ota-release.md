# Nexa Android v148 — Privy activation incident hotfix

- Native baseline: Expo production Android v2.0.43 build 148, git SHA `72f2b82241eae43bda20a33c03758680787a613e`.
- Scoped JS-only changes: authenticated Privy link gate, continue wallet setup, EIP-191 ownership proof without legacy direct-settlement audit, Central Nexa user guidance.
- Backend `/user/me.wallet.privyLinked` published; Privy link preserves encrypted legacy recovery data.
- Original app.json, app.config.js, eas.json, package.json, package-lock.json, API client and Wallet-First API unchanged.
- QA: TypeScript, Android export, strict source-diff contract. Release action first publishes to unlinked EAS QA branch, then verifies current production source and exact QA Git SHA.
- If and only if all checks pass, publish **Android-only 10% production canary** on channel production. Never overwrite a newer OTA or change iOS.
- No on-chain movement, migrations, token transfers, wallet recovery operations, marketing push or forced logout.
- Rollback: verify production latest EAS update group, use EAS update rollback to previous known-good group if a regression is confirmed; do not clear customer data.
- Owner explicitly authorized OTA and operational notices during the wallet activation incident.
- Physical-device manual smoke: not yet confirmed; hence canary only.

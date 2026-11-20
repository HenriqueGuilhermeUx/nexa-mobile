# Nexa Android v148 — Privy activation incident hotfix

- Native baseline: Expo production Android v2.0.43 build 148, git SHA `b8bc4c65f08480f2a334be457ef47bcc1b20f49d`.
- Scoped JS-only changes: authenticated Privy link gate, continue wallet setup, EIP-191 ownership proof without legacy direct-settlement audit, Central Nexa user guidance.
- Backend `/user/me.wallet.privyLinked` published; Privy link preserves encrypted legacy recovery data.
- Original app.json, app.config.js, eas.json, package.json, package-lock.json, API client and Wallet-First API unchanged.
- QA: TypeScript, Android export, strict source-diff contract. Release action first publishes to unlinked EAS QA branch, then verifies current production source and exact QA Git SHA.
- If and only if all checks pass, publish **Android-only 10% production canary** on channel production. Never overwrite a newer OTA or change iOS.
- No on-chain movement, migrations, token transfers, wallet recovery operations, marketing push or forced logout.
- Rollback: verify production latest EAS update group, use EAS update rollback to previous known-good group if a regression is confirmed; do not clear customer data.
- Owner explicitly authorized OTA and operational notices during the wallet activation incident.
- Physical-device manual smoke: not yet confirmed; hence canary only.

## Live-cumulative source audit

- Rebased additively onto actual Expo Android production SHA `b8bc4c65f08480f2a334be457ef47bcc1b20f49d` (Nov 17). This preserves all 79 intervening commits, including Maya, Central, Aave and wallet features, instead of replacing with Nov 15 OTA.
- Manual device acceptance remains pending; only 10% canary after verifying the channel is mapped to production and QA SHA matches the exact release.

- OTA QA release requested on production source `b8bc4c65`, with exclusive branch and no customer delivery; retain all live Maya/Central changes.

## Canary production 10% — autorizado

- QA live-cumulative validada no GitHub run `44659162192` com grupo EAS `8571cbdb-bb52-45ce-9032-3273f958592d`.
- Antes do update production, confirmar automaticamente que Expo production ainda corresponde a `b8bc4c65f08480f2a334be457ef47bcc1b20f49d`, que o canal é `production` e a QA corresponde ao SHA exato deste commit.
- Se houver divergência, cancelar release. Nunca mover USDC nem forçar rollback.

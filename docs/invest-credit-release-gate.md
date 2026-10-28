# Nexa Mobile — Invest & Credit: release gate

Target is the **actual** Android/iOS app in the repo root, not nexa-react-app or the historic nested mobile folder.

## Non-negotiable
- No changes to app navigation, root layout, existing wallet, Pix, transfers, Privy, KYC, rewards, login, forced updates, notifications, Android package/signing, versionCode or EAS production profile before a complete implementation is accepted.
- No main merge, no EAS production build, OTA update, Play upload or production feature toggle while incomplete.
- Branch only: `feat/invest-credit-isolated-android-20261028`; early commits must be additive and not imported by production app.
- Account/market read requests require Nexa JWT, trusted HTTPS backend, explicit informational mode and failure closed. Never send private keys or Privy tokens to the read-only adapter.
- Aave loans/supply/repay/withdraw require verified network/Pool/token, up-to-date risk, fees/gas, client-side transaction authorization with Privy, receipts and reconciliation before release.
- Dinari/xStocks execution disabled pending contracts, approved BR eligibility, KYB and production credentials. Keep USA pathway segregated.
- Audit legacy yield/vault before presenting existing APY as on-chain realized yield.
- Verify compatibility with currently live Android build, using Play package `br.com.trynexa.app`; do not trust stale README or app.json version as the Play Store version.

## Release acceptance checklist
- [ ] Complete final UI in real app with navigation guards and explicit disabled states
- [ ] Test existing Pix, balances, send/receive, wallet connection, login, admin and historical ledger
- [ ] Check Aave read-only positions and reserves for linked wallet, mismatched chain, unlinked account, suspended RPC and no funds
- [ ] Verify consent/signature flow and on-chain state reconciliation in isolated test environment
- [ ] Validate Brazilian provider/jurisdiction and investor/borrower eligibility
- [ ] Run TypeScript and mobile CI plus device test on Android
- [ ] Production rollout plan with rollback and versionCode strictly above current Play release
- [ ] Only then merge/build release artifact in GitHub for user-managed Play Store upload

This is a safety gate document, not evidence that lending or tokenized equities are enabled.

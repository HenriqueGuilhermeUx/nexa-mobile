# Nexa Wallet Connect — Reown handoff and blocked external prerequisites

**Scope:** Nexa Brasil + Nexa Global, Polygon chain 137, native USDC only, no extra Nexa receiving fee. Reown only connects a wallet and requests EIP-191 ownership proof. Privy remains the Nexa receiving wallet. No swap, onramp, social login or Reown Payments.

## Reown already supplied / configured by user

- Existing inactive Reown project ID (PUBLIC): `0d9b915b32c04b058efeba535319dd70`. Configured in `eas.json` **only** for the `wallet-inbound-lab` profile; no other build profile contains it.
- User reported Android application/package ID and iOS bundle ID both registered in Reown. Confirmed current Expo settings: `br.com.trynexa.app` on both platforms.
- Nexa app scheme: `nexa://`.
- The existing project is not known to be used by another active app; confirm Reown dashboard branding/ownership before commercial rollout.

## Reown items requiring owner/provider confirmation

1. Verify actual origin/domain allowlist in dashboard for `https://trynexa.com.br`; add `https://global.trynexa.com.br` only when the Global browser application uses WalletConnect. Confirm Android/iOS IDs are accepted (allowlist propagation can be delayed).
2. Verify **Social & Email**, Reown Authentication, Multi Wallet, Payments, Swaps and Onramp are disabled if Nexa does not use them. A switch shown in a screenshot is not proof that Apply/Save persisted.
3. Confirm the name, logo and redirect/deep link `nexa://` for wallets to return to Nexa; actual round-trip needs Android/iOS device QA.
4. **Written licensing question is essential:** Reown Terms of Service effective 2026-07-27, section 3.7(b), explicitly names fintech/neobank/exchange/value movement use cases as potentially requiring an Enterprise Agreement regardless of ordinary self-serve tier eligibility. Ask Reown whether Nexa's **connection-only, noncustodial** flow is eligible on the existing plan and whether using AppKit Core/WalletConnect-only changes requirements. Do NOT upgrade/accept new fees without an answer.
5. Review quota/status of existing project. Do not assume because project ID exists that service is available or commercially cleared.

Reown terms: https://reown.com/terms-of-service
Reown Dashboard: https://dashboard.reown.com/
Reown docs: https://docs.reown.com/appkit/react-native/core/installation

## Engineering steps not yet verified

- Backend composed in `src/modules/wallet-connect-inbound/external-wallet-inbound-lab.module.ts` of `nexa-backend1` feature branch, **not imported into AppModule**. Review-only SQL must be tested and applied to isolated PostgreSQL first, with TypeORM schema sync safe. No live endpoints claimed.
- All new Reown routes stay unlinked from production menus. The internal `wallet-inbound-lab` EAS profile has financial execution and Reown switches default **false**. After legal approval, explicitly enable `EXPO_PUBLIC_NEXA_REOWN_ENABLED=true`, `EXPO_PUBLIC_NEXA_REOWN_LICENSE_REVIEWED=true` and `EXPO_PUBLIC_NEXA_REOWN_NATIVE_QA_MODE=true` only in a dedicated internal QA build to validate wallet callbacks before setting `NATIVE_VERIFIED`. Production remains blocked by code.
- Test MetaMask and Trust Wallet session connect, Polygon restriction, EIP-191 user signature, proof submission, reconnect idempotency, linked-wallet listing, explicit unlink vs Reown disconnect, and read-only USDC balance. Test bad chain, account switch, denied signature, expired challenge, replay, revoked/blocked accounts and unsupported smart contract wallets.
- The backend staging Render service is still on `wallet-v15-foxbit-treasury`, not this feature branch, with autoDeploy enabled. Do not change its branch or run arbitrary migrations against active users. The free staging PostgreSQL expires on 2026-11-06 unless renewed/exported; Render MCP has no external read-only query access due to the IP allowlist. Do not open the public database firewall just for MCP.
- Backend GitHub Actions workflow on recent feature commits fails before reporting job steps/logs. Earlier tests and disposable PostgreSQL uniqueness/race tests passed, but these NEW additions remain unverified by backend CI. Inspect GitHub Actions billing/runner availability and rerun, then conduct E2E against disposable/staging infra.
- Direct native-USDC receive by QR code is deliberately independent of Reown. Never auto-credit ledger on a copied-address transfer; track chain balance / confirmed canonical logs without duplication. Do not ask clients to fund a feature until live provider and E2E validations pass.

**Release condition:** Reown provider support/terms clear, native device QA green, database migration green, backend tests green, no financial regression, rollback available, and explicit publication approval. No release/merge/deploy during this isolated branch preparation.

# Nexa Brasil / Global — External Wallet Inbound mobile release gates

This mobile branch is isolated from production releases. Its first code path is preview-only, authenticated and unable to broadcast a transaction.

Required before enabling any user-facing transfer:
1. Backend Wallet Connect module registered behind a strictly disabled-by-default feature flag; migration reviewed, TYPEORM synchronize disabled for production and rollback validated.
2. External EOA wallet challenge issued and consumed transactionally, with a server-controlled trusted origin per market. Contract wallets require a separate EIP-1271 design.
3. Server resolves and verifies target Privy wallet on every preview; the client never selects the destination.
4. Reown AppKit 2.0.6 and an isolated authenticated Expo Router connection screen are staged at `/(app)/external-wallet-connect` with an explicit activation gate. Requires a Reown Dashboard project ID, license review, a fresh **native dev build** with deep-link verification, and live MetaMask/Trust Wallet connection/ownership tests before the screen can be considered working. No connection is configured by default.
5. Confirm sender wallet has Polygon USDC and enough POL for gas; user must explicitly approve each transfer in their own wallet.
6. Watcher checks canonical block hash, confirmations, chain/token/source/destination and transactional idempotency, without double-crediting funds already held at the user's Privy address.
7. Integration tests with disposable Postgres, Polygon test wallet, and both mobile platforms.
8. Fresh iOS signing credentials and secure-secret rotation checked; do not publish an IPA/AAB based solely on green backend unit tests.
9. Product, fee and compliance review for both jurisdictions prior to production.

No modification to existing PIX/USDC, cards, spreads, KYC, ledger or legacy transactions is authorized by adding this isolated client.

## Staging connection route (unlinked, disabled by default)

The `app/(app)/external-wallet-connect.tsx` route requires a valid logged-in Nexa session, and its Reown modal is unavailable unless every condition below is met. The route is not on the home menu; no send buttons or signing of financial transactions are provided.

1. Create a project at https://dashboard.reown.com/ and register `trynexa.com.br` and the relevant `nexa://` deep link/native app details. Do not put production secrets into `EXPO_PUBLIC_` variables. The Reown **project ID is public**, but still must be tied to the correct application.
2. Validate license/terms for Nexa's commercial use, then set `EXPO_PUBLIC_NEXA_REOWN_LICENSE_REVIEWED=true` only in the isolated testing build.
3. Verify installed native dependencies and round-trip from external wallet app back to Nexa in a development build; set `EXPO_PUBLIC_NEXA_REOWN_NATIVE_VERIFIED=true` only after this. Expo Go is **not** considered a native validation.
4. Set `EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID=<your Reown project ID>` and `EXPO_PUBLIC_NEXA_REOWN_ENABLED=true` in the **preview/development environment only**. Production is blocked by the gate. For EAS release-style previews, `EXPO_PUBLIC_NEXA_WALLET_STAGING_BUILD=true` distinguishes preview from production.
5. Open the hidden `/(app)/external-wallet-connect` route as a logged-in tester, connect an EVM wallet on Polygon, verify that active account and provider match, and explicitly approve the **ownership message only**.
6. The backend ownership module is not registered and its SQL is review-only, so proof posting will NOT succeed until the backend has a safe staging deployment + migration. Never point staging ownership traffic at production expecting the endpoints to exist.

**Security limitations:** These Expo public feature flags are user-interface switches, not a security perimeter. The backend must independently enforce auth, signature, ownership, one-time nonce, verified Privy destination, and financial operations feature gates. The Reown modal has `swaps=false`, `onramp=false`, `socials=false`, analytics disabled, and supports only Polygon for this release. EIP-1271 contract wallets are excluded by the EOA proof design. No transfer/broadcast/ledger credits permitted.

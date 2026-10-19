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

## Direct USDC receiving without Reown

The isolated authenticated route `/(app)/receive-usdc` renders a QR code of the **full address only** and a copy-address action. Its backend counterpart is `GET /api/v1/wallet-connect-inbound/receive` (backend feature branch only; module is not registered in AppModule). The endpoint must verify the authenticated user's wallet **live through both Privy user and wallet APIs**, refuse inactive/blocked/managed or audit-unready wallets, and never alter balances, ledger, custody or wallet association. The screen must fail closed when this read-only endpoint is absent or fails. There is no fallback to `/user/me`, a profile cache or an address supplied by the client. Manual transfers remain external wallet actions, never authorized by the Nexa screen.

Only native USDC on Polygon chain 137, token `0x3c499c542cef5e3811e1192ce70d8cc03d5c3359`, fee Nexa 0%, sender gas. Do not treat an incoming deposit as spendable ledger balance. The wallet balance and confirmed chain events must be reconciled without double credit, prior to any claim of a fully functioning receive/receipt tracking flow.

## Existing Reown project reused for staging

The user supplied an existing Reown project ID from a former Criptozen project (`0d9b915b32c04b058efeba535319dd70`). A public-ID fallback is staged in the unlinked **development-only** route, not activated in production; a different project ID may always be supplied through `EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID`.

Still required in https://dashboard.reown.com: verify this project is not still used elsewhere; update its branding to Nexa if appropriate; configure the approved domain `trynexa.com.br`, bundle/package `br.com.trynexa.app`, and native scheme `nexa://` in the correct domain/app allowlist settings; confirm current account license and quota. **Never** activate a license-approved or native-verified flag based on the user merely having provided an ID. Do not upgrade the Reown plan without confirmed need.

## Receipts read-only: new staging-only extension

The receiving screen now allows entering a Polygon transaction hash after sending native USDC. In the backend branch, `GET /api/v1/wallet-connect-inbound/receive/confirm?txHash=...` re-audits the authenticated receiving address with Privy and checks the canonical receipt using server-provided `NEXA_POLYGON_READ_RPC_URL` (HTTPS only, MUST be chain 137). It requires at least 20 confirmations by default, exact native USDC token Transfer events to the verified user and canonical block hash. Before that threshold the UI reports `CONFIRMING`; an unknown hash reports `PENDING`. Noncanonical/reorg or wrong-token receipts fail closed.

**Important:** confirmation means observing a chain event only. It neither updates Nexa balances nor creates spendable funds/ledger credit. The server-side module has **not** been registered in AppModule and production RPC env has not been set. A successful mobile TypeScript check does **not** validate the backend API or real chain E2E. Verify staging backend CI, Privy API, RPC reliability, throttling, iOS and Android physical tests before allowing clients to use this status.

# Nexa Brasil / Global — External Wallet Inbound mobile release gates

This mobile branch is isolated from production releases. Its first code path is preview-only, authenticated and unable to broadcast a transaction.

Required before enabling any user-facing transfer:
1. Backend Wallet Connect module registered behind a strictly disabled-by-default feature flag; migration reviewed, TYPEORM synchronize disabled for production and rollback validated.
2. External EOA wallet challenge issued and consumed transactionally, with a server-controlled trusted origin per market. Contract wallets require a separate EIP-1271 design.
3. Server resolves and verifies target Privy wallet on every preview; the client never selects the destination.
4. Confirm wallet provider UX and supported connectors for iOS/Android; an installed WalletConnect SDK and actual connection flow are **not** present in this branch.
5. Confirm sender wallet has Polygon USDC and enough POL for gas; user must explicitly approve each transfer in their own wallet.
6. Watcher checks canonical block hash, confirmations, chain/token/source/destination and transactional idempotency, without double-crediting funds already held at the user's Privy address.
7. Integration tests with disposable Postgres, Polygon test wallet, and both mobile platforms.
8. Fresh iOS signing credentials and secure-secret rotation checked; do not publish an IPA/AAB based solely on green backend unit tests.
9. Product, fee and compliance review for both jurisdictions prior to production.

No modification to existing PIX/USDC, cards, spreads, KYC, ledger or legacy transactions is authorized by adding this isolated client.

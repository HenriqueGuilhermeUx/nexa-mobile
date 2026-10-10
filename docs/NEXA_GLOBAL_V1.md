# Nexa Global V1

## Product thesis

Nexa Global is a separate distribution of the Nexa wallet, sharing the same core codebase.

The product is **USDC-first**. Local fiat is never the ledger balance of Nexa Global at launch.

Primary use case:

1. User completes country-aware onboarding and KYC.
2. User brings USDC from an external wallet/exchange **or** buys USDC through the existing Privy/Meld funding surface.
3. User sends USDC to another Nexa user by `@username`.
4. Brazilian recipients can use the Nexa Brazil utilities available to their account, including Pix.
5. Global users can also use supported Brazil bill-pay functionality.
6. BTC, ETH and PAXG remain available where the user's jurisdiction/product eligibility permits them.

## Main audience

- Brazilians living abroad who want to send value back to Brazil.
- International users paying Brazilian freelancers, family members or service providers.
- Crypto-native users who already hold USDC and want a simple Brazil utility layer.
- Users who do not already hold USDC but can acquire it through an eligible funding provider.

## Primary UX hierarchy

1. **Send to @Nexa User** — primary action.
2. Add USDC.
3. Receive USDC from an external wallet/exchange.
4. Brazil utilities: Pix and supported bill payment.
5. Buy BTC / ETH / digital gold.
6. Activity/history.

## Funding model

Existing mobile implementation:
- `app/(app)/fund-card.tsx`
- Privy `useFundWallet`
- target asset: `USDC`
- chain: Polygon
- provider selection: Privy/Meld based on enabled providers and region

Supported payment methods are not promised globally. The UI must only present them as available when the selected provider/jurisdiction supports them.

### Quote and fee presentation

For V1, the provider funding UI remains the execution/quote source of truth.

Before confirmation the user should see, when supplied by the provider:
- source fiat amount/currency
- exchange rate
- provider transaction fee
- network fee
- partner fee, if any
- total fee
- estimated USDC to receive
- funding provider/payment method

Nexa Global must not invent or cache a fiat exchange rate as the authoritative purchase rate when the provider owns the transaction.

### Crediting rule

No fiat ledger balance is created.

The operation is considered credited to the user only after the purchased USDC reaches the user's Nexa/Privy wallet and the wallet/on-chain state reflects the receipt.

Customer language:
> Your payment provider shows the final quote and fees before you confirm. Nexa Global considers the funding complete when the USDC reaches your wallet.

## Country-aware onboarding

Country of residence is declared by the user and verified through KYC/compliance policy. Device geolocation must not be the source of truth for product eligibility.

Initial product regions:
- United States / Canada
- Europe
- Latin America

Country policy controls:
- registration enabled
- accepted document model
- KYC provider/flow
- sanctions/AML eligibility
- funding methods
- transaction limits
- Brazil Pix availability
- Brazil bill-pay availability
- asset purchase availability

## Brazil utilities

### Nexa User
This is the main cross-border route.

Sender:
USDC -> @username -> recipient Nexa wallet

Brazilian recipient:
Nexa wallet -> Brazil utility / Pix according to the recipient's eligible product flow.

### Pix Brazil
Direct payout routes may be added separately. Do not present arbitrary third-party Pix as live until the backend recipient/payout flow is enabled and tested.

### Brazilian bill payment
Keep the existing scheduled bill-pay UX:
- barcode / Pix QR by paste or photo
- customer-friendly bill validation messages
- future scheduled date
- provider details hidden from customer-facing copy
- backend remains authoritative on payment eligibility

## Asset purchases

Existing wallet-first surface:
- BTC
- ETH
- PAXG (digital gold)

Availability must be jurisdiction-aware.

## App identity

Working product identity:
- Name: Nexa Global
- Release channel: `nexa-global`
- Working Android package: `com.trynexa.global`
- Working iOS bundle: `com.trynexa.global`
- Approved Nexa mark: `assets/brand/nexa-pilot-icon-exact.png`

Store identifiers can be finalized before store submission.

## Separation from Nexa Brazil

Nexa Brazil and Nexa Global share components and infrastructure, but are separate distributions.

Nexa Global should not expose:
- Pix funding as the default global entry flow
- Brazilian Open Finance onboarding
- local foreign fiat balances
- local foreign bank accounts unless explicitly launched later

Nexa Brazil continues to use `br.com.trynexa.app`.

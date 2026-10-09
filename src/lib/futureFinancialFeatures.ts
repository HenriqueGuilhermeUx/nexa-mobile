function enabled(value: unknown): boolean {
  return String(value || '').trim().toLowerCase() === 'true';
}

const releaseChannel = String(
  process.env.EXPO_PUBLIC_NEXA_RELEASE_CHANNEL || '',
).trim();

const pilotBuild = releaseChannel === 'nexa-pay-pilot';

export const futureFinancialFeatures = {
  // Expo only inlines EXPO_PUBLIC_* variables when they are referenced
  // statically. Keep Nexa Pay visible in the isolated pilot even if the
  // environment optimization changes during release bundling.
  nexaPayEnabled:
    enabled(process.env.EXPO_PUBLIC_NEXA_PAY_ENABLED) || pilotBuild,
  nexaPayQrEnabled:
    enabled(process.env.EXPO_PUBLIC_NEXA_PAY_QR_ENABLED) && !pilotBuild,
  nexaPayWalletExecutionEnabled:
    enabled(process.env.EXPO_PUBLIC_NEXA_PAY_WALLET_EXECUTION_ENABLED) &&
    !pilotBuild,
  usReceivingEnabled: enabled(
    process.env.EXPO_PUBLIC_NEXA_US_RECEIVING_ENABLED,
  ),
};

// Pilot safety envelope:
// - Nexa Pay boleto UI is visible.
// - QR remains hidden.
// - Wallet execution remains disabled.
// - Financial execution remains backend-gated.

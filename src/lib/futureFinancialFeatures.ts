function envFlag(name: string): boolean {
  return String(process.env[name] || '').trim().toLowerCase() === 'true';
}

export const futureFinancialFeatures = {
  nexaPayEnabled: envFlag('EXPO_PUBLIC_NEXA_PAY_ENABLED'),
  nexaPayQrEnabled: envFlag('EXPO_PUBLIC_NEXA_PAY_QR_ENABLED'),
  nexaPayWalletExecutionEnabled: envFlag(
    'EXPO_PUBLIC_NEXA_PAY_WALLET_EXECUTION_ENABLED',
  ),
  usReceivingEnabled: envFlag('EXPO_PUBLIC_NEXA_US_RECEIVING_ENABLED'),
};

// All flags intentionally default to false. These surfaces must remain hidden
// until backend/provider homologation is complete.

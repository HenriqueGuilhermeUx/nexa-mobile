/**
 * Offline educational stress scenario only. NOT protocol telemetry, pricing,
 * Aave health factor, Chainlink reference data, execution, or credit offer.
 * Mirrors the no-signing backend educational formula without requiring the
 * production NEXA_INVEST_CREDIT_ENABLED flag for purely local math.
 */
export type AaveEducationalScenario = {
  collateralUsd: number;
  borrowUsd: number;
  priceDropPercent: number;
  referenceLtvPercent: number;
};
export type AaveEducationalResult = {
  originalLtvPercent: number;
  stressedCollateralUsd: number;
  stressedLtvPercent: number | null;
  outsideReferenceLtv: boolean;
};

export function simulateAaveEducationalScenario(input: AaveEducationalScenario): AaveEducationalResult {
  const { collateralUsd, borrowUsd, priceDropPercent, referenceLtvPercent } = input;
  if (![collateralUsd, borrowUsd, priceDropPercent, referenceLtvPercent].every(Number.isFinite) ||
      collateralUsd <= 0 || collateralUsd > 1_000_000_000 ||
      borrowUsd < 0 || borrowUsd > 1_000_000_000 ||
      priceDropPercent < 0 || priceDropPercent > 100 ||
      referenceLtvPercent < 0 || referenceLtvPercent > 100) {
    throw new RangeError('Invalid educational scenario values');
  }
  const stressedCollateralUsd = collateralUsd * (1 - priceDropPercent / 100);
  const originalLtvPercent = (borrowUsd / collateralUsd) * 100;
  // Never put non-finite values into app state or API data.
  const stressedLtvPercent = stressedCollateralUsd === 0
    ? borrowUsd === 0 ? 0 : null
    : (borrowUsd / stressedCollateralUsd) * 100;
  return {
    originalLtvPercent,
    stressedCollateralUsd,
    stressedLtvPercent,
    outsideReferenceLtv: stressedLtvPercent === null
      ? borrowUsd > 0
      : stressedLtvPercent > referenceLtvPercent,
  };
}

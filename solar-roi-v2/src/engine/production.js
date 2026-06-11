import { ORIENTATION, SHADE } from './assumptions.js';

// Property inputs drive output (v1 collected these and ignored them).
// Sizing targets 100% of annual usage, capped by what the roof can hold.
export function sizeSystem({ yearlyUsage, roofSqFt, orientation, shade, a }) {
  const derate = ORIENTATION[orientation] * SHADE[shade];
  const effectiveYield = a.baseYieldKWhPerKW * derate;
  const targetKW = yearlyUsage / effectiveYield;
  // 50% of roof usable, ~17.5 sq ft per 400W panel
  const roofMaxKW = (roofSqFt * 0.5 / 17.5) * 0.4;
  const systemKW = Math.min(Math.ceil(targetKW * 2) / 2, roofMaxKW);
  return {
    systemKW,
    year1Production: systemKW * effectiveYield,
    derate,
    effectiveYield,
    roofLimited: targetKW > roofMaxKW,
    offsetPct: Math.min(1, (systemKW * effectiveYield) / yearlyUsage),
  };
}

export function grossSystemCost(systemKW, a) {
  return systemKW * 1000 * a.solarCostPerWatt;
}

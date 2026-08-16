import { ORIENTATION, SHADE } from './assumptions.js';

// Property inputs drive output. Sizing targets 100% of annual usage, capped by
// what the roof can physically hold.
//
// measuredYieldPerKW: specific yield (kWh/kW/yr) from a weather source that was
// already given the array's tilt and azimuth — PVWatts, for instance. When it
// is present the ORIENTATION derate must NOT be applied again, or orientation
// gets counted twice. Shade is still applied, because it is a property of the
// site's trees and neighbours, not of the climate.
export function sizeSystem({ yearlyUsage, roofSqFt, orientation, shade, a, measuredYieldPerKW = null }) {
  const shadeDerate = SHADE[shade];
  const usingMeasured = Number.isFinite(measuredYieldPerKW) && measuredYieldPerKW > 0;

  const derate = usingMeasured ? shadeDerate : ORIENTATION[orientation] * shadeDerate;
  const effectiveYield = usingMeasured
    ? measuredYieldPerKW * shadeDerate
    : a.baseYieldKWhPerKW * derate;

  const targetKW = effectiveYield > 0 ? yearlyUsage / effectiveYield : 0;
  // 50% of roof usable, ~17.5 sq ft per 400W panel
  const roofMaxKW = (roofSqFt * 0.5 / 17.5) * 0.4;
  const systemKW = Math.min(Math.ceil(targetKW * 2) / 2, roofMaxKW);

  return {
    systemKW,
    year1Production: systemKW * effectiveYield,
    derate,
    effectiveYield,
    roofMaxKW,
    usingMeasuredYield: usingMeasured,
    roofLimited: targetKW > roofMaxKW,
    offsetPct: yearlyUsage > 0 ? Math.min(1, (systemKW * effectiveYield) / yearlyUsage) : 0,
  };
}

export function grossSystemCost(systemKW, a) {
  return systemKW * 1000 * a.solarCostPerWatt;
}

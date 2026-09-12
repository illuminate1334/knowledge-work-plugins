// Ownership costs v1 and v2 ignored entirely. Over 25 years these are not a
// rounding error: an inverter replacement plus O&M routinely exceeds 15% of
// the original system cost, and they land squarely inside the payback window.
export function lifecycleCost(year, { systemKW, hasBattery, a }) {
  let cost = 0;
  const items = [];

  const om = a.annualOMPerKW * systemKW * Math.pow(1 + (a.omInflation || 0), year - 1);
  cost += om;

  if (a.insurancePerYear) cost += a.insurancePerYear;

  if (year === a.inverterReplacementYear) {
    const inverter = a.inverterCostPerKW * systemKW;
    cost += inverter;
    items.push({ label: 'Inverter replacement', amount: inverter });
  }

  if (hasBattery && year === a.batteryReplacementYear) {
    const batt = a.batteryUsableKWh * a.batteryCostPerKWh * a.batteryReplacementCostFactor;
    cost += batt;
    items.push({ label: 'Battery replacement', amount: batt });
  }

  if (a.roofReplacementYear && year === a.roofReplacementYear) {
    cost += a.roofReworkCost;
    items.push({ label: 'Panel removal & reinstall for roof work', amount: a.roofReworkCost });
  }

  return { cost, om, items };
}

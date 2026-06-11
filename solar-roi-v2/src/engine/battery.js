// Physics-based TOU arbitrage, not v1's flat "15% extra savings".
// On flat/tiered plans there is no price spread to arbitrage: savings are $0
// and the battery's value is backup power — stated as such, not monetized.
export function batteryEconomics({ rate, a }) {
  const cost = a.batteryUsableKWh * a.batteryCostPerKWh;
  if (rate.type !== 'tou') {
    return {
      cost,
      annualSavings: 0,
      basis: 'No price spread on flat/tiered plans — battery value here is backup power (qualitative), not bill savings.',
    };
  }
  const low = rate.periods.superOffPeak?.rate ?? rate.periods.offPeak.rate;
  const spread = rate.periods.peak.rate - low;
  const annualSavings = Math.max(0, spread) * a.batteryUsableKWh * a.batteryRoundTripEff * a.batteryCyclesPerYear;
  return {
    cost,
    annualSavings,
    basis: `${(spread * 100).toFixed(1)}¢/kWh spread × ${a.batteryUsableKWh} kWh × ${a.batteryCyclesPerYear} cycles × ${Math.round(a.batteryRoundTripEff * 100)}% round-trip efficiency`,
  };
}

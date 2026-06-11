import { HOURLY_PROFILE } from './assumptions.js';

// Rate shape (matches what rateIntelligence.js returns and the edit form produces):
// { name, type: 'flat'|'tiered'|'tou', rate, fixedCharge,
//   tiers: [{limit, rate}],                       // tiered; last tier limit=Infinity
//   periods: { peak: {hours:[start,end), rate},
//              offPeak: {rate},
//              superOffPeak?: {hours:[start,end), rate} } }  // tou

export function periodForHour(hour, periods) {
  if (hour >= periods.peak.hours[0] && hour < periods.peak.hours[1]) return 'peak';
  const s = periods.superOffPeak;
  // Super-off-peak typically wraps midnight, e.g. hours: [22, 6].
  if (s && (hour >= s.hours[0] || hour < s.hours[1])) return 'superOffPeak';
  return 'offPeak';
}

export function monthlyCost(usage, rate, includeFixed = true) {
  let cost = 0;
  if (rate.type === 'flat') {
    cost = usage * rate.rate;
  } else if (rate.type === 'tiered') {
    let prevCap = 0;
    for (const tier of rate.tiers) {
      const cap = tier.limit ?? Infinity;
      const span = Math.max(0, Math.min(usage, cap) - prevCap);
      cost += span * tier.rate;
      prevCap = Math.min(usage, cap);
      if (usage <= cap) break;
    }
  } else if (rate.type === 'tou') {
    const profileSum = HOURLY_PROFILE.reduce((x, y) => x + y, 0);
    HOURLY_PROFILE.forEach((f, hour) => {
      const hourlyShare = (usage * f) / profileSum;
      cost += hourlyShare * rate.periods[periodForHour(hour, rate.periods)].rate;
    });
  }
  return cost + (includeFixed ? rate.fixedCharge || 0 : 0);
}

// Effective $/kWh at the household's usage level, excluding the fixed charge
// (the fixed charge survives solar, so it must not inflate per-kWh savings).
export function avgRetailRate(yearlyUsage, rate) {
  const monthly = yearlyUsage / 12;
  if (monthly <= 0) return 0;
  return monthlyCost(monthly, rate, false) / monthly;
}

export function annualCost(monthlyUsages, rate) {
  return monthlyUsages.reduce((sum, u) => sum + monthlyCost(u, rate), 0);
}

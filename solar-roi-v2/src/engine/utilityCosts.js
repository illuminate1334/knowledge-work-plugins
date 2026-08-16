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
  if (s) {
    const [start, end] = s.hours;
    // Window may wrap midnight (e.g. [22, 6]) or not (e.g. [1, 6]).
    const inWindow = start > end ? hour >= start || hour < end : hour >= start && hour < end;
    if (inWindow) return 'superOffPeak';
  }
  return 'offPeak';
}

// $/kWh for a specific hour. Tiered plans have no hourly variation — their
// marginal price depends on cumulative monthly usage, so callers must use
// marginalRate() for those instead of pricing hour by hour.
export function rateForHour(hour, rate) {
  if (rate.type === 'tou') return rate.periods[periodForHour(hour, rate.periods)].rate;
  if (rate.type === 'flat') return rate.rate;
  return null; // tiered: not an hourly quantity
}

// The price of the NEXT kWh at a given monthly usage level. This is what solar
// actually displaces on a tiered plan — v2 used the average rate, which
// understated savings because solar peels off the top tier first.
export function marginalRate(usage, rate) {
  if (rate.type === 'flat') return rate.rate;
  if (rate.type === 'tou') {
    const profileSum = HOURLY_PROFILE.reduce((a, b) => a + b, 0);
    return HOURLY_PROFILE.reduce(
      (sum, f, hour) => sum + (f / profileSum) * rate.periods[periodForHour(hour, rate.periods)].rate,
      0,
    );
  }
  let prevCap = 0;
  for (const tier of rate.tiers) {
    const cap = tier.limit ?? Infinity;
    if (usage <= cap) return tier.rate;
    prevCap = cap;
  }
  return rate.tiers[rate.tiers.length - 1].rate;
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

// Cost of a month's consumption given an explicit hourly import profile.
// TOU is priced hour by hour; flat/tiered price the monthly total.
export function monthlyCostFromHourly(hourlyImports, days, rate, includeFixed = true) {
  const monthTotal = hourlyImports.reduce((a, b) => a + b, 0) * days;
  let cost;
  if (rate.type === 'tou') {
    cost = hourlyImports.reduce(
      (sum, kWh, hour) => sum + kWh * days * rate.periods[periodForHour(hour, rate.periods)].rate,
      0,
    );
  } else {
    cost = monthlyCost(monthTotal, rate, false);
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

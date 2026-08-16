import { DAYS_IN_MONTH, HOURLY_PROFILE } from './assumptions.js';

// Seasonality comes from the user's actual billed kWh; only the intra-day
// shape comes from the generic profile.
// Returns daily[month][hour] = kWh consumed in that hour on an average day.
export function buildLoadShape(monthlyUsage) {
  const profileSum = HOURLY_PROFILE.reduce((a, b) => a + b, 0);
  return monthlyUsage.map((kWh, m) => {
    const perDay = (kWh || 0) / DAYS_IN_MONTH[m];
    return HOURLY_PROFILE.map((f) => (perDay * f) / profileSum);
  });
}

export function scaleShape(shape, factor) {
  return shape.map((day) => day.map((v) => v * factor));
}

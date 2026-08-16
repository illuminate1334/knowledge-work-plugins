import { monthlyCost } from './utilityCosts.js';

// Twelve months of bills is 24 hand-typed numbers before the tool shows you
// anything. Most people know their average bill. This lets them start there and
// refine later — the model states plainly that it is using an assumed shape.

// Generic residential seasonality: winter heating and summer cooling peaks.
export const SEASONAL_SHAPE = [
  1.05, 1.00, 0.92, 0.85, 0.88, 1.05,
  1.25, 1.25, 1.05, 0.87, 0.90, 1.03,
];

// Invert the rate schedule: what monthly usage produces this bill?
export function usageFromBill(bill, rate, { lo = 0, hi = 20000, tol = 0.01 } = {}) {
  if (!(bill > 0)) return 0;
  if (monthlyCost(hi, rate) < bill) return hi;
  let a = lo;
  let b = hi;
  while (b - a > tol) {
    const mid = (a + b) / 2;
    if (monthlyCost(mid, rate) < bill) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

// Spread an annual usage total across months using the seasonal prior.
export function estimateMonthlyUsage(annualUsage) {
  const sum = SEASONAL_SHAPE.reduce((x, y) => x + y, 0);
  return SEASONAL_SHAPE.map((w) => (annualUsage * w) / sum);
}

// Quick-start path: average monthly bill -> 12 monthly usage figures.
export function monthlyUsageFromAverageBill(avgBill, rate) {
  const monthlyUsage = usageFromBill(avgBill, rate);
  return estimateMonthlyUsage(monthlyUsage * 12);
}

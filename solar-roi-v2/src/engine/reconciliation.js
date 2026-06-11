import { monthlyCost } from './utilityCosts.js';

// The gate between rate confirmation and analysis: the model must reproduce
// the user's actual bills before any projection is shown. bills: [{usage, cost}]
export function reconcile(bills, rate) {
  const modeled = bills.reduce((sum, b) => sum + monthlyCost(b.usage, rate), 0);
  const actual = bills.reduce((sum, b) => sum + (b.cost || 0), 0);
  if (actual === 0) return { modeled, actual, gap: null, status: 'unknown' };
  const gap = (modeled - actual) / actual;
  const abs = Math.abs(gap);
  return {
    modeled,
    actual,
    gap,
    status: abs <= 0.03 ? 'match' : abs <= 0.10 ? 'close' : 'mismatch',
  };
}

// The inverse question, and the one a homeowner can actually act on:
// "below what installed price does this stop being a bad deal?"
// Solves NPV(price) = 0 by bisection. NPV is monotonically decreasing in price,
// so bisection is exact to the tolerance.
export function walkAwayPricePerWatt(npvAtPrice, { lo = 0.5, hi = 8.0, tol = 0.01 } = {}) {
  const npvLo = npvAtPrice(lo);
  const npvHi = npvAtPrice(hi);

  if (npvLo < 0) return { price: null, reason: 'never', note: 'Negative NPV even at $0.50/W — the tariff, not the price, is the problem.' };
  if (npvHi > 0) return { price: hi, reason: 'always', note: 'Positive NPV even at $8.00/W.' };

  let a = lo;
  let b = hi;
  while (b - a > tol) {
    const mid = (a + b) / 2;
    if (npvAtPrice(mid) > 0) a = mid;
    else b = mid;
  }
  return { price: (a + b) / 2, reason: 'solved', note: null };
}

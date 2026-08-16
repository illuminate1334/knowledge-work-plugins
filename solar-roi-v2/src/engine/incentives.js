// The federal ITC is a NON-REFUNDABLE credit: it can only offset tax you
// actually owe. v2 subtracted 30% from capex unconditionally, which overstates
// the benefit for retirees and anyone whose liability is below the credit.
// Unused credit carries forward.
//
// Returns the credit realized in each year (index 0 = filing year), so
// projections can treat it as cash arriving over time rather than an instant
// capex discount.
export function itcSchedule(grossCost, a, { apply = true } = {}) {
  const credit = apply ? grossCost * a.itcRate : 0;
  const liability = Math.max(0, a.annualTaxLiability || 0);
  const years = Math.max(1, a.itcCarryforwardYears || 1);

  const realized = [];
  let remaining = credit;
  for (let i = 0; i < years && remaining > 0; i++) {
    const take = Math.min(remaining, liability);
    realized.push(take);
    remaining -= take;
    if (liability === 0) break; // no liability at all — nothing will ever be realized
  }

  return {
    credit,
    realized,
    totalRealized: realized.reduce((a2, b) => a2 + b, 0),
    forfeited: remaining,
    fullyUsable: remaining <= 0.01 && credit > 0,
  };
}

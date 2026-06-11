// Standard amortization. financing shape:
// { type: 'cash' } or { type: 'loan', apr, termYears, down, applyITC }
export function loanPayment(principal, apr, years) {
  const r = apr / 100 / 12;
  const n = years * 12;
  if (n <= 0 || principal <= 0) return 0;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function totalLoanCost(principal, apr, years) {
  return loanPayment(principal, apr, years) * years * 12;
}

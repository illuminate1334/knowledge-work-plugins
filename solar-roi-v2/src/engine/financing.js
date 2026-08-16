// Standard amortization. financing shape:
// { type: 'cash' }
// { type: 'loan', apr, termYears, down, applyITC, itcPaydown: bool, itcPaydownMonth }
export function loanPayment(principal, apr, years) {
  const r = apr / 100 / 12;
  const n = years * 12;
  if (n <= 0 || principal <= 0) return 0;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function totalLoanCost(principal, apr, years) {
  return loanPayment(principal, apr, years) * years * 12;
}

export function balanceAfter(principal, apr, years, monthsPaid) {
  const r = apr / 100 / 12;
  const pmt = loanPayment(principal, apr, years);
  if (r === 0) return Math.max(0, principal - pmt * monthsPaid);
  const bal = principal * Math.pow(1 + r, monthsPaid) - pmt * ((Math.pow(1 + r, monthsPaid) - 1) / r);
  return Math.max(0, bal);
}

// The solar-loan re-amortization structure. These loans are quoted at a low
// payment that ASSUMES you drop the tax credit onto the principal around month
// 18. If you don't — or if your tax liability can't absorb the credit — the
// lender re-amortizes the remaining balance over the remaining term and the
// payment jumps, often 25-35%. This is the single most common unpleasant
// surprise in residential solar financing, and no version of this tool
// modelled it until now.
export function loanSchedule({ principal, apr, termYears, itcPaydown = 0, paydownMonth = 18 }) {
  const n = termYears * 12;
  const initial = loanPayment(principal, apr, termYears);
  if (itcPaydown <= 0 || paydownMonth >= n) {
    return { initialPayment: initial, laterPayment: initial, paydownMonth: null, months: n };
  }
  const bal = balanceAfter(principal, apr, termYears, paydownMonth) - itcPaydown;
  const remainingMonths = n - paydownMonth;
  const later = bal <= 0 ? 0 : loanPayment(bal, apr, remainingMonths / 12);
  return { initialPayment: initial, laterPayment: later, paydownMonth, months: n };
}

// Payment owed in a given year (1-indexed) under a re-amortizing schedule.
export function annualDebtService(schedule, year) {
  if (!schedule || schedule.months <= 0) return 0;
  const startMonth = (year - 1) * 12;
  let total = 0;
  for (let i = 0; i < 12; i++) {
    const m = startMonth + i;
    if (m >= schedule.months) break;
    total += schedule.paydownMonth != null && m >= schedule.paydownMonth
      ? schedule.laterPayment
      : schedule.initialPayment;
  }
  return total;
}

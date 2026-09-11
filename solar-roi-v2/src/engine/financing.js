// Standard amortization. financing shape:
// { type: 'cash' }
// { type: 'loan', apr, termYears, down, applyITC, itcPaydown: bool, itcPaydownMonth }

// A 0-year term would make loanPayment return 0 and silently skip debt.
export function validTermYears(years) {
  const n = Number(years);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function loanPayment(principal, apr, years) {
  const term = validTermYears(years);
  const r = apr / 100 / 12;
  const n = term * 12;
  if (n <= 0 || principal <= 0) return 0;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function totalLoanCost(principal, apr, years) {
  return loanPayment(principal, apr, years) * validTermYears(years) * 12;
}

export function remainingBalance(principal, apr, payment, monthsPaid) {
  if (monthsPaid <= 0) return Math.max(0, principal);
  const r = apr / 100 / 12;
  if (r === 0) return Math.max(0, principal - payment * monthsPaid);
  const bal = principal * Math.pow(1 + r, monthsPaid) - payment * ((Math.pow(1 + r, monthsPaid) - 1) / r);
  return Math.max(0, bal);
}

export function balanceAfter(principal, apr, years, monthsPaid) {
  return remainingBalance(principal, apr, loanPayment(principal, apr, years), monthsPaid);
}

// Solar loans are quoted at a payment that ASSUMES the tax credit is dropped
// onto principal around month 18. The borrower pays that teaser on the full
// financed amount. At the recast date:
//   - if the credit is applied, remaining balance drops and the payment stays low
//   - if it is not, the remaining (higher) balance is re-amortized and the
//     payment jumps, often 25–35%
//
// itcPaydown (number) is the legacy API: dollars applied; >0 implies apply.
// Prefer itcExpected (the credit the quote assumed) + applyPaydown (bool).
export function loanSchedule({
  principal,
  apr,
  termYears,
  itcPaydown = 0,
  itcExpected,
  applyPaydown,
  paydownMonth = 18,
} = {}) {
  const years = validTermYears(termYears);
  const n = years * 12;
  const expected = Number.isFinite(itcExpected) ? Math.max(0, itcExpected) : Math.max(0, itcPaydown);
  const apply = applyPaydown ?? expected > 0;

  const quoted = loanPayment(Math.max(0, principal - expected), apr, years);
  const full = loanPayment(principal, apr, years);

  if (expected <= 0 || paydownMonth >= n) {
    return {
      initialPayment: full,
      laterPayment: full,
      trapPayment: full,
      quotedPayment: full,
      paydownMonth: null,
      months: n,
    };
  }

  const bal = remainingBalance(principal, apr, quoted, paydownMonth);
  const remainingYears = (n - paydownMonth) / 12;
  const afterPaydown = bal - expected <= 0 ? 0 : loanPayment(bal - expected, apr, remainingYears);
  const trap = bal <= 0 ? 0 : loanPayment(bal, apr, remainingYears);

  return {
    initialPayment: quoted,
    laterPayment: apply ? afterPaydown : trap,
    trapPayment: trap,
    quotedPayment: quoted,
    paydownMonth,
    months: n,
  };
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

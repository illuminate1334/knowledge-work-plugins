import { loanPayment } from './financing.js';
import { SCENARIOS } from './assumptions.js';

// 25-year cash-flow projection. Fixes vs v1:
// - escalator is a cumulative multiplier (v1's Math.pow placement compounded wrong)
// - ITC actually reduces capex
// - loan payments flow through the years they're owed
// - NPV computed at the assumption-panel discount rate
export function project({
  baseUsage,            // current annual kWh
  year1Production,      // kWh from sizeSystem
  avgRetailRate,        // $/kWh from utilityCosts.avgRetailRate
  nmCreditRate,         // export credit as fraction of retail (1.0 = full net metering)
  batteryAnnual,        // $/yr from batteryEconomics (0 if no battery)
  grossCost,            // system (+battery) cost before incentives
  scenario,             // {cost, consumption} growth rates
  financing,            // {type:'cash'} | {type:'loan', apr, termYears, down, applyITC}
  a,                    // assumptions
}) {
  const applyITC = financing.applyITC !== false;
  const netCapex = grossCost * (1 - (applyITC ? a.itcRate : 0));
  const isLoan = financing.type === 'loan';
  const principal = isLoan ? Math.max(0, netCapex - (financing.down || 0)) : 0;
  const pmt = isLoan ? loanPayment(principal, financing.apr, financing.termYears) : 0;
  const upfront = isLoan ? (financing.down || 0) : netCapex;

  let escalator = 1;
  let usageMult = 1;
  let cumulative = -upfront;
  let npv = -upfront;
  const rows = [{ year: 0, net: -upfront, cumulative }];

  for (let y = 1; y <= a.analysisYears; y++) {
    escalator *= 1 + scenario.cost;
    usageMult *= 1 + scenario.consumption;

    const prod = year1Production * Math.pow(1 - a.panelDegradation, y - 1);
    const demand = baseUsage * usageMult;
    const selfUse = Math.min(prod, demand);
    const exported = prod - selfUse;
    const solarSavings = (selfUse + exported * nmCreditRate) * avgRetailRate * escalator;
    const batterySavings = batteryAnnual * escalator;
    const loanPayments = isLoan && y <= financing.termYears ? pmt * 12 : 0;

    const net = solarSavings + batterySavings - loanPayments;
    cumulative += net;
    npv += net / Math.pow(1 + a.discountRate, y);
    rows.push({ year: y, production: prod, solarSavings, batterySavings, loanPayments, net, cumulative });
  }

  const paybackYear = rows.find((r) => r.year > 0 && r.cumulative >= 0)?.year ?? null;
  return {
    rows,
    npv,
    netCapex,
    upfront,
    monthlyPayment: pmt,
    paybackYear,
    netGain: cumulative,
    totalInvested: isLoan ? upfront + pmt * 12 * financing.termYears : netCapex,
  };
}

// Signed annualized return — losses report as losses (v1 used Math.abs).
export function annualizedReturn(invested, netGain, years = 25) {
  if (invested <= 0) return 0;
  const ratio = (invested + netGain) / invested; // netGain can be negative
  if (ratio <= 0) return -100;
  return (Math.pow(ratio, 1 / years) - 1) * 100;
}

export function runSensitivity(params) {
  return Object.fromEntries(
    Object.entries(SCENARIOS).map(([name, scenario]) => [name, project({ ...params, scenario })]),
  );
}

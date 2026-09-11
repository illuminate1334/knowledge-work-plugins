import { loanSchedule, annualDebtService } from './financing.js';
import { itcSchedule } from './incentives.js';
import { lifecycleCost } from './lifecycle.js';
import { solarSavings } from './netting.js';
import { dispatch } from './battery.js';
import { scaleShape } from './loadShape.js';
import { SCENARIOS } from './assumptions.js';

// 25-year cash flow built from first principles:
//   savings   = (bill without solar) − (bill with solar), netted hour by hour
//   ITC       = arrives when tax liability can absorb it, not as a capex discount
//               — except when it is applied to loan principal, in which case it is
//               counted only as a reduction in debt, not again as a cash inflow
//   lifecycle = inverter, O&M, battery, roof rework — real money, real years
//   debt      = re-amortizing solar-loan schedule, including the ITC paydown trap
export function project({
  loadShape,
  productionShape,
  rate,
  creditRate,
  systemKW,
  grossCost,
  hasBattery = false,
  scenario,
  financing,
  a,
}) {
  const applyITC = financing.applyITC !== false;
  const itc = itcSchedule(grossCost, a, { apply: applyITC });

  const isLoan = financing.type === 'loan';
  const down = isLoan ? financing.down || 0 : 0;
  // Loans finance the GROSS cost; the credit shows up later at tax time.
  const principal = isLoan ? Math.max(0, grossCost - down) : 0;
  const itcExpected = isLoan ? itc.totalRealized : 0;
  const applyPaydown = isLoan && financing.itcPaydown && itcExpected > 0;
  const schedule = isLoan
    ? loanSchedule({
      principal,
      apr: financing.apr,
      termYears: financing.termYears,
      itcExpected,
      applyPaydown,
    })
    : null;

  const upfront = isLoan ? down : grossCost;

  let escalator = 1;
  let usageMult = 1;
  let cumulative = -upfront;
  let npv = -upfront;
  const rows = [{ year: 0, net: -upfront, cumulative, savings: 0, itc: 0, lifecycle: 0, debt: 0 }];

  let year1 = null;

  for (let y = 1; y <= a.analysisYears; y++) {
    const prodY = scaleShape(productionShape, Math.pow(1 - a.panelDegradation, y - 1));
    const loadY = scaleShape(loadShape, usageMult);
    const shift = hasBattery ? dispatch({ productionShape: prodY, loadShape: loadY, rate, creditRate, a }) : null;
    const netted = solarSavings({ productionShape: prodY, loadShape: loadY, rate, creditRate, batteryShift: shift });

    const savings = netted.savings * escalator;
    const { cost: lifecycle } = lifecycleCost(y, { systemKW, hasBattery, a });
    const debt = isLoan ? annualDebtService(schedule, y) : 0;
    const realized = itc.realized[y - 1] || 0;
    // When the credit is applied to principal, its value is the lower debt
    // service — adding it here again would count the same dollars twice.
    const credit = applyPaydown ? 0 : realized;

    const net = savings + credit - lifecycle - debt;
    cumulative += net;
    npv += net / Math.pow(1 + a.discountRate, y);

    if (y === 1) year1 = netted;

    rows.push({
      year: y,
      savings,
      itc: credit,
      lifecycle,
      debt,
      net,
      cumulative,
      production: netted.exported + netted.selfConsumed,
      selfConsumptionRate: netted.selfConsumptionRate,
    });

    escalator *= 1 + scenario.cost;
    usageMult *= 1 + scenario.consumption;
  }

  const paybackYear = rows.find((r) => r.year > 0 && r.cumulative >= 0)?.year ?? null;
  const totalDebt = rows.reduce((s, r) => s + r.debt, 0);

  return {
    rows,
    npv,
    itc,
    schedule,
    upfront,
    netCapex: grossCost - itc.totalRealized,
    paybackYear,
    netGain: cumulative,
    totalInvested: upfront + totalDebt,
    year1,
    monthlyPayment: schedule ? schedule.quotedPayment : 0,
    laterMonthlyPayment: schedule ? schedule.trapPayment : 0,
  };
}

// Signed annualized return — losses report as losses.
export function annualizedReturn(invested, netGain, years = 25) {
  if (invested <= 0) return 0;
  const ratio = (invested + netGain) / invested;
  if (ratio <= 0) return -100;
  return (Math.pow(ratio, 1 / years) - 1) * 100;
}

export function runSensitivity(params) {
  return Object.fromEntries(
    Object.entries(SCENARIOS).map(([name, scenario]) => [name, project({ ...params, scenario })]),
  );
}

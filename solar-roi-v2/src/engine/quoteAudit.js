// Adversarial audit of an installer's quote.
//
// The homeowner's real question is not "should I go solar" in the abstract —
// it's "is the number on this proposal honest?" Every check compares a claim
// against the independently-modelled value and reports the gap.

const HIGH = 'high';
const MED = 'medium';
const LOW = 'low';

function pct(claimed, modeled) {
  if (!modeled) return null;
  return (claimed - modeled) / Math.abs(modeled);
}

export function auditQuote({ quote, model, rate, creditRate, a }) {
  const findings = [];
  const add = (severity, title, detail, claimed, modeled) =>
    findings.push({ severity, title, detail, claimed, modeled });

  // 1. Price per watt against the market reference.
  if (quote.totalPrice > 0 && quote.systemKW > 0) {
    const perWatt = quote.totalPrice / (quote.systemKW * 1000);
    const gap = pct(perWatt, a.solarCostPerWatt);
    if (gap != null && gap > 0.20) {
      add(HIGH, 'Priced above market',
        `$${perWatt.toFixed(2)}/W is ${(gap * 100).toFixed(0)}% above the $${a.solarCostPerWatt.toFixed(2)}/W reference in your assumptions.`,
        `$${perWatt.toFixed(2)}/W`, `$${a.solarCostPerWatt.toFixed(2)}/W`);
    } else if (gap != null && gap < -0.15) {
      add(LOW, 'Priced below market',
        `$${perWatt.toFixed(2)}/W is below the reference — verify equipment tier and warranty terms.`,
        `$${perWatt.toFixed(2)}/W`, `$${a.solarCostPerWatt.toFixed(2)}/W`);
    }
  }

  // 2. Claimed production vs geometry-based model.
  if (quote.annualProductionKWh > 0 && model.year1Production > 0) {
    const gap = pct(quote.annualProductionKWh, model.year1Production);
    if (gap > 0.10) {
      add(HIGH, 'Optimistic production estimate',
        `Quote claims ${Math.round(quote.annualProductionKWh).toLocaleString()} kWh/yr; modelling your orientation, tilt, and shading gives ${Math.round(model.year1Production).toLocaleString()} kWh/yr (${(gap * 100).toFixed(0)}% lower).`,
        `${Math.round(quote.annualProductionKWh).toLocaleString()} kWh`,
        `${Math.round(model.year1Production).toLocaleString()} kWh`);
    }
  }

  // 3. Claimed first-year savings.
  if (quote.firstYearSavings > 0 && model.year1Savings > 0) {
    const gap = pct(quote.firstYearSavings, model.year1Savings);
    if (gap > 0.15) {
      add(HIGH, 'First-year savings overstated',
        `Quote claims $${Math.round(quote.firstYearSavings).toLocaleString()}; hour-by-hour netting against your tariff gives $${Math.round(model.year1Savings).toLocaleString()}.`,
        `$${Math.round(quote.firstYearSavings).toLocaleString()}`,
        `$${Math.round(model.year1Savings).toLocaleString()}`);
    }
  }

  // 4. Back out the rate escalation the 25-year claim requires.
  if (quote.lifetimeSavings > 0 && model.year1Savings > 0) {
    const implied = impliedEscalator(quote.lifetimeSavings, model.year1Savings, a.analysisYears);
    if (implied != null && implied > 0.035) {
      add(HIGH, 'Lifetime claim needs an aggressive rate forecast',
        `$${Math.round(quote.lifetimeSavings).toLocaleString()} over ${a.analysisYears} years implies utility rates rising ${(implied * 100).toFixed(1)}%/yr, every year. Historic residential averages run nearer 2–3%.`,
        `${(implied * 100).toFixed(1)}%/yr implied`, '2–3%/yr historic');
    }
  }

  // 5. Non-refundable ITC.
  if (model.itc && model.itc.credit > 0 && !model.itc.fullyUsable) {
    add(HIGH, 'Tax credit may not be fully usable',
      `The quote's economics assume the full $${Math.round(model.itc.credit).toLocaleString()} credit. At a $${Math.round(a.annualTaxLiability).toLocaleString()}/yr tax liability you would realize $${Math.round(model.itc.totalRealized).toLocaleString()} and forfeit $${Math.round(model.itc.forfeited).toLocaleString()}.`,
      `$${Math.round(model.itc.credit).toLocaleString()} credit`,
      `$${Math.round(model.itc.totalRealized).toLocaleString()} realized`);
  }

  // 6. The re-amortization trap — laterMonthlyPayment is the recast if the
  // credit is NOT applied, monthlyPayment is the quoted teaser that assumes it is.
  if (model.monthlyPayment > 0 && model.laterMonthlyPayment > model.monthlyPayment * 1.05) {
    const quoted = quote.monthlyPayment > 0 ? quote.monthlyPayment : model.monthlyPayment;
    add(HIGH, 'Payment jumps if the credit is not applied to principal',
      `The $${Math.round(quoted)}/mo payment assumes you pay the tax credit onto the loan. If you don't, the payment re-amortizes to about $${Math.round(model.laterMonthlyPayment)}/mo.`,
      `$${Math.round(quoted)}/mo`,
      `$${Math.round(model.laterMonthlyPayment)}/mo`);
  }

  // 7. Does the quoted array physically fit?
  if (quote.systemKW > 0 && model.roofMaxKW > 0 && quote.systemKW > model.roofMaxKW * 1.05) {
    add(HIGH, 'Array may not fit the usable roof',
      `The quote specifies ${quote.systemKW.toFixed(1)} kW; the usable roof area you entered supports roughly ${model.roofMaxKW.toFixed(1)} kW. Ask for the panel layout.`,
      `${quote.systemKW.toFixed(1)} kW`, `${model.roofMaxKW.toFixed(1)} kW`);
  }

  // 8. Ownership costs.
  if (!quote.includesLifecycleCosts) {
    add(MED, 'Ownership costs excluded',
      `Quotes usually show gross savings. Inverter replacement (~year ${a.inverterReplacementYear}), O&M, and insurance total roughly $${Math.round(model.lifecycleTotal).toLocaleString()} across ${a.analysisYears} years in this model.`,
      'not shown', `$${Math.round(model.lifecycleTotal).toLocaleString()}`);
  }

  // 9. Export credit.
  if (creditRate < 0.99) {
    add(MED, 'Partial export credit changes the math',
      `Your tariff credits exports at ${Math.round(creditRate * 100)}% of retail, so only the ${Math.round((model.selfConsumptionRate || 0) * 100)}% of production you consume on-site earns full value. Proposals that assume 1:1 net metering overstate savings materially.`,
      '1:1 assumed', `${Math.round(creditRate * 100)}% of retail`);
  }

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((x, y) => order[x.severity] - order[y.severity]);

  return {
    findings,
    verdict: findings.some((f) => f.severity === HIGH)
      ? 'Claims do not hold up'
      : findings.length > 0
        ? 'Broadly reasonable, with caveats'
        : 'Consistent with independent modelling',
  };
}

// Solve for the escalation rate that makes a lifetime-savings claim add up,
// given a year-1 figure. Bisection on a monotonic series.
export function impliedEscalator(lifetime, year1, years, { lo = -0.05, hi = 0.20 } = {}) {
  const total = (g) => {
    let esc = 1;
    let sum = 0;
    for (let y = 1; y <= years; y++) {
      sum += year1 * esc;
      esc *= 1 + g;
    }
    return sum;
  };
  if (total(hi) < lifetime) return null; // unreachable at any plausible rate
  if (total(lo) > lifetime) return lo;
  let a = lo;
  let b = hi;
  for (let i = 0; i < 60; i++) {
    const mid = (a + b) / 2;
    if (total(mid) < lifetime) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

import React, { useEffect, useMemo } from 'react';
import { sizeSystem, grossSystemCost } from '../../engine/production.js';
import { batteryEconomics } from '../../engine/battery.js';
import { avgRetailRate } from '../../engine/utilityCosts.js';
import { runSensitivity } from '../../engine/projections.js';
import { recommend } from '../../engine/recommendations.js';
import ProjectionChart from '../charts/ProjectionChart.jsx';
import TOUChart from '../charts/TOUChart.jsx';
import SavingsBreakdownChart from '../charts/SavingsBreakdownChart.jsx';

export default function Analysis({ bills, rateInfo, property, financing, assumptions, setAnalysis, next, back }) {
  const result = useMemo(() => {
    const a = assumptions;
    const yearlyUsage = bills.reduce((s, b) => s + (parseFloat(b.usage) || 0), 0);
    const rate = rateInfo.rate;
    const retail = avgRetailRate(yearlyUsage, rate);
    const nmCreditRate = rateInfo.netMetering.available ? rateInfo.netMetering.creditRate : 0;

    const sizing = sizeSystem({ yearlyUsage, roofSqFt: property.roofSqFt, orientation: property.orientation, shade: property.shade, a });
    const solarCost = grossSystemCost(sizing.systemKW, a);
    const battery = batteryEconomics({ rate, a });

    const common = {
      baseUsage: yearlyUsage,
      year1Production: sizing.year1Production,
      avgRetailRate: retail,
      nmCreditRate,
      financing,
      a,
    };
    const solarOnly = runSensitivity({ ...common, batteryAnnual: 0, grossCost: solarCost });
    const solarBattery = runSensitivity({ ...common, batteryAnnual: battery.annualSavings, grossCost: solarCost + battery.cost });

    const rec = recommend([
      { name: 'Solar only', sens: solarOnly, invested: solarOnly.base.totalInvested },
      {
        name: 'Solar + battery',
        sens: solarBattery,
        invested: solarBattery.base.totalInvested,
        note: battery.annualSavings === 0 ? battery.basis : undefined,
      },
    ]);

    const co2TonsYr1 = sizing.year1Production * a.co2TonsPerKWh;

    return { yearlyUsage, retail, sizing, solarCost, battery, solarOnly, solarBattery, rec, co2TonsYr1, rate };
  }, [bills, rateInfo, property, financing, assumptions]);

  // Persist for the Report step.
  useEffect(() => setAnalysis(result), [result, setAnalysis]);

  const { sizing, battery, solarOnly, solarBattery, rate } = result;
  const base = solarOnly.base;

  return (
    <div className="card">
      <h2>Analysis</h2>
      <p className="sub">
        {sizing.systemKW.toFixed(1)} kW system · {Math.round(sizing.year1Production).toLocaleString()} kWh/yr ·{' '}
        {Math.round(sizing.offsetPct * 100)}% of your usage · derate ×{sizing.derate.toFixed(2)} ({property.orientation}, {property.shade} shade)
      </p>

      {sizing.roofLimited && (
        <div className="warnbox">
          Roof-limited: your roof can't hold a system covering 100% of usage. Sized to the roof's maximum instead.
        </div>
      )}

      <div className="metrics">
        <div className="metric">
          <div className={`v ${base.npv < 0 ? 'neg' : ''}`}>${Math.round(base.npv).toLocaleString()}</div>
          <div className="k">NPV, solar only (base case, {Math.round(assumptions.discountRate * 100)}% discount)</div>
        </div>
        <div className="metric">
          <div className="v">{base.paybackYear ? `${base.paybackYear} yrs` : 'never'}</div>
          <div className="k">Payback, solar only</div>
        </div>
        <div className="metric">
          <div className={`v ${solarBattery.base.npv < 0 ? 'neg' : ''}`}>${Math.round(solarBattery.base.npv).toLocaleString()}</div>
          <div className="k">NPV, solar + battery</div>
        </div>
        <div className="metric">
          <div className="v">${Math.round(base.upfront).toLocaleString()}</div>
          <div className="k">{base.monthlyPayment > 0 ? `Upfront + $${base.monthlyPayment.toFixed(0)}/mo loan` : 'Upfront (after ITC)'}</div>
        </div>
      </div>

      {battery.annualSavings === 0 && <div className="warnbox">{battery.basis}</div>}
      {battery.annualSavings > 0 && <p className="note">Battery arbitrage basis: {battery.basis} = ${Math.round(battery.annualSavings)}/yr.</p>}

      <ProjectionChart solarOnly={solarOnly} solarBattery={solarBattery} />
      {rate.type === 'tou' && <TOUChart rate={rate} />}
      <SavingsBreakdownChart solarOnly={solarOnly.base} solarBattery={solarBattery.base} />

      <div className="nav">
        <button onClick={back}>Back</button>
        <button className="primary" onClick={next}>View report</button>
      </div>
    </div>
  );
}

import React from 'react';
import ProjectionChart from '../charts/ProjectionChart.jsx';
import TOUChart from '../charts/TOUChart.jsx';
import DailyProfileChart from '../charts/DailyProfileChart.jsx';
import AuditFindings from './AuditFindings.jsx';
import { annualizedReturn } from '../../engine/projections.js';

const money = (v) => `$${Math.round(v).toLocaleString()}`;

export default function Results({ model, mode, assumptions, rateInfo, financing, gate }) {
  const { solarOnly, solarBattery, rec, walkAway, sized } = model;
  const base = solarOnly.base;
  const lo = solarOnly.low.npv;
  const hi = solarOnly.high.npv;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ rateInfo, financing, assumptions, model }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solar-roi-model.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="card headline">
        <h2>{rec.pick ?? 'Hold off'}</h2>
        <p className="sub">{rec.rationale}</p>

        <div className="bignum">
          <div>
            <div className={`v ${hi < 0 ? 'neg' : ''}`}>{money(lo)} → {money(hi)}</div>
            <div className="k">25-year NPV range across low/high rate-escalation scenarios (base: {money(base.npv)})</div>
          </div>
        </div>

        <div className="metrics">
          <div className="metric">
            <div className="v">{walkAway.price ? `$${walkAway.price.toFixed(2)}/W` : '—'}</div>
            <div className="k">Walk-away price — above this, it stops paying back</div>
          </div>
          <div className="metric">
            <div className="v">{base.paybackYear ? `${base.paybackYear} yrs` : 'never'}</div>
            <div className="k">Payback</div>
          </div>
          <div className="metric">
            <div className={`v ${model.annualizedReturn < 0 ? 'neg' : ''}`}>{model.annualizedReturn.toFixed(1)}%</div>
            <div className="k">Annualized return</div>
          </div>
          <div className="metric">
            <div className="v">{Math.round(model.netNoBatt.selfConsumptionRate * 100)}%</div>
            <div className="k">Solar consumed on site</div>
          </div>
        </div>

        {walkAway.note && <div className="warnbox">{walkAway.note}</div>}
        {!base.itc.fullyUsable && base.itc.credit > 0 && (
          <div className="warnbox">
            Tax credit: {money(base.itc.credit)} earned, but only {money(base.itc.totalRealized)} usable at a{' '}
            {money(assumptions.annualTaxLiability)}/yr liability — {money(base.itc.forfeited)} would be forfeited.
          </div>
        )}
        {sized.roofLimited && (
          <div className="warnbox">Roof-limited: the array can't cover your full usage at this orientation.</div>
        )}
        {gate?.status === 'mismatch' && (
          <div className="warnbox">
            The rate plan doesn't reproduce your actual bills — treat every number here as unreliable until that reconciles.
          </div>
        )}
        <div className="row no-print" style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => window.print()}>Print one-page summary</button>
          <button onClick={exportJson}>Export JSON</button>
        </div>
      </div>

      {mode === 'audit' && <AuditFindings audit={model.audit} />}

      <div className="card">
        <h2>System & costs</h2>
        <div className="metrics">
          <div className="metric"><div className="v">{model.systemKW.toFixed(1)} kW</div><div className="k">System size</div></div>
          <div className="metric"><div className="v">{Math.round(model.year1Production).toLocaleString()}</div><div className="k">kWh year 1</div></div>
          <div className="metric"><div className="v">{money(model.solarGross)}</div><div className="k">Gross cost</div></div>
          <div className="metric"><div className="v">{money(model.lifecycleTotal)}</div><div className="k">Lifetime O&M + inverter</div></div>
          <div className="metric"><div className="v">{money(model.netNoBatt.savings)}</div><div className="k">Year-1 bill savings</div></div>
          <div className="metric">
            <div className={`v ${model.batteryAnnualValue < 0 ? 'neg' : ''}`}>{money(model.batteryAnnualValue)}</div>
            <div className="k">Battery adds (per year)</div>
          </div>
        </div>
        {model.batteryAnnualValue <= 0 && (
          <p className="note">
            A battery is worth nothing on this tariff — under full net metering the grid already banks your
            surplus at retail value, so storage only burns round-trip losses. Its value here is backup power.
          </p>
        )}
        {financing.type === 'loan' && base.laterMonthlyPayment > base.monthlyPayment * 1.05 && (
          <div className="warnbox">
            Loan payment starts at ${Math.round(base.monthlyPayment)}/mo and re-amortizes to $
            {Math.round(base.laterMonthlyPayment)}/mo if the tax credit isn't applied to principal.
          </div>
        )}
      </div>

      <DailyProfileChart model={model} />

      <div className="card">
        <ProjectionChart solarOnly={solarOnly} solarBattery={solarBattery} />
      </div>

      {rateInfo.rate.type === 'tou' && (
        <div className="card"><TOUChart rate={rateInfo.rate} /></div>
      )}

      <div className="card">
        <h2>How the recommendation scored</h2>
        <table className="scoring">
          <thead><tr><th>Option</th><th>Factor</th><th>Value</th><th>Score</th><th>Weight</th></tr></thead>
          <tbody>
            {rec.scored.map((opt) =>
              opt.factors.map((f, i) => (
                <tr key={`${opt.name}-${f.key}`}>
                  {i === 0 && (
                    <td rowSpan={opt.factors.length}>
                      <strong>{opt.name}</strong><br />
                      <span className="note">{(opt.total * 100).toFixed(0)}/100</span>
                    </td>
                  )}
                  <td>{f.label}</td>
                  <td>{f.key === 'payback' ? (f.raw ? `${f.raw} yrs` : '—') : f.key === 'return' ? `${f.raw.toFixed(1)}%` : money(f.raw)}</td>
                  <td>{f.score.toFixed(2)}</td>
                  <td>{f.weight}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

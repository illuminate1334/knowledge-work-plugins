import React from 'react';
import { annualizedReturn } from '../../engine/projections.js';

export default function Report({ analysis, rateInfo, financing, assumptions, back }) {
  if (!analysis) return <div className="card"><p>Run the analysis first.</p></div>;
  const { rec, sizing, solarCost, battery, solarOnly, solarBattery, co2TonsYr1, yearlyUsage, retail } = analysis;

  const options = [
    { name: 'Solar only', sens: solarOnly },
    { name: 'Solar + battery', sens: solarBattery },
  ];

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ rateInfo, financing, assumptions, analysis: { ...analysis, rec } }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solar-roi-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <h2>Report</h2>
      <p className="sub">
        {rateInfo.utility} · {rateInfo.rate.name} · effective rate ${retail.toFixed(3)}/kWh at {Math.round(yearlyUsage).toLocaleString()} kWh/yr
      </p>

      <div className="gate match" style={{ fontSize: 15 }}>
        <strong>Recommendation:</strong> {rec.pick ?? 'Hold off'} — {rec.rationale}
      </div>

      {options.map(({ name, sens }) => {
        const b = sens.base;
        const ret = annualizedReturn(b.totalInvested, b.netGain, assumptions.analysisYears);
        return (
          <div key={name} style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16 }}>{name}</h2>
            <div className="metrics">
              <div className="metric"><div className="v">${Math.round(b.netCapex).toLocaleString()}</div><div className="k">Net cost after ITC</div></div>
              <div className="metric"><div className={`v ${b.npv < 0 ? 'neg' : ''}`}>${Math.round(b.npv).toLocaleString()}</div><div className="k">NPV ({assumptions.analysisYears} yrs)</div></div>
              <div className="metric"><div className={`v ${b.netGain < 0 ? 'neg' : ''}`}>${Math.round(b.netGain).toLocaleString()}</div><div className="k">Net gain (nominal)</div></div>
              <div className="metric"><div className={`v ${ret < 0 ? 'neg' : ''}`}>{ret.toFixed(1)}%</div><div className="k">Annualized return (signed)</div></div>
              <div className="metric"><div className="v">{b.paybackYear ? `${b.paybackYear} yrs` : '—'}</div><div className="k">Payback</div></div>
            </div>
            <p className="note">
              Scenario range (low → high escalation): NPV ${Math.round(sens.low.npv).toLocaleString()} → ${Math.round(sens.high.npv).toLocaleString()}.
              {financing.type === 'loan' && b.monthlyPayment > 0 && <> Loan: ${b.monthlyPayment.toFixed(0)}/mo for {financing.termYears} yrs at {financing.apr}% APR.</>}
            </p>
          </div>
        );
      })}

      <h2 style={{ fontSize: 16, marginTop: 18 }}>How the recommendation was scored</h2>
      <table className="scoring">
        <thead>
          <tr><th>Option</th><th>Factor</th><th>Value</th><th>Score</th><th>Weight</th><th>Weighted</th></tr>
        </thead>
        <tbody>
          {rec.scored.map((opt) =>
            opt.factors.map((f, i) => (
              <tr key={`${opt.name}-${f.key}`}>
                {i === 0 && <td rowSpan={opt.factors.length}><strong>{opt.name}</strong><br /><span className="note">total {(opt.total * 100).toFixed(0)}/100</span></td>}
                <td>{f.label}</td>
                <td>{formatRaw(f)}</td>
                <td>{f.score.toFixed(2)}</td>
                <td>{f.weight}</td>
                <td>{(f.score * f.weight).toFixed(3)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      {rec.scored.find((o) => o.note) && (
        <p className="note">Note: {rec.scored.find((o) => o.note).note}</p>
      )}

      <p className="note" style={{ marginTop: 14 }}>
        Environmental: ~{co2TonsYr1.toFixed(1)} tons CO₂ avoided in year 1 (eGRID SRMW factor).
        System: {sizing.systemKW.toFixed(1)} kW gross cost ${Math.round(solarCost).toLocaleString()};
        battery ${Math.round(battery.cost).toLocaleString()}.
      </p>

      <div className="nav">
        <button onClick={back}>Back</button>
        <button className="primary" onClick={exportJson}>Export report (JSON)</button>
      </div>
    </div>
  );
}

function formatRaw(f) {
  if (f.raw == null) return '—';
  if (f.key === 'payback') return `${f.raw} yrs`;
  if (f.key === 'return') return `${f.raw.toFixed(1)}%/yr`;
  return `$${Math.round(f.raw).toLocaleString()}`;
}

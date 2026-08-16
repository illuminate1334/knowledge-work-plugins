import React from 'react';

const money = (v) => `$${Math.round(v).toLocaleString()}`;

// The deliverable a homeowner can carry into a sales conversation, or an
// advisor can hand a client. Hidden on screen, laid out for one printed page.
export default function PrintSheet({ model, mode, assumptions, rateInfo, financing, proposal }) {
  const base = model.solarOnly.base;
  const { walkAway, rec, solarOnly } = model;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="print-sheet">
      <header className="ps-head">
        <div>
          <h1>{mode === 'advise' ? 'Solar Proposal' : 'Solar Financial Assessment'}</h1>
          <div className="ps-sub">
            {rateInfo.utility} · {rateInfo.rate.name} · {model.systemKW.toFixed(1)} kW · {today}
          </div>
        </div>
        {mode === 'advise' && (
          <div className="ps-meta">
            {proposal.company && <div><strong>{proposal.company}</strong></div>}
            {proposal.preparedFor && <div>Prepared for: {proposal.preparedFor}</div>}
            {proposal.preparedBy && <div>Prepared by: {proposal.preparedBy}</div>}
          </div>
        )}
      </header>

      <section className="ps-verdict">
        <strong>{rec.pick ?? 'Recommendation: hold off'}</strong> — {rec.rationale}
      </section>

      <table className="ps-table">
        <tbody>
          <tr><th>25-year net present value</th><td>{money(solarOnly.low.npv)} to {money(solarOnly.high.npv)} (base {money(base.npv)})</td></tr>
          <tr><th>Walk-away price</th><td>{walkAway.price ? `$${walkAway.price.toFixed(2)}/W — above this it does not pay back` : 'n/a'}</td></tr>
          <tr><th>Payback</th><td>{base.paybackYear ? `${base.paybackYear} years` : 'never within the analysis horizon'}</td></tr>
          <tr><th>Annualized return</th><td>{model.annualizedReturn.toFixed(1)}%</td></tr>
          <tr><th>System</th><td>{model.systemKW.toFixed(1)} kW · {Math.round(model.year1Production).toLocaleString()} kWh year 1 · {money(model.solarGross)} gross</td></tr>
          <tr><th>Year-1 bill savings</th><td>{money(model.netNoBatt.savings)} ({Math.round(model.netNoBatt.selfConsumptionRate * 100)}% of output used on site)</td></tr>
          <tr><th>Federal tax credit</th><td>{money(base.itc.credit)} earned, {money(base.itc.totalRealized)} usable at a {money(assumptions.annualTaxLiability)}/yr liability</td></tr>
          <tr><th>Lifetime O&amp;M + inverter</th><td>{money(model.lifecycleTotal)}</td></tr>
          {financing.type === 'loan' && (
            <tr><th>Loan</th><td>{money(base.monthlyPayment)}/mo{base.laterMonthlyPayment > base.monthlyPayment * 1.05 ? `, rising to ${money(base.laterMonthlyPayment)}/mo if the credit is not applied to principal` : ''}</td></tr>
          )}
        </tbody>
      </table>

      {mode === 'audit' && model.audit && (
        <section>
          <h2>Quote audit — {model.audit.verdict}</h2>
          <ul className="ps-list">
            {model.audit.findings.map((f, i) => (
              <li key={i}><strong>{f.title}.</strong> {f.detail}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>What this assumes</h2>
        <ul className="ps-list">
          <li>Utility rates rise 2.0–4.5%/yr (base 3.0%); results shown as a range because this assumption dominates the outcome.</li>
          <li>Export credit of {Math.round(model.creditRate * 100)}% of retail. {model.creditRate >= 1 ? 'True net metering — surplus banks at full value.' : 'Only on-site consumption earns full retail value.'}</li>
          <li>Panels degrade {(assumptions.panelDegradation * 100).toFixed(1)}%/yr; inverter replaced in year {assumptions.inverterReplacementYear}.</li>
          <li>Discounted at {(assumptions.discountRate * 100).toFixed(1)}%/yr over {assumptions.analysisYears} years.</li>
          <li>Production modelled from latitude {assumptions.latitude}°, {assumptions.tiltDegrees}° tilt, hour by hour against your billed usage.</li>
        </ul>
      </section>

      <section>
        <h2>Risks this model does not price</h2>
        <ul className="ps-list">
          <li>Net metering rules can change; a cut to export credit would reduce savings for the remaining term.</li>
          <li>Selling the home before payback transfers the benefit to the buyer at whatever the market pays for it.</li>
          <li>Roof replacement during the panel's life adds removal and reinstall cost.</li>
        </ul>
      </section>

      <footer className="ps-foot">
        Modelled independently from the homeowner's own billed usage. Not tax or investment advice.
      </footer>
    </div>
  );
}

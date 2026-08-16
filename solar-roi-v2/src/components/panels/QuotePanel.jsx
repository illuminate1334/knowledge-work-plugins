import React from 'react';

const FIELDS = [
  ['systemKW', 'System size (kW)', 0.1],
  ['totalPrice', 'Total price ($)', 100],
  ['annualProductionKWh', 'Claimed production (kWh/yr)', 100],
  ['firstYearSavings', 'Claimed year-1 savings ($)', 50],
  ['lifetimeSavings', 'Claimed lifetime savings ($)', 1000],
  ['monthlyPayment', 'Quoted loan payment ($/mo, 0 if cash)', 5],
];

export default function QuotePanel({ quote, setQuote }) {
  const set = (k, v) => setQuote({ ...quote, [k]: v });
  return (
    <section className="card">
      <h2>4 · The quote you received</h2>
      <p className="sub">Copy the numbers off the proposal exactly as written.</p>
      <div className="row">
        {FIELDS.map(([key, label, step]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input type="number" step={step} value={quote[key]} onChange={(e) => set(key, parseFloat(e.target.value) || 0)} />
          </div>
        ))}
      </div>
      <label className="note">
        <input
          type="checkbox"
          checked={quote.includesLifecycleCosts}
          onChange={(e) => set('includesLifecycleCosts', e.target.checked)}
        />{' '}
        Quote's savings already deduct maintenance and inverter replacement
      </label>
    </section>
  );
}

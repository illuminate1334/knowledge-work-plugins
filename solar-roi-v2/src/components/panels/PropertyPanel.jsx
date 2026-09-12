import React from 'react';
import AssumptionsPanel from '../AssumptionsPanel.jsx';

export default function PropertyPanel({ property, setProperty, financing, setFinancing, assumptions, setAssumptions }) {
  const setP = (patch) => setProperty({ ...property, ...patch });
  const setF = (patch) => setFinancing({ ...financing, ...patch });
  const setA = (patch) => setAssumptions({ ...assumptions, ...patch });

  return (
    <section className="card">
      <h2>3 · Property & financing</h2>
      <div className="row">
        <div className="field">
          <label>Usable roof (sq ft)</label>
          <input type="number" min="0" value={property.roofSqFt} onChange={(e) => setP({ roofSqFt: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="field">
          <label>Orientation</label>
          <select value={property.orientation} onChange={(e) => setP({ orientation: e.target.value })}>
            {['south', 'southeast', 'southwest', 'east', 'west', 'north'].map((o) => (
              <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Shading</label>
          <select value={property.shade} onChange={(e) => setP({ shade: e.target.value })}>
            <option value="minimal">Minimal</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label>Payment</label>
          <select value={financing.type} onChange={(e) => setF({ type: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="loan">Loan</option>
          </select>
        </div>
        {financing.type === 'loan' && (
          <>
            <div className="field">
              <label>APR (%)</label>
              <input type="number" step="0.1" value={financing.apr} onChange={(e) => setF({ apr: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="field">
              <label>Term (yrs)</label>
              <input
                type="number"
                min="1"
                value={financing.termYears}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setF({ termYears: Number.isFinite(n) && n > 0 ? n : 1 });
                }}
              />
            </div>
            <div className="field">
              <label>Down ($)</label>
              <input type="number" value={financing.down} onChange={(e) => setF({ down: parseFloat(e.target.value) || 0 })} />
            </div>
          </>
        )}
      </div>

      <div className="row">
        <div className="field">
          <label>Annual federal tax liability ($)</label>
          <input
            type="number"
            value={assumptions.annualTaxLiability}
            onChange={(e) => setA({ annualTaxLiability: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <label className="note" style={{ alignSelf: 'flex-end' }}>
          <input type="checkbox" checked={financing.applyITC} onChange={(e) => setF({ applyITC: e.target.checked })} />{' '}
          Claim the 30% credit
        </label>
        {financing.type === 'loan' && (
          <label className="note" style={{ alignSelf: 'flex-end' }}>
            <input type="checkbox" checked={financing.itcPaydown} onChange={(e) => setF({ itcPaydown: e.target.checked })} />{' '}
            Apply credit to principal
          </label>
        )}
      </div>
      <p className="note">
        The tax credit is non-refundable — it can only offset tax you actually owe. A low liability here
        materially changes the outcome.
      </p>

      <AssumptionsPanel assumptions={assumptions} setAssumptions={setAssumptions} />
    </section>
  );
}

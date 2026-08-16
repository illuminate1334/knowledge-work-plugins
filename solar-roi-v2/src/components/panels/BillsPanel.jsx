import React, { useRef, useState } from 'react';
import Papa from 'papaparse';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BillsPanel({ billMode, setBillMode, avgBill, setAvgBill, bills, setBills, rate, monthlyUsage }) {
  const fileRef = useRef(null);
  const [parseError, setParseError] = useState(null);

  const update = (i, key, value) => setBills(bills.map((b, idx) => (idx === i ? { ...b, [key]: value } : b)));

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const cols = meta.fields || [];
        const usageCol = cols.find((c) => /usage|kwh/i.test(c));
        const costCol = cols.find((c) => /cost|amount|\$|bill/i.test(c));
        if (!usageCol || !costCol) {
          setParseError(`Couldn't find usage/cost columns. Found: ${cols.join(', ')}`);
          return;
        }
        const rows = data.slice(0, 12);
        if (rows.length < 12) {
          setParseError(`CSV has ${rows.length} rows — 12 months are required.`);
          return;
        }
        const num = (v) => parseFloat(String(v).replace(/[$,]/g, '')) || '';
        setBills(bills.map((b, i) => ({ ...b, usage: String(num(rows[i][usageCol])), cost: String(num(rows[i][costCol])) })));
        setBillMode('detailed');
      },
      error: (err) => setParseError(err.message),
    });
  };

  const annual = monthlyUsage.reduce((x, y) => x + y, 0);

  return (
    <section className="card">
      <h2>2 · Your usage</h2>
      <div className="seg">
        <button className={billMode === 'quick' ? 'on' : ''} onClick={() => setBillMode('quick')}>Average bill</button>
        <button className={billMode === 'detailed' ? 'on' : ''} onClick={() => setBillMode('detailed')}>12 months</button>
      </div>

      {billMode === 'quick' && (
        <>
          <div className="row">
            <div className="field">
              <label>Average monthly bill ($)</label>
              <input type="number" min="0" value={avgBill} onChange={(e) => setAvgBill(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <p className="note">
            {rate
              ? `≈ ${Math.round(annual).toLocaleString()} kWh/yr, spread with an assumed seasonal shape. Enter 12 months for a result you can trust to the dollar.`
              : 'Confirm a rate plan first so this can be converted to kWh.'}
          </p>
        </>
      )}

      {billMode === 'detailed' && (
        <>
          <div className="row" style={{ marginBottom: 8 }}>
            <button onClick={() => fileRef.current?.click()}>Upload CSV</button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFile} />
          </div>
          {parseError && <div className="warnbox">{parseError}</div>}
          <table className="bills">
            <thead><tr><th>Month</th><th>kWh</th><th>Cost $</th></tr></thead>
            <tbody>
              {bills.map((b, i) => (
                <tr key={b.month}>
                  <td>{MONTHS[i]}</td>
                  <td><input type="number" min="0" value={b.usage} onChange={(e) => update(i, 'usage', e.target.value)} /></td>
                  <td><input type="number" min="0" step="0.01" value={b.cost} onChange={(e) => update(i, 'cost', e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Costs are optional but enable the reconciliation check against your real bills.</p>
        </>
      )}
    </section>
  );
}

import React, { useRef, useState } from 'react';
import Papa from 'papaparse';

// CSV expectations: columns containing "month", "usage"/"kwh", and "cost"/"amount"/"$".
// Real parsing via PapaParse (v1 faked this), with manual entry as the other path.
export default function BillUpload({ bills, setBills, next, back }) {
  const fileRef = useRef(null);
  const [parseError, setParseError] = useState(null);

  const update = (i, key, value) => {
    setBills(bills.map((b, idx) => (idx === i ? { ...b, [key]: value } : b)));
  };

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
        setBills(
          bills.map((b, i) => ({
            ...b,
            usage: String(parseFloat(String(rows[i][usageCol]).replace(/,/g, '')) || ''),
            cost: String(parseFloat(String(rows[i][costCol]).replace(/[$,]/g, '')) || ''),
          })),
        );
      },
      error: (err) => setParseError(err.message),
    });
  };

  const invalid = bills.filter((b) => !(parseFloat(b.usage) > 0) || !(parseFloat(b.cost) > 0));
  const valid = invalid.length === 0;

  return (
    <div className="card">
      <h2>Your electric bills</h2>
      <p className="sub">12 months of usage (kWh) and cost ($). Upload a CSV or type them in.</p>

      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={() => fileRef.current?.click()}>Upload CSV</button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFile} />
        <span className="note">Columns: month, usage (kWh), cost ($)</span>
      </div>
      {parseError && <div className="warnbox">{parseError}</div>}

      <table className="bills">
        <thead>
          <tr><th>Month</th><th>Usage (kWh)</th><th>Cost ($)</th></tr>
        </thead>
        <tbody>
          {bills.map((b, i) => (
            <tr key={b.month}>
              <td>{b.month}</td>
              <td><input type="number" min="0" value={b.usage} onChange={(e) => update(i, 'usage', e.target.value)} /></td>
              <td><input type="number" min="0" step="0.01" value={b.cost} onChange={(e) => update(i, 'cost', e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {!valid && <p className="note" style={{ marginTop: 10 }}>{invalid.length} month(s) still need positive usage and cost values.</p>}

      <div className="nav">
        <button onClick={back}>Back</button>
        <button className="primary" disabled={!valid} onClick={next}>Continue</button>
      </div>
    </div>
  );
}

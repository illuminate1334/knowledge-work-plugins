import React from 'react';

const LABEL = { high: 'Serious', medium: 'Worth asking', low: 'Note' };

export default function AuditFindings({ audit }) {
  if (!audit) return null;
  return (
    <div className="card">
      <h2>Quote audit — {audit.verdict}</h2>
      {audit.findings.length === 0 && (
        <p className="note">No discrepancies found against the independent model.</p>
      )}
      {audit.findings.map((f, i) => (
        <div key={i} className={`finding ${f.severity}`}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong>{f.title}</strong>
            <span className={`badge ${f.severity === 'high' ? 'low' : f.severity === 'medium' ? 'medium' : 'high'}`}>
              {LABEL[f.severity]}
            </span>
          </div>
          <p style={{ margin: '6px 0' }}>{f.detail}</p>
          <div className="note">
            Quote says <strong>{f.claimed}</strong> · model says <strong>{f.modeled}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Grouped bars replace v1's pie chart, which double-counted battery savings
// inside the solar slice. Year-1 gross savings, before loan payments.
export default function SavingsBreakdownChart({ solarOnly, solarBattery }) {
  const y1solar = solarOnly.rows[1];
  const y1combo = solarBattery.rows[1];
  const data = [
    { name: 'Solar only', solar: Math.round(y1solar.solarSavings), battery: 0 },
    { name: 'Solar + battery', solar: Math.round(y1combo.solarSavings), battery: Math.round(y1combo.batterySavings) },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 16 }}>Year-1 savings breakdown</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
          <Legend />
          <Bar dataKey="solar" name="Solar bill savings" fill="#2563eb" />
          <Bar dataKey="battery" name="Battery arbitrage" fill="#10b981" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

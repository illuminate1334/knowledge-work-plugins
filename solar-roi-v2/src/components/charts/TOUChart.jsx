import React from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { periodForHour } from '../../engine/utilityCosts.js';

const COLORS = { peak: '#ef4444', offPeak: '#3b82f6', superOffPeak: '#10b981' };

// Per-bar color via <Cell> — v1 passed a function to Bar.fill, which Recharts ignores.
export default function TOUChart({ rate }) {
  const data = Array.from({ length: 24 }, (_, hour) => {
    const period = periodForHour(hour, rate.periods);
    return { hour, period, rate: rate.periods[period].rate };
  });

  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 16 }}>Time-of-use rates by hour</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" />
          <YAxis tickFormatter={(v) => `$${v.toFixed(2)}`} />
          <Tooltip formatter={(v, _n, { payload }) => [`$${v}/kWh`, payload.period]} />
          <Bar dataKey="rate">
            {data.map((d) => (
              <Cell key={d.hour} fill={COLORS[d.period]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="note">
        <span style={{ color: COLORS.peak }}>■</span> peak{' '}
        <span style={{ color: COLORS.offPeak }}>■</span> off-peak{' '}
        {rate.periods.superOffPeak && <><span style={{ color: COLORS.superOffPeak }}>■</span> super-off-peak</>}
      </p>
    </div>
  );
}

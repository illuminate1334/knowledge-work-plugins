import React from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ComposedChart (v1 put Bars inside a LineChart, which renders nothing).
// Shaded band = low/high sensitivity range for solar-only cumulative cash flow.
export default function ProjectionChart({ solarOnly, solarBattery }) {
  const data = solarOnly.base.rows.map((r, i) => ({
    year: r.year,
    solarOnly: Math.round(r.cumulative),
    solarBattery: Math.round(solarBattery.base.rows[i].cumulative),
    low: Math.round(solarOnly.low.rows[i].cumulative),
    range: Math.round(solarOnly.high.rows[i].cumulative - solarOnly.low.rows[i].cumulative),
  }));

  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 16 }}>Cumulative cash flow (25 years)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -4 }} />
          <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
          <Legend />
          <ReferenceLine y={0} stroke="#94a3b8" />
          {/* invisible base + range area = sensitivity band */}
          <Area dataKey="low" stackId="band" stroke="none" fill="transparent" legendType="none" tooltipType="none" />
          <Area dataKey="range" stackId="band" stroke="none" fill="#3b82f6" fillOpacity={0.12} name="Low–high scenario range" />
          <Line dataKey="solarOnly" stroke="#2563eb" dot={false} strokeWidth={2} name="Solar only (base)" />
          <Line dataKey="solarBattery" stroke="#10b981" dot={false} strokeWidth={2} name="Solar + battery (base)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

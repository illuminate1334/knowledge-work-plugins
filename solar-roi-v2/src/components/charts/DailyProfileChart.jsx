import React from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// The chart that explains why partial export credit matters: production is a
// midday hump, load is an evening peak, and only the overlap is worth retail.
export default function DailyProfileChart({ model }) {
  const [monthIdx, setMonth] = React.useState(5);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const data = Array.from({ length: 24 }, (_, h) => {
    const p = model.productionShape[monthIdx][h];
    const l = model.loadShape[monthIdx][h];
    return {
      hour: h,
      production: +p.toFixed(3),
      load: +l.toFixed(3),
      selfUse: +Math.min(p, l).toFixed(3),
    };
  });

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>An average day — {MONTHS[monthIdx]}</h2>
        <select value={monthIdx} onChange={(e) => setMonth(Number(e.target.value))} style={{ maxWidth: 120 }}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
      </div>
      <p className="note">
        Shaded area is solar you consume on site at full retail value. Production above the load line is
        exported at {Math.round(model.creditRate * 100)}% of retail; load above production is bought back at full price.
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} interval={2} />
          <YAxis tickFormatter={(v) => `${v}`} label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(v) => `${Number(v).toFixed(2)} kWh`} labelFormatter={(h) => `${h}:00`} />
          <Legend />
          <Area dataKey="selfUse" name="Self-consumed" stroke="none" fill="#10b981" fillOpacity={0.35} />
          <Line dataKey="production" name="Solar production" stroke="#f59e0b" dot={false} strokeWidth={2} />
          <Line dataKey="load" name="Household load" stroke="#2563eb" dot={false} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

import { annualizedReturn } from './projections.js';

// Transparent scoring: every factor, weight, and raw value is returned so the
// report can show the math instead of a black-box verdict (fixes v1's opaque card).
const WEIGHTS = { payback: 0.35, npv: 0.35, return: 0.20, robustness: 0.10 };

function scoreOption(name, sens, invested) {
  const base = sens.base;
  const factors = [
    {
      key: 'payback',
      label: 'Payback period',
      raw: base.paybackYear,
      // 5yr payback → 1.0, 25yr or never → 0
      score: base.paybackYear == null ? 0 : Math.max(0, Math.min(1, (25 - base.paybackYear) / 20)),
      weight: WEIGHTS.payback,
    },
    {
      key: 'npv',
      label: `NPV over 25 years`,
      raw: base.npv,
      // NPV equal to the investment → 1.0, zero or negative → 0
      score: Math.max(0, Math.min(1, base.npv / Math.max(invested, 1))),
      weight: WEIGHTS.npv,
    },
    {
      key: 'return',
      label: 'Annualized return',
      raw: annualizedReturn(invested, base.netGain),
      // 8%/yr → 1.0
      score: Math.max(0, Math.min(1, annualizedReturn(invested, base.netGain) / 8)),
      weight: WEIGHTS.return,
    },
    {
      key: 'robustness',
      label: 'Positive NPV even in low scenario',
      raw: sens.low.npv,
      score: sens.low.npv > 0 ? 1 : 0,
      weight: WEIGHTS.robustness,
    },
  ];
  const total = factors.reduce((s, f) => s + f.score * f.weight, 0);
  return { name, factors, total };
}

export function recommend(options) {
  // options: [{name, sens, invested, note?}]
  const scored = options.map((o) => ({ ...scoreOption(o.name, o.sens, o.invested), note: o.note }));
  scored.sort((x, y) => y.total - x.total);
  const best = scored[0];
  const viable = best.total >= 0.35;
  return {
    scored,
    pick: viable ? best.name : null,
    rationale: viable
      ? `${best.name} scores ${(best.total * 100).toFixed(0)}/100 on weighted payback, NPV, return, and downside robustness.`
      : 'No option clears the viability bar under these rates and assumptions — the honest recommendation is to wait or revisit assumptions.',
  };
}

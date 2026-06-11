# Solar ROI Analyzer v2

A ground-up rebuild of the solar ROI calculator artifact: an honest, transparent
financial model for residential solar + battery, with an AI-powered utility rate
lookup and a reconciliation gate that forces the model to reproduce your actual
bills before any projection is shown.

## Run it

```sh
npm install
npm run dev       # http://localhost:5173
npm test          # engine unit tests (vitest)
```

For the AI rate lookup, create `.env.local`:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Without a key, the app still works — rate entry falls back to manual. The lookup
calls the Anthropic API directly from the browser (with the
`anthropic-dangerous-direct-browser-access` header), which is fine for personal
use; proxy it through a backend before sharing the app, so the key never ships
to clients.

## Architecture

```
src/
  engine/            pure, unit-tested — no React, no I/O
    assumptions.js   every constant, surfaced in an editable UI panel
    utilityCosts.js  flat / tiered / TOU rate math
    production.js    roof, orientation, shade → system sizing
    battery.js       spread-based TOU arbitrage (honest $0 on flat plans)
    financing.js     loan amortization
    projections.js   25-yr cash flows, ITC, NPV, sensitivity scenarios
    reconciliation.js  model-vs-actual-bills gate
    recommendations.js transparent weighted scoring
  services/
    rateIntelligence.js  Claude + web search → rate plan candidates
  components/
    steps/           Welcome → Bills → Rates → Property → Analysis → Report
    charts/          ComposedChart projections, Cell-colored TOU bars
```

The flow for AI-retrieved data is **lookup → human-editable confirmation →
reconciliation gate**: the AI proposes candidates with confidence badges, as-of
dates, and source links; the user selects and edits; the engine then has to
reproduce the user's real bills within 3% before the wizard advances. See
[`PATTERN.md`](./PATTERN.md) for how to reuse this shape in other tools.

## What v2 fixes vs v1

| # | v1 bug | v2 fix |
|---|--------|--------|
| 1 | `batteryEconomics` used before declaration — app crashed | declared in `engine/battery.js`, imported explicitly |
| 4 | roof size / orientation / shade collected but ignored | `sizeSystem` derates yield and caps to roof area, with a roof-limited warning |
| 5 | 30% federal ITC never modeled | `project()` reduces capex by `itcRate` |
| 6 | losses hidden by `Math.abs` | `annualizedReturn` is signed; `-100%` floor |
| 7 | battery savings = magic 15% | spread × usable kWh × cycles × efficiency, $0 + qualitative basis on flat plans |
| 8 | super-off-peak precedence bug (`a >= x || b < y` unparenthesized) | parenthesized wrap-around check, unit-tested |
| 9 | escalation compounded via misplaced `Math.pow` | cumulative multiplier per year |
| 10 | no sanity check against real bills | reconciliation gate: ✓ within 3%, warn ≤10%, block >10% |
| — | TOU chart bars all one color | per-bar `<Cell>` fill |
| — | Bars inside `LineChart` rendered nothing | `ComposedChart` |
| — | pie chart double-counted battery savings | grouped bar chart |
| — | hardcoded $3.00/W, 1200 kWh/kW, generic CO₂ factor | editable assumptions panel (eGRID SRMW CO₂ factor) |
| — | no financing | cash vs loan with amortization, down payment, per-year payment flows |
| — | point estimates only | low/base/high sensitivity band + NPV at a configurable discount rate |

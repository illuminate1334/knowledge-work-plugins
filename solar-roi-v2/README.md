# Solar ROI Analyzer

An independent financial model for residential solar. It exists because the
numbers on a solar proposal are produced by the party selling you the system,
and a homeowner has no cheap way to check them.

Three modes, one engine:

| Mode | For | Answers |
|---|---|---|
| **Explore** | Homeowner without a quote | Does solar make sense here at all, and below what price? |
| **Audit a quote** | Homeowner holding a proposal | Do these claims survive independent modelling? |
| **Build a proposal** | Installer, advisor, or co-op | Model a system honestly and hand the client a one-page summary. |

## Run it

```sh
npm install
npm run dev       # http://localhost:5173
npm test          # engine unit tests
```

For the AI rate lookup, create `.env.local`:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Without a key the app works fine — rate entry falls back to manual. The lookup
calls the Anthropic API directly from the browser; that's acceptable for
personal use, but proxy it through a backend before sharing the app so the key
never ships to clients.

## What it models that most calculators don't

**Hour-by-hour netting.** Production is modelled from solar geometry (latitude,
tilt, azimuth, declination, air mass) and netted against your load hour by hour.
This matters enormously: a typical array sends ~55% of its output to the grid at
midday and buys power back after sunset. Tools that net annually — including
this one before v3 — silently assume you consume nearly everything you generate.

**Two tariff regimes, because they are different mechanisms.**

- *True net metering* (1:1): kWh are netted and banked forward, then the tier or
  period schedule is applied to net consumption. The meter runs backward.
- *Export compensation* (NEM 3.0 and successors): imports bill at retail,
  exports pay a fraction of it, and the two never net.

At the same 11 kW system on the same bills, moving from 1:1 to a 25% export
credit takes the 25-year NPV from **+$3,500…+$14,400** to **−$8,600…−$1,300**.
That is the single most consequential input in the model.

**Battery value from dispatch, not a rule of thumb.** A daily charge/discharge
simulation prices two distinct value streams: self-consumption shifting (worth
`retail − export credit`, no TOU spread required) and TOU arbitrage. Under true
1:1 net metering on a flat rate the model correctly reports a battery as
*negative* value — the grid already banks your surplus at full price, so storage
can only burn round-trip losses.

**The tax credit is non-refundable.** It offsets tax you actually owe, with
carryforward. A household with low liability may realize a fraction of the 30%
and forfeit the rest — the model shows exactly how much.

**The solar-loan re-amortization trap.** These loans are quoted at a payment
that assumes you drop the tax credit onto principal around month 18. If you
don't, the lender re-amortizes and the payment jumps. Modelled explicitly.

**Ownership costs.** Inverter replacement, O&M, insurance, battery replacement,
and optional roof rework — all landing in the years they actually occur, inside
the payback window.

## What you walk away with

- **A walk-away price** — the $/W above which the system stops paying back. One
  number to take into a sales conversation.
- **A range, not a point estimate.** Rate escalation dominates a 25-year model,
  so the headline is the low→high NPV span.
- **A printable one-page summary** (`Print one-page summary`) listing the
  verdict, the assumptions behind it, and the risks the model does *not* price.
- **JSON export** for archiving or reuse.

## Architecture

```
src/
  engine/            pure, unit-tested — no React, no I/O
    assumptions.js     every constant, editable in the UI
    solarShape.js      hourly production from solar geometry
    loadShape.js       hourly load, seasonality from real bills
    netting.js         bill differencing; both tariff regimes
    battery.js         daily dispatch simulation
    incentives.js      non-refundable ITC with carryforward
    lifecycle.js       inverter, O&M, battery, roof
    financing.js       amortization + ITC re-amortization
    projections.js     25-year cash flows, NPV, sensitivity
    walkAway.js        solves NPV = 0 for $/W
    quoteAudit.js      adversarial checks against a proposal
    reconciliation.js  model vs the user's actual bills
    recommendations.js transparent weighted scoring
    model.js           one orchestrator for all three modes
  services/
    rateIntelligence.js  Claude + web search → rate candidates
  components/
    panels/          inputs (left rail)
    results/         live results + print sheet
    charts/          daily profile, projections, TOU
```

The UI holds no modelling logic. Everything flows through `buildModel()`, which
is what the tests exercise.

## Trust model

AI-retrieved tariff data is never authoritative: candidates carry a confidence
badge, an as-of date, and source links; every field is editable; and a
**reconciliation gate** requires the model to reproduce your actual bills within
3% before results can be trusted. When it can't, the app tells you what your
bills *imply* your rate is, rather than just refusing. See
[`PATTERN.md`](./PATTERN.md) for the reusable shape.

## Limitations

- Clear-sky irradiance proxy; no weather, soiling, or snow data. Annual output
  comes from the yield assumption, so only the intra-day *shape* is modelled.
- Load shape within a day is a generic residential curve scaled by your real
  monthly kWh. Actual interval data would be better; most people don't have it.
- Tariff changes, home sale before payback, and roof failure are named as risks
  on the printed sheet but not priced.
- Not tax advice. The ITC modelling is a simplification of a real tax situation.

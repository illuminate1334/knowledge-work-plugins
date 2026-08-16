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

For the AI rate lookup and the weather lookup, create `.env.local`:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_NREL_API_KEY=...        # free at developer.nrel.gov/signup — optional
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

**Location-specific solar resource.** Without weather data the model assumes one
specific yield (kWh/kW/yr) for everywhere on earth, so Seattle and Phoenix come
out the same. Supplying real monthly production fixes both the annual magnitude
and the seasonal distribution — clear-sky geometry cannot know that a Pacific
Northwest December is overcast. Three ways in, in order of convenience:

1. **Fetch from NREL PVWatts** — needs a free API key in `.env.local`.
2. **Paste twelve monthly kWh figures** — run [pvwatts.nrel.gov](https://pvwatts.nrel.gov)
   in your own browser and paste the monthly output. No key, no API call.
3. **Skip it** — the clear-sky model still runs, and says so.

Because PVWatts is given the array's tilt and azimuth, its yield already
accounts for orientation; the model detects this and does not apply the
orientation derate a second time. The intra-day curve stays geometric even when
weather reweights the months, because the sun's path really is geometry.

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

- **The PVWatts network adapter has not been executed against the live
  endpoint.** It is written to the documented v8 contract and its response
  handling is unit-tested against a fixture, but the environment this was built
  in blocks `developer.nrel.gov`. Verify it once before trusting it:
  `curl "https://developer.nrel.gov/api/pvwatts/v8.json?api_key=DEMO_KEY&lat=38.95&lon=-92.33&system_capacity=4&azimuth=180&tilt=25&array_type=1&module_type=0&losses=14&timeframe=monthly"`.
  If the parameter names have drifted, only `weatherData.js` needs changing.
  The paste path needs no network and is unaffected.
- Weather is applied at **monthly** resolution. Real hourly TMY data would also
  capture that (say) cloudy mornings differ from cloudy afternoons, which shifts
  the self-consumption split a little. Monthly captures the large effect.
- Without weather data: clear-sky irradiance proxy, no soiling or snow, and one
  global yield assumption.
- Load shape within a day is a generic residential curve scaled by your real
  monthly kWh. Actual interval data would be better; most people don't have it.
- Tariff changes, home sale before payback, and roof failure are named as risks
  on the printed sheet but not priced.
- Not tax advice. The ITC modelling is a simplification of a real tax situation.

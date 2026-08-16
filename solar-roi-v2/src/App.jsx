import React, { useMemo, useState } from 'react';
import { DEFAULTS } from './engine/assumptions.js';
import { buildModel } from './engine/model.js';
import { monthlyUsageFromAverageBill } from './engine/billEstimate.js';
import { reconcile } from './engine/reconciliation.js';
import ModeSelector from './components/ModeSelector.jsx';
import BillsPanel from './components/panels/BillsPanel.jsx';
import RatePanel from './components/panels/RatePanel.jsx';
import PropertyPanel from './components/panels/PropertyPanel.jsx';
import WeatherPanel from './components/panels/WeatherPanel.jsx';
import QuotePanel from './components/panels/QuotePanel.jsx';
import ProposalPanel from './components/panels/ProposalPanel.jsx';
import Results from './components/results/Results.jsx';
import PrintSheet from './components/results/PrintSheet.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function App() {
  const [mode, setMode] = useState('explore'); // explore | audit | advise
  const [billMode, setBillMode] = useState('quick'); // quick | detailed
  const [avgBill, setAvgBill] = useState(160);
  const [bills, setBills] = useState(MONTHS.map((month) => ({ month, usage: '', cost: '' })));
  const [rateInfo, setRateInfo] = useState(null);
  const [property, setProperty] = useState({ roofSqFt: 1200, orientation: 'south', shade: 'minimal' });
  const [financing, setFinancing] = useState({
    type: 'cash', apr: 7.5, termYears: 20, down: 0, applyITC: true, itcPaydown: true,
  });
  const [assumptions, setAssumptions] = useState({ ...DEFAULTS });
  const [quote, setQuote] = useState({
    systemKW: 8, totalPrice: 32000, annualProductionKWh: 12000,
    firstYearSavings: 1800, lifetimeSavings: 65000, monthlyPayment: 0, includesLifecycleCosts: false,
  });
  const [proposal, setProposal] = useState({ preparedFor: '', preparedBy: '', company: '' });
  const [weather, setWeather] = useState(null);

  const detailedUsage = bills.map((b) => parseFloat(b.usage) || 0);
  const hasDetailed = detailedUsage.every((u) => u > 0);

  const monthlyUsage = useMemo(() => {
    if (billMode === 'detailed' && hasDetailed) return detailedUsage;
    if (rateInfo?.rate) return monthlyUsageFromAverageBill(avgBill, rateInfo.rate);
    return [];
  }, [billMode, hasDetailed, JSON.stringify(detailedUsage), avgBill, rateInfo]);

  const ready = rateInfo?.rate && monthlyUsage.length === 12 && monthlyUsage.some((u) => u > 0);

  const model = useMemo(() => {
    if (!ready) return null;
    try {
      return buildModel({
        monthlyUsage,
        rate: rateInfo.rate,
        netMetering: rateInfo.netMetering,
        property,
        financing,
        assumptions,
        quote: mode === 'audit' ? quote : null,
        weather,
      });
    } catch (err) {
      return { error: err.message };
    }
  }, [ready, JSON.stringify(monthlyUsage), rateInfo, property, financing, assumptions, mode, quote, weather]);

  // Only meaningful when the user typed real bill costs.
  const gate = useMemo(() => {
    if (!rateInfo?.rate || billMode !== 'detailed') return null;
    const parsed = bills.map((b) => ({ usage: parseFloat(b.usage) || 0, cost: parseFloat(b.cost) || 0 }));
    if (!parsed.every((b) => b.usage > 0 && b.cost > 0)) return null;
    return reconcile(parsed, rateInfo.rate);
  }, [bills, rateInfo, billMode]);

  return (
    <div className="app">
      <header className="topbar no-print">
        <div>
          <h1>Solar ROI Analyzer</h1>
          <p className="sub">Independent modelling for a five-figure decision.</p>
        </div>
        <ModeSelector mode={mode} setMode={setMode} />
      </header>

      <div className="layout">
        <aside className="inputs no-print">
          <RatePanel rateInfo={rateInfo} setRateInfo={setRateInfo} bills={bills} billMode={billMode} gate={gate} />
          <BillsPanel
            billMode={billMode} setBillMode={setBillMode}
            avgBill={avgBill} setAvgBill={setAvgBill}
            bills={bills} setBills={setBills}
            rate={rateInfo?.rate} monthlyUsage={monthlyUsage}
          />
          <PropertyPanel
            property={property} setProperty={setProperty}
            financing={financing} setFinancing={setFinancing}
            assumptions={assumptions} setAssumptions={setAssumptions}
          />
          <WeatherPanel
            weather={weather} setWeather={setWeather}
            property={property} assumptions={assumptions} setAssumptions={setAssumptions}
            coordinates={rateInfo?.coordinates ?? null}
          />
          {mode === 'audit' && <QuotePanel quote={quote} setQuote={setQuote} />}
          {mode === 'advise' && <ProposalPanel proposal={proposal} setProposal={setProposal} />}
        </aside>

        <main className="results">
          {!ready && (
            <div className="card">
              <h2>Start with your rate plan</h2>
              <p className="sub">
                Confirm the tariff on the left — look it up from your address or enter it manually.
                Results appear here and update as you change anything.
              </p>
            </div>
          )}
          {ready && model?.error && <div className="card warnbox">Model error: {model.error}</div>}
          {ready && model && !model.error && (
            <>
              <Results model={model} mode={mode} assumptions={assumptions} rateInfo={rateInfo} financing={financing} gate={gate} />
              <PrintSheet model={model} mode={mode} assumptions={assumptions} rateInfo={rateInfo} financing={financing} proposal={proposal} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

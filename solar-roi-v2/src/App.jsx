import React, { useState } from 'react';
import { DEFAULTS } from './engine/assumptions.js';
import Welcome from './components/steps/Welcome.jsx';
import BillUpload from './components/steps/BillUpload.jsx';
import RateIntelligence from './components/steps/RateIntelligence.jsx';
import PropertyDetails from './components/steps/PropertyDetails.jsx';
import Analysis from './components/steps/Analysis.jsx';
import Report from './components/steps/Report.jsx';

const STEPS = ['Welcome', 'Bills', 'Rates', 'Property & Financing', 'Analysis', 'Report'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function App() {
  const [step, setStep] = useState(0);
  const [bills, setBills] = useState(MONTHS.map((month) => ({ month, usage: '', cost: '' })));
  const [rateInfo, setRateInfo] = useState(null); // {utility, rate, netMetering, asOfDate, sources}
  const [property, setProperty] = useState({ roofSqFt: 1200, orientation: 'south', shade: 'minimal' });
  const [financing, setFinancing] = useState({ type: 'cash', apr: 7.5, termYears: 15, down: 0, applyITC: true });
  const [assumptions, setAssumptions] = useState({ ...DEFAULTS });
  const [analysis, setAnalysis] = useState(null); // computed in Analysis step, consumed by Report

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const stepProps = {
    bills, setBills,
    rateInfo, setRateInfo,
    property, setProperty,
    financing, setFinancing,
    assumptions, setAssumptions,
    analysis, setAnalysis,
    next, back,
  };

  const Current = [Welcome, BillUpload, RateIntelligence, PropertyDetails, Analysis, Report][step];

  return (
    <div className="app">
      <div className="stepper">
        {STEPS.map((name, i) => (
          <span key={name} className={`pill ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            {i + 1}. {name}
          </span>
        ))}
      </div>
      <Current {...stepProps} />
    </div>
  );
}

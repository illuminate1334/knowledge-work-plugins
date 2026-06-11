import React from 'react';

export default function Welcome({ next }) {
  return (
    <div className="card">
      <h2>Solar ROI Analyzer</h2>
      <p className="sub">An honest financial model for residential solar + battery.</p>
      <p>
        You'll enter 12 months of electric bills, confirm your utility's rate plan
        (we can look it up from your address), describe your roof, and pick cash or
        loan financing. The model then projects 25 years of cash flows — including
        the federal tax credit, panel degradation, and net metering — and shows its
        work: every assumption is editable and every recommendation shows its scoring.
      </p>
      <p className="note">
        Nothing here is hidden: if solar is a bad deal under your rates, the report will say so.
      </p>
      <div className="nav">
        <span />
        <button className="primary" onClick={next}>Get started</button>
      </div>
    </div>
  );
}

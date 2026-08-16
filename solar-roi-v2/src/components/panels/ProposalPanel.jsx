import React from 'react';

export default function ProposalPanel({ proposal, setProposal }) {
  const set = (k, v) => setProposal({ ...proposal, [k]: v });
  return (
    <section className="card">
      <h2>4 · Proposal details</h2>
      <p className="sub">Appears on the printed sheet.</p>
      <div className="row">
        <div className="field">
          <label>Prepared for</label>
          <input value={proposal.preparedFor} onChange={(e) => set('preparedFor', e.target.value)} placeholder="Client name" />
        </div>
        <div className="field">
          <label>Prepared by</label>
          <input value={proposal.preparedBy} onChange={(e) => set('preparedBy', e.target.value)} placeholder="Your name" />
        </div>
        <div className="field">
          <label>Company</label>
          <input value={proposal.company} onChange={(e) => set('company', e.target.value)} />
        </div>
      </div>
    </section>
  );
}

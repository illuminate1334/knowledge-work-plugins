import React from 'react';

const MODES = [
  { key: 'explore', label: 'Explore', hint: 'Does solar make sense for me?' },
  { key: 'audit', label: 'Audit a quote', hint: 'Is the proposal I received honest?' },
  { key: 'advise', label: 'Build a proposal', hint: 'Model and deliver a quote to a client.' },
];

export default function ModeSelector({ mode, setMode }) {
  return (
    <div className="modes" role="tablist">
      {MODES.map((m) => (
        <button
          key={m.key}
          role="tab"
          aria-selected={mode === m.key}
          className={`mode ${mode === m.key ? 'active' : ''}`}
          onClick={() => setMode(m.key)}
          title={m.hint}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

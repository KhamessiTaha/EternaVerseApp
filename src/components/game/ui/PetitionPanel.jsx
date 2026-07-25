// src/components/game/ui/PetitionPanel.jsx
//
// A civilization's petition to the player - pushed by the backend
// (utils/petitionSystem.js) when a civ you've met needs an answer. The civ is
// the actor here; you choose, and the server applies the outcome. Options that
// cost RP name the price; the server re-validates it.
import { useState } from 'react';

const PERSONALITY = {
  militant: { label: 'MILITANT', cls: 'text-critical border-critical/40' },
  devout: { label: 'DEVOUT', cls: 'text-[#f5cf7a] border-[#f5cf7a]/40' },
  scholarly: { label: 'SCHOLARLY', cls: 'text-accent border-accent/40' },
  mercantile: { label: 'MERCANTILE', cls: 'text-good border-good/40' },
  insular: { label: 'INSULAR', cls: 'text-ink-dim border-line-bright' },
};

const KIND_LABEL = {
  crisis: 'DISTRESS CALL',
  aid: 'PLEA FOR AID',
  threat: 'ULTIMATUM',
  tribute: 'OFFERING',
  knowledge: 'EXCHANGE',
};

export const PetitionPanel = ({ petition, onRespond, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!petition) return null;

  const persona = PERSONALITY[petition.personality] || PERSONALITY.insular;

  const choose = async (optionId) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const data = await onRespond(petition.civId, petition.id, optionId);
    setBusy(false);
    if (!data?.ok) setErr(data?.error || 'Transmission failed - try again');
    // On success the parent updates the universe, which clears this petition.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-lg bg-void border border-accent/40 overflow-hidden flex flex-col">
        <div className="border-b border-line px-5 py-4">
          <p className="text-accent text-[10px] font-mono tracking-[0.25em] uppercase mb-1 animate-pulse">
            Incoming Transmission
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-sans text-ink font-medium text-xl tracking-wide">{petition.civName}</h2>
            <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border ${persona.cls}`}>
              {persona.label}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border border-line-bright text-ink-faint">
              {KIND_LABEL[petition.kind] || 'PETITION'}
            </span>
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="text-ink-dim text-[14px] leading-relaxed font-sans italic">
            &ldquo;{petition.text}&rdquo;
          </p>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2">
          {(petition.options || []).map((opt) => (
            <button
              key={opt.id}
              onClick={() => choose(opt.id)}
              disabled={busy}
              className="font-mono text-[12px] tracking-wide px-4 py-2.5 border border-line text-ink-dim hover:text-ink hover:border-accent text-left transition-colors disabled:opacity-40"
            >
              {opt.label}
            </button>
          ))}

          {err && <div className="font-mono text-[11px] text-critical mt-1">{err}</div>}

          <button
            onClick={onClose}
            disabled={busy}
            className="mt-2 font-mono text-[10px] tracking-wider uppercase text-ink-faint hover:text-ink-dim self-end disabled:opacity-40"
          >
            Decide later
          </button>
        </div>
      </div>
    </div>
  );
};

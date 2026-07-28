// src/components/game/ui/LegacyPanel.jsx
//
// The culmination of the Chosen Species arc: shown once, when the civilization
// the player has shepherded reaches Type III. It honors the whole journey -
// first fire to a galaxy-spanning power - and is the game's emotional payoff.
import { civDesignation } from '../utils';

const formatAge = (age) =>
  age >= 1e9 ? `${(age / 1e9).toFixed(1)} billion years` : `${Math.max(1, Math.round(age / 1e6))} million years`;

export const LegacyPanel = ({ civ, onClose }) => {
  if (!civ) return null;
  const name = civDesignation(civ.id);
  const stats = [
    ['Shepherded for', formatAge(civ.age || 0)],
    ['Upliftings given', civ.uplifts || 0],
    ['Worlds rescued', civ.rescues || 0],
    ['Aggression tempered', civ.pacifies || 0],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void/95 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-xl text-center px-8 py-10">
        <div className="text-accent text-[11px] font-mono tracking-[0.35em] uppercase mb-4 animate-pulse">
          ★ &nbsp; A Legacy Complete &nbsp; ★
        </div>
        <h1 className="font-sans text-3xl text-ink font-semibold mb-5 leading-tight">
          {name} has reached the heavens
        </h1>
        <p className="text-ink-dim text-[15px] leading-relaxed mb-8 font-sans italic max-w-lg mx-auto">
          The people you chose — that you met as primitives clinging to a single fragile world — now
          command the energy of an entire galaxy. You held their light open through every dark age.
          From first fire to the stars, this is your legacy.
        </p>

        <div className="grid grid-cols-2 gap-px bg-line border border-line mb-4 font-mono max-w-md mx-auto">
          {stats.map(([label, value]) => (
            <div key={label} className="bg-void-raised p-3.5">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider mb-1">{label}</div>
              <div className="text-[14px] text-accent tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] font-mono tracking-wider text-ink-faint uppercase mb-8">
          Type 0 &nbsp;→&nbsp; Type I &nbsp;→&nbsp; Type II &nbsp;→&nbsp; Type III
        </div>

        <button
          onClick={onClose}
          className="font-mono text-[12px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-6 py-2.5 transition-colors"
        >
          Their story continues
        </button>
      </div>
    </div>
  );
};

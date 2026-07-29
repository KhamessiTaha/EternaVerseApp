// src/components/game/ui/OutfittingPanel.jsx
//
// Ship outfitting overlay ([U]): spend research points on upgrade tracks.
// The server owns cost/validation; this panel disables what it already
// knows can't be bought, and surfaces the server's reason if a purchase
// still fails (e.g. raced against another tab).
import { useState } from 'react';
import { UPGRADE_TRACKS } from '../content/upgradeCatalog.js';
import { DOCTRINE_CHOICES } from '../content/doctrineCatalog.js';
import { playSfx } from '../audio.js';

const LevelPips = ({ level, max }) => (
  <div className="flex gap-1">
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} className={`w-4 h-1.5 ${i < level ? 'bg-accent' : 'bg-line'}`} />
    ))}
  </div>
);

export const OutfittingPanel = ({ isOpen, onClose, universe, onPurchase, onSetDoctrine }) => {
  const [busyTrack, setBusyTrack] = useState(null);
  const [error, setError] = useState(null);
  const [busyDoctrine, setBusyDoctrine] = useState(false);

  if (!isOpen) return null;

  const points = universe?.research?.points ?? 0;
  const upgrades = universe?.upgrades || {};
  const currentDoctrine = universe?.doctrine || 'none';

  const handleDoctrine = async (id) => {
    if (busyDoctrine || id === currentDoctrine || !onSetDoctrine) return;
    setBusyDoctrine(true);
    setError(null);
    try {
      const data = await onSetDoctrine(id);
      if (data && !data.ok) {
        playSfx('uiDenied');
        setError(data.error || 'Could not change doctrine');
      } else {
        playSfx('install');
      }
    } finally {
      setBusyDoctrine(false);
    }
  };

  const handleBuy = async (track) => {
    if (busyTrack) return;
    setBusyTrack(track);
    setError(null);
    try {
      const data = await onPurchase(track);
      if (data && !data.ok) {
        playSfx('uiDenied');
        setError(data.error || 'Purchase failed');
      } else {
        playSfx('install');
      }
    } finally {
      setBusyTrack(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-2xl max-h-[88vh] overflow-y-auto bg-void border border-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Outfitting</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">Ship Systems</p>
          </div>
          <div className="flex items-center gap-6 font-mono">
            <div className="text-right">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider">Research</div>
              <div className="text-accent text-sm tabular-nums">{points} RP</div>
            </div>
            <button
              onClick={onClose}
              className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
            >
              CLOSE [U]
            </button>
          </div>
        </div>

        {error && (
          <div className="border-b border-critical/40 bg-critical/5 px-5 py-2.5 font-mono text-[11px] text-critical">
            {error}
          </div>
        )}

        <div>
          {Object.entries(UPGRADE_TRACKS).map(([track, info]) => {
            const level = upgrades[track] || 0;
            const maxLevel = info.costs.length;
            const maxed = level >= maxLevel;
            const cost = maxed ? null : info.costs[level];
            const affordable = !maxed && points >= cost;
            const busy = busyTrack === track;

            return (
              <div key={track} className="flex items-center gap-5 border-b border-line last:border-b-0 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-0.5">
                    <span className="font-mono text-[13px] text-ink">{info.label}</span>
                    <LevelPips level={level} max={maxLevel} />
                  </div>
                  <div className="font-mono text-[11px] text-good">{info.effect}</div>
                  <div className="font-mono text-[10px] text-ink-faint mt-0.5">{info.flavor}</div>
                </div>

                <button
                  onClick={() => handleBuy(track)}
                  disabled={maxed || !affordable || busy}
                  className={`shrink-0 font-mono text-[11px] tracking-wider px-4 py-2 border transition-colors ${
                    maxed
                      ? 'border-line text-ink-faint cursor-default'
                      : affordable
                      ? 'border-accent text-accent hover:bg-accent hover:text-void'
                      : 'border-line text-ink-faint cursor-not-allowed'
                  } disabled:opacity-70`}
                >
                  {maxed ? 'MAX' : busy ? 'INSTALLING…' : `MK ${level + 1} · ${cost} RP`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Doctrine: the build-identity layer. Mutually exclusive, real
            tradeoffs - pick who you ARE, not just bigger numbers. */}
        <div className="border-t-2 border-line-bright px-5 py-3">
          <div className="font-sans text-[14px] text-ink font-medium">Doctrine</div>
          <div className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
            Build identity · one at a time · free to switch
          </div>
        </div>
        <div>
          {DOCTRINE_CHOICES.map((doc) => {
            const active = doc.id === currentDoctrine;
            return (
              <button
                key={doc.id}
                onClick={() => handleDoctrine(doc.id)}
                disabled={busyDoctrine}
                className={`w-full text-left flex items-start gap-4 border-b border-line last:border-b-0 px-5 py-3.5 transition-colors ${
                  active ? 'bg-void-raised' : 'hover:bg-void-raised/50'
                } disabled:opacity-70`}
              >
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-mono ${
                    active ? 'border-accent bg-accent/15 text-accent' : 'border-line text-transparent'
                  }`}
                >
                  ●
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[13px] ${active ? 'text-ink' : 'text-ink-dim'}`}>{doc.label}</span>
                    {active && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-accent border border-accent/40 px-1.5 py-0.5">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="font-sans text-[11px] italic text-ink-faint mt-0.5">{doc.tagline}</div>
                  {(doc.boons?.length || doc.banes?.length) ? (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px]">
                      {doc.boons.map((b) => (
                        <span key={b} className="text-good">+ {b.replace(/^[+]\s*/, '')}</span>
                      ))}
                      {doc.banes.map((b) => (
                        <span key={b} className="text-critical">− {b.replace(/^[−-]\s*/, '')}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1.5 font-mono text-[10px] text-ink-faint">No bonuses, no penalties.</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 font-mono text-[10px] text-ink-faint border-t border-line">
          Earn research points by scanning galaxies, nebulae and anomalies [V]. Upgrades are permanent for this universe; doctrines can be re-chosen anytime.
        </div>
      </div>
    </div>
  );
};

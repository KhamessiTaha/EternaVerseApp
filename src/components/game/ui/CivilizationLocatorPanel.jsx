// src/components/game/ui/CivilizationLocatorPanel.jsx
//
// The Locator ([B]): the answer to "I can't find any civilizations." Contact
// is a core mechanic, but a civ lives at the cosmic scale its Kardashev type
// dictates - a Type 0 is two descents down inside one specific star system, and
// effectively unfindable by wandering. This lists every living civ and, on
// "Guide me", plants a cross-scale waypoint (WaypointSystem) that arrows the
// player straight to it, one descent at a time.
import { useMemo, useState } from 'react';
import { civDesignation, civAttitude } from '../utils';
import { civScale, civInDistress } from '../world/civPlacement.js';

// Filters mirror the attitude buckets a player thinks in.
const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'distress', label: '⚠ Distress', match: (c) => civInDistress(c) },
  { id: 'friendly', label: 'Friendly', match: (c) => ['worship', 'friendly'].includes(civAttitude(c)) },
  { id: 'neutral', label: 'Neutral', match: (c) => civAttitude(c) === 'neutral' },
  { id: 'wary', label: 'Wary', match: (c) => civAttitude(c) === 'wary' },
  { id: 'hostile', label: 'Hostile', match: (c) => civAttitude(c) === 'hostile' },
];

const SCALE_LABEL = {
  Type0: 'Type 0 · Planetary',
  Type1: 'Type I · Stellar',
  Type2: 'Type II · Stellar',
  Type3: 'Type III · Galactic',
};

const ATTITUDE_STYLE = {
  worship: { label: 'WORSHIP', cls: 'text-accent border-accent/40' },
  friendly: { label: 'FRIENDLY', cls: 'text-good border-good/40' },
  neutral: { label: 'NEUTRAL', cls: 'text-ink-dim border-line' },
  wary: { label: 'WARY', cls: 'text-warn border-warn/40' },
  hostile: { label: 'HOSTILE', cls: 'text-critical border-critical/40' },
};

const depthOf = (type) => ({ galactic: 0, stellar: 1, planetary: 2 }[civScale(type)] ?? 0);

export const CivilizationLocatorPanel = ({ isOpen, onClose, universe, activeCivId, onGuide, onStop }) => {
  const [filter, setFilter] = useState('all');

  const allCivs = useMemo(() => {
    const list = (universe?.civilizations || []).filter((c) => !c.extinct && c.location);
    // Distressed first (they're the ones who need you), then by scale depth.
    return list.sort((a, b) => {
      const dd = (civInDistress(b) ? 1 : 0) - (civInDistress(a) ? 1 : 0);
      if (dd) return dd;
      return depthOf(a.type) - depthOf(b.type);
    });
  }, [universe?.civilizations]);

  const matcher = FILTERS.find((f) => f.id === filter)?.match ?? (() => true);
  const civs = allCivs.filter(matcher);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-lg max-h-[82vh] bg-void border border-line overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Civilization Locator</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              {civs.length} of {allCivs.length} {allCivs.length === 1 ? 'civilization' : 'civilizations'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
          >
            CLOSE [B]
          </button>
        </div>

        {/* Attitude filters */}
        <div className="flex flex-wrap gap-1.5 px-5 py-2.5 border-b border-line">
          {FILTERS.map((f) => {
            const n = allCivs.filter(f.match).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                  filter === f.id ? 'border-accent text-accent' : 'border-line text-ink-faint hover:text-ink hover:border-line-bright'
                }`}
              >
                {f.label} {n > 0 ? `· ${n}` : ''}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          {civs.length === 0 && (
            <p className="font-mono text-xs text-ink-faint p-5">
              {allCivs.length === 0
                ? 'No living civilizations yet. Life takes billions of years to arise — let the universe age, or seed some in the Dev panel.'
                : 'None match this filter.'}
            </p>
          )}
          {civs.map((civ) => {
            const active = civ.id === activeCivId;
            const att = ATTITUDE_STYLE[civAttitude(civ)] ?? ATTITUDE_STYLE.neutral;
            const distress = civInDistress(civ);
            return (
              <div
                key={civ.id}
                className={`flex items-center gap-3 px-5 py-3 border-b border-line/50 ${active ? 'bg-void-raised' : ''}`}
              >
                <div className="min-w-0 flex-1 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-ink">{civDesignation(civ.id)}</span>
                    {distress && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border text-critical border-critical/50 animate-pulse">
                        ⚠ DISTRESS
                      </span>
                    )}
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${att.cls}`}>
                      {att.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-ink-faint mt-0.5">{SCALE_LABEL[civ.type] ?? civ.type}</div>
                </div>
                {active ? (
                  <button
                    onClick={onStop}
                    className="shrink-0 font-mono text-[11px] tracking-wider uppercase text-accent border border-accent px-3 py-1.5"
                  >
                    Guiding ✓
                  </button>
                ) : (
                  <button
                    onClick={() => onGuide(civ.id)}
                    className="shrink-0 font-mono text-[11px] tracking-wider uppercase text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
                  >
                    Guide me →
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-line px-5 py-2.5 font-mono text-[10px] text-ink-faint leading-relaxed">
          A green arrow will point you to your target — one descent at a time. Press
          <span className="text-ink-dim"> ENTER</span> to descend into a marked structure,
          <span className="text-ink-dim"> BACKSPACE</span> to back out.
        </div>
      </div>
    </div>
  );
};

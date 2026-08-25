// src/components/game/ui/MaterialsPanel.jsx
//
// What this universe has forged, and what it hasn't yet.
//
// The locked half is the important half. A stockpile list is inventory; a list
// that shows you the gap - "Gold: not yet, r-process, neutron-star merger" -
// is a reason to keep playing and a piece of astrophysics at the same time.
// Locked entries are shown deliberately, never hidden.
import { useState } from 'react';
import { MATERIAL_IDS, MATERIALS, isAvailable } from '../world/materials';
import { ARTIFACT_IDS, ARTIFACTS, canBuild } from '../content/artifacts';

const TIER_COLOR = {
  0: '#9497ad',  // primordial
  1: '#c9ccdb',  // stellar fusion
  2: '#dfa73f',  // supernova
  3: '#e0c04a',  // r-process
  4: '#8fd14f',  // heavy r-process
  5: '#9fd8ff',  // exotic
};

const Row = ({ id, held, unlocked }) => {
  const m = MATERIALS[id];
  const color = TIER_COLOR[m.tier] ?? '#c9ccdb';

  return (
    <div className={`flex items-start gap-3 py-2 border-b border-line/40 ${unlocked ? '' : 'opacity-45'}`}>
      <span
        className="w-7 shrink-0 text-center font-mono text-[15px]"
        style={{ color: unlocked ? color : '#5a5f73' }}
      >
        {m.symbol}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[12px] text-ink">{m.label}</span>
          <span className="font-mono text-[12px] tabular-nums shrink-0" style={{ color: unlocked ? color : '#5a5f73' }}>
            {unlocked ? held : 'not yet'}
          </span>
        </div>
        <div className="font-mono text-[10px] text-ink-faint mt-0.5">{m.forgedBy}</div>
        {!unlocked && (
          <div className="font-mono text-[10px] text-ink-faint/70 mt-0.5 italic">
            This universe has not made any.
          </div>
        )}
      </div>
    </div>
  );
};

export const MaterialsPanel = ({ isOpen, onClose, universe, onBuild }) => {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const cs = universe?.currentState;
  const held = universe?.materials || {};
  const unlockedCount = MATERIAL_IDS.filter((id) => isAvailable(id, cs)).length;
  const builtCount = (universe?.artifacts || []).length;

  const build = async (id) => {
    setBusy(id);
    setError(null);
    const res = await onBuild?.(id);
    if (res && !res.ok) setError(res.error);
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-md max-h-[85vh] bg-void border border-line overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Matter</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              {unlockedCount} of {MATERIAL_IDS.length} forged by this universe
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
          >
            CLOSE [G]
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {MATERIAL_IDS.map((id) => (
            <Row key={id} id={id} held={held[id] || 0} unlocked={isAvailable(id, cs)} />
          ))}
        </div>

        {/* Build. Matter dies with its universe; what you MAKE from it does
            not - so this is the only place in the game that leaves something
            behind on purpose. */}
        <div className="border-t-2 border-line-bright px-5 py-3">
          <div className="font-sans text-[14px] text-ink font-medium">Build</div>
          <div className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
            Raised where you stand · {builtCount} standing in this universe
          </div>
        </div>

        {error && (
          <div className="px-5 pb-2 font-mono text-[10px] text-critical">{error}</div>
        )}

        <div className="px-5 pb-3">
          {ARTIFACT_IDS.map((id) => {
            const a = ARTIFACTS[id];
            const afford = canBuild(held, id);
            return (
              <div key={id} className="flex items-start gap-3 py-2.5 border-b border-line/40 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12px] text-ink">{a.label}</div>
                  <div className="font-mono text-[10px] text-ink-faint mt-0.5 leading-relaxed">
                    {a.blurb}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px]">
                    {Object.entries(a.cost).map(([mat, need]) => {
                      const have = held[mat] || 0;
                      return (
                        <span key={mat} className={have < need ? 'text-critical' : 'text-ink-dim'}>
                          {MATERIALS[mat]?.label || mat} {have}/{need}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => build(id)}
                  disabled={!afford.ok || busy === id}
                  className={`shrink-0 font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 border transition-colors ${
                    afford.ok
                      ? 'border-accent text-accent hover:bg-accent hover:text-void'
                      : 'border-line text-ink-faint cursor-not-allowed'
                  } disabled:opacity-70`}
                >
                  {busy === id ? '…' : 'Raise'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line px-5 py-3 font-mono text-[10px] text-ink-faint leading-relaxed">
          Matter is forged by this cosmos and dies with it. What you build from
          it does not — a work is named in every universe you keep afterwards.
        </div>
      </div>
    </div>
  );
};

export default MaterialsPanel;

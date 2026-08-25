// src/components/game/ui/MaterialsPanel.jsx
//
// What this universe has forged, and what it hasn't yet.
//
// The locked half is the important half. A stockpile list is inventory; a list
// that shows you the gap - "Gold: not yet, r-process, neutron-star merger" -
// is a reason to keep playing and a piece of astrophysics at the same time.
// Locked entries are shown deliberately, never hidden.
import { MATERIAL_IDS, MATERIALS, isAvailable } from '../world/materials';

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

export const MaterialsPanel = ({ isOpen, onClose, universe }) => {
  if (!isOpen) return null;

  const cs = universe?.currentState;
  const held = universe?.materials || {};
  const unlockedCount = MATERIAL_IDS.filter((id) => isAvailable(id, cs)).length;

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

        <div className="border-t border-line px-5 py-3 font-mono text-[10px] text-ink-faint leading-relaxed">
          Matter is forged by this cosmos and dies with it. Heavy elements come
          only from a neutron-star merger — there is no other source, here or
          anywhere.
        </div>
      </div>
    </div>
  );
};

export default MaterialsPanel;

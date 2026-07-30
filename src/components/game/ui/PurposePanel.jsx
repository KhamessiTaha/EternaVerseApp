// src/components/game/ui/PurposePanel.jsx
//
// The north star, always on screen. EternaVerse's main goal is The Ascension:
// raise a chosen people to Type III before the universe dies. A new player used
// to ask "what am I working toward?"; this answers it at a glance - the goal,
// your chosen people's climb up the Kardashev ladder, the cosmic clock ticking
// against you, and your cross-universe Warden rank.
import { civDesignation } from '../utils';
import { getWarden } from '../wardenProgress';

const TIERS = ['Type0', 'Type1', 'Type2', 'Type3'];
const TIER_LABEL = { Type0: '0', Type1: 'I', Type2: 'II', Type3: 'III' };
const BANDS = { Type0: [0, 20], Type1: [20, 50], Type2: [50, 80] };
const PHASE_LABEL = {
  dark_ages: 'Dark Ages', reionization: 'Reionization', galaxy_formation: 'Galaxy Formation',
  stellar_peak: 'Stellar Peak', gradual_decline: 'Decline', twilight_era: 'Twilight', degenerate_era: 'Degenerate Era',
};

// Overall climb 0..1 across the whole ladder (each tier is a third of the bar).
const overallProgress = (civ) => {
  const idx = TIERS.indexOf(civ.type);
  if (idx < 0) return 0;
  if (civ.type === 'Type3') return 1;
  const [lo, hi] = BANDS[civ.type] || [0, 100];
  const within = Math.max(0, Math.min(1, ((civ.technology || 0) - lo) / (hi - lo)));
  return Math.min(1, (idx + within) / 3);
};

export const PurposePanel = ({ universe }) => {
  const cs = universe?.currentState;
  if (!cs) return null;

  const chosen = (universe.civilizations || []).find((c) => c.id === universe.chosenCivId && !c.extinct);
  const warden = getWarden();
  const ageGyr = ((cs.age || 0) / 1e9).toFixed(1);
  const ascended = (universe.legacies || []).length;

  return (
    <div className="w-64 font-mono pointer-events-auto border border-accent/30 bg-void/70 backdrop-blur-sm">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-accent/20">
        <span className="text-[9px] tracking-[0.28em] uppercase text-accent">◈ The Ascension</span>
        <span className="text-[9px] text-ink-faint">{PHASE_LABEL[cs.cosmicPhase] || ''} · {ageGyr} Gyr</span>
      </div>

      <div className="px-3 py-2.5">
        {chosen ? (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[12px] text-ink">{civDesignation(chosen.id)}</span>
              <span className="text-[10px] text-accent uppercase tracking-wider">Type {TIER_LABEL[chosen.type]}</span>
            </div>
            {/* Kardashev ladder 0 -> III */}
            <div className="flex items-center gap-1 mb-1.5">
              {TIERS.map((t, i) => {
                const reached = TIERS.indexOf(chosen.type) >= i;
                return (
                  <div key={t} className="flex items-center gap-1 flex-1">
                    <div className={`h-1.5 flex-1 rounded-full ${reached ? 'bg-accent' : 'bg-line'}`} />
                    <span className={`text-[8px] ${reached ? 'text-accent' : 'text-ink-faint'}`}>{TIER_LABEL[t]}</span>
                  </div>
                );
              })}
            </div>
            <div className="h-[3px] bg-line rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${overallProgress(chosen) * 100}%` }} />
            </div>
            <p className="text-[10px] text-ink-faint mt-1.5 leading-snug">
              {chosen.type === 'Type3'
                ? 'Transcendent. Their legacy is written.'
                : 'Shepherd them to Type III before this universe ends.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-[11px] text-ink-dim leading-relaxed mb-1.5">
              Raise a people from first fire to the stars — before the universe dies.
            </p>
            <div className="text-[10px] text-warn flex items-center gap-1.5">
              <span className="animate-pulse">⚑</span>
              <span>Champion a civilization to begin. Locate one [B], hail it [G].</span>
            </div>
          </>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-line/60 flex items-center justify-between text-[9px]">
        <span className="text-ink-faint uppercase tracking-wider">{warden.title}</span>
        <span className="text-ink-dim tabular-nums">
          {ascended > 0 ? `${ascended} ascended here · ` : ''}{warden.ascensions} lifetime
        </span>
      </div>
    </div>
  );
};

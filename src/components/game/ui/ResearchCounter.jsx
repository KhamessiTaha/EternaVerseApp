// src/components/game/ui/ResearchCounter.jsx
//
// Research Points - the game's main currency - as a permanent headline
// readout in the top-left corner. RP is earned by cataloging the cosmos,
// tribute and knowledge trades, and event rewards; it's spent on ship
// upgrades and petition interventions. A currency that drives two sinks
// belongs on the main screen, not buried in a panel.
//
// Gains float a brief "+N" so the player can always see WHAT paid - the
// feedback that teaches the economy without a tutorial.
import { useEffect, useRef, useState } from 'react';

export const ResearchCounter = ({ universe }) => {
  const points = universe?.research?.points ?? 0;
  const prevRef = useRef(points);
  const [gain, setGain] = useState(null);

  useEffect(() => {
    const delta = points - prevRef.current;
    prevRef.current = points;
    if (delta <= 0) return; // spending shouldn't throw confetti

    const entry = { id: Date.now() + Math.random(), amount: delta };
    setGain(entry);
    const timer = setTimeout(
      () => setGain((current) => (current?.id === entry.id ? null : current)),
      1400
    );
    return () => clearTimeout(timer);
  }, [points]);

  if (!universe) return null;

  return (
    <div className="relative w-64 font-mono pointer-events-auto">
      <div className="flex items-center justify-between border border-accent/30 bg-void/70 backdrop-blur-sm px-3 py-1.5">
        <span className="text-[9px] tracking-[0.28em] uppercase text-accent">◈ Research</span>
        <span className="text-[15px] tabular-nums text-ink leading-none">
          {points.toLocaleString()}
          <span className="text-[10px] text-ink-faint ml-1">RP</span>
        </span>
      </div>

      {gain && (
        <span
          key={gain.id}
          className="absolute -top-1 right-2 text-[12px] tabular-nums text-good pointer-events-none"
          style={{ animation: 'rp-gain 1.4s ease-out forwards' }}
        >
          +{gain.amount.toLocaleString()}
        </span>
      )}
    </div>
  );
};

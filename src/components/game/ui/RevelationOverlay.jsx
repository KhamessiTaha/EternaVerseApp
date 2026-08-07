// src/components/game/ui/RevelationOverlay.jsx
//
// The summit payoff: a full-bleed authored sequence that names what the presence
// in the vessel IS. Plays REVELATIONS[selfId].lines one at a time, then onDone.
import { useEffect, useState } from 'react';
import { REVELATIONS } from '../content/revelations';

export const RevelationOverlay = ({ selfId, onDone }) => {
  const rev = selfId ? REVELATIONS[selfId] : null;
  const [line, setLine] = useState(0);

  useEffect(() => { setLine(0); }, [selfId]);

  useEffect(() => {
    if (!rev) return;
    if (line >= rev.lines.length) {
      const t = setTimeout(onDone, 3200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLine((l) => l + 1), 5200);
    return () => clearTimeout(t);
  }, [rev, line, onDone]);

  if (!rev) return null;
  const done = line >= rev.lines.length;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-void px-6 text-center">
      <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-ink-faint mb-4 animate-pulse">You remember what you are</div>
      <h1 className="font-sans text-4xl md:text-5xl text-accent tracking-wide mb-8">{rev.title}</h1>
      <p key={line} className="font-mono text-ink-dim text-sm md:text-base max-w-2xl leading-relaxed min-h-[4rem]"
        style={{ animation: 'fadeIn 1.2s ease-out' }}>
        {done ? '' : rev.lines[line]}
      </p>
      <button onClick={onDone}
        className="mt-10 font-mono text-[11px] tracking-wider text-ink-faint hover:text-ink border border-line-bright hover:border-accent px-4 py-2 transition-colors">
        {done ? 'CONTINUE' : 'SKIP'}
      </button>
    </div>
  );
};

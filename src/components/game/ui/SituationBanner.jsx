// src/components/game/ui/SituationBanner.jsx
//
// The face of a SITUATION (see systems/SituationDirector.js) - the large beat,
// one every 15-20 minutes.
//
// It states the three things that separate a situation from a mission counter:
// WHAT is happening, HOW LONG you have, and WHAT you get. A counter can be
// completed by accident; this cannot be misread as background.
//
// Sits above the surge alarm because a Cascade Failure outranks the routine
// tears it's made of, and the two can legitimately be on screen together.
import { formatClock } from '../situations/situationModel.js';

const TONE = {
  cascade: { color: '#e0524a', glow: 'rgba(224,82,74,0.35)' },
  distress: { color: '#dfa73f', glow: 'rgba(223,167,63,0.35)' },
  windfall: { color: '#4ec9e0', glow: 'rgba(78,201,224,0.30)' },
};

const SituationBanner = ({ situation }) => {
  if (!situation) return null;
  const tone = TONE[situation.kind] ?? TONE.cascade;

  // The last 30 seconds pulse. Before that the clock is information, not
  // pressure - a banner that screams for six minutes stops being heard.
  const urgent = situation.remainingMs <= 30000;

  return (
    <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
      <style>{`@keyframes situation-urgent { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>

      <div
        className="flex flex-col items-center rounded border px-5 py-2 font-mono"
        style={{
          borderColor: tone.color,
          backgroundColor: 'rgba(12,15,28,0.86)',
          boxShadow: `0 0 26px ${tone.glow}`,
          animation: urgent ? 'situation-urgent 0.7s ease-in-out infinite' : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[13px] font-bold uppercase tracking-[0.28em]"
            style={{ color: tone.color }}
          >
            {situation.title}
          </span>
          <span
            className="text-[15px] tabular-nums font-bold"
            style={{ color: urgent ? '#e0524a' : '#c9ccdb' }}
          >
            {formatClock(situation.remainingMs)}
          </span>
        </div>

        <div className="mt-0.5 text-[11px] text-ink-dim">{situation.brief}</div>
        <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-ink-faint">
          {situation.payoff}
        </div>
      </div>

      {/* Time remaining as a bar - readable at a glance without reading. */}
      <div className="mt-1.5 h-[3px] w-64 overflow-hidden rounded-full bg-line">
        <div
          className="h-full transition-[width] duration-500 ease-linear"
          style={{
            width: `${Math.max(0, Math.min(1, situation.fraction)) * 100}%`,
            backgroundColor: urgent ? '#e0524a' : tone.color,
          }}
        />
      </div>
    </div>
  );
};

export default SituationBanner;

// src/components/game/ui/SurveyStreakOverlay.jsx
//
// The visible heartbeat of the Survey Streak (see systems/ScanSystem.js).
// Chaining scans builds a combo that scans faster and pays more RP; a decay bar
// drains between scans, so the display exists to create the "keep it alive!"
// tension that turns scanning from a chore into a flow game. Fed live from the
// HUD payload each frame, so the bar drains smoothly.
const tier = (s) =>
  s >= 15 ? { color: '#ff5e5e', glow: 0.9, label: 'BLAZING' }
  : s >= 10 ? { color: '#ff9d4a', glow: 0.7, label: 'ON FIRE' }
  : s >= 5 ? { color: '#f5cf7a', glow: 0.5, label: 'STREAK' }
  : { color: '#4ec9e0', glow: 0.35, label: 'STREAK' };

export const SurveyStreakOverlay = ({ survey }) => {
  const streak = survey?.streak ?? 0;
  if (streak < 2) return null;

  const t = tier(streak);
  const remaining = Math.max(0, Math.min(1, survey.remaining ?? 0));
  const bonus = Math.round(((survey.mult ?? 1) - 1) * 100);

  return (
    <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
      style={{ animation: 'toast-in 0.25s ease-out' }}
    >
      <style>{`@keyframes streak-pop { 0% { transform: scale(1.5); } 60% { transform: scale(0.94); } 100% { transform: scale(1); } }`}</style>

      <div className="flex items-baseline gap-1.5 font-mono leading-none"
        key={streak}
        style={{ animation: 'streak-pop 0.3s ease-out', color: t.color, textShadow: `0 0 ${8 + t.glow * 20}px ${t.color}` }}
      >
        <span className="text-[13px] opacity-70">×</span>
        <span className="text-[40px] font-bold tabular-nums">{streak}</span>
      </div>

      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.35em]" style={{ color: t.color, opacity: 0.85 }}>
        {t.label}{bonus > 0 ? ` · +${bonus}% RP` : ''}
      </div>

      {/* Decay bar - the tension. Drains between scans; refills on each scan. */}
      <div className="mt-1.5 h-[3px] w-28 bg-line/60 overflow-hidden rounded-full">
        <div className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{ width: `${remaining * 100}%`, backgroundColor: t.color, boxShadow: `0 0 6px ${t.color}` }}
        />
      </div>
    </div>
  );
};

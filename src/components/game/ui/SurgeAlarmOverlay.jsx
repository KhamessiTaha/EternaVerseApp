// src/components/game/ui/SurgeAlarmOverlay.jsx
//
// The alarm face of an Anomaly Surge (see systems/SurgeSystem.js). A pulsing
// red banner while a surge is live, so the tension spike is unmistakable and
// the player always knows how many tears are left to seal. Fed from the HUD
// payload each frame.
const SurgeAlarmOverlay = ({ surge }) => {
  if (!surge?.active) return null;
  const remaining = surge.remaining ?? 0;
  const total = surge.total ?? 0;
  const sealed = total - remaining;

  return (
    <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
      <style>{`@keyframes surge-pulse { 0%,100% { opacity: 0.85; } 50% { opacity: 0.4; } }`}</style>
      <div
        className="flex items-center gap-2.5 rounded border px-4 py-1.5 font-mono"
        style={{
          borderColor: '#e0524a',
          backgroundColor: 'rgba(224,82,74,0.12)',
          boxShadow: '0 0 22px rgba(224,82,74,0.35)',
          animation: 'surge-pulse 1s ease-in-out infinite',
        }}
      >
        <span className="text-[13px] tracking-[0.25em] uppercase text-critical font-bold">⚠ Anomaly Surge</span>
        <span className="text-[11px] text-ink-dim tabular-nums">
          {remaining} {remaining === 1 ? 'rift' : 'rifts'} left{surge.escalated ? ' · spreading' : ''}
        </span>
      </div>
      {total > 0 && (
        <div className="mt-1.5 flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className="h-1.5 w-4 rounded-full" style={{ backgroundColor: i < sealed ? '#4fd1a5' : '#e0524a80' }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SurgeAlarmOverlay;

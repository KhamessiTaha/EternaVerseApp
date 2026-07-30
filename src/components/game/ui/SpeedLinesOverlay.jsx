// src/components/game/ui/SpeedLinesOverlay.jsx
//
// Makes speed FELT. Radial motion streaks at the screen edges that intensify
// with velocity and flare cyan while you're in a gravity slipstream (see
// GravitySlingSystem). Pure CSS, driven live from the HUD payload - the whole
// point of the traversal pass is that crossing the void feels fast and good.
const SpeedLinesOverlay = ({ velocity, slip }) => {
  const speed = velocity ?? 0;
  const s = slip ?? 0;
  // Kicks in at high speed; slipstream adds a strong flare on top.
  const intensity = Math.min(0.65, Math.max(0, (speed - 260) / 520) + s * 0.4);
  if (intensity < 0.04) return null;

  const cyan = 0.1 + s * 0.35; // slipstream tints the streaks cyan

  return (
    <div className="pointer-events-none absolute inset-0 z-[9] overflow-hidden">
      <style>{`@keyframes speedspin { to { transform: rotate(360deg); } }`}</style>
      <div
        className="absolute inset-[-30%]"
        style={{
          opacity: intensity,
          background: `repeating-conic-gradient(from 0deg,
            transparent 0deg 5deg,
            rgba(${Math.round(180 + cyan * 60)}, ${Math.round(210 + cyan * 40)}, 255, ${0.14 + s * 0.12}) 5deg 5.5deg)`,
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 46%, black 82%)',
          maskImage: 'radial-gradient(circle at center, transparent 46%, black 82%)',
          animation: `speedspin ${Math.max(6, 22 - s * 12)}s linear infinite`,
          transformOrigin: 'center',
        }}
      />
    </div>
  );
};

export default SpeedLinesOverlay;

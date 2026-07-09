const BOOST_SEGMENTS = 10;

export const HUDPanel = ({ hudData }) => {
  if (!hudData) return null;

  const { velocity, position, boostEnergy, isBoosting, boostLocked, hull = 100 } = hudData;

  const hullColor = hull > 60 ? 'bg-good' : hull > 30 ? 'bg-warn' : 'bg-critical';
  const hullFilled = Math.round((hull / 100) * BOOST_SEGMENTS);
  const hullCritical = hull <= 30;

  const boostColor = boostLocked
    ? 'bg-critical'
    : isBoosting
    ? 'bg-accent'
    : boostEnergy < 30
    ? 'bg-warn'
    : 'bg-good';
  const filledSegments = Math.round((boostEnergy / 100) * BOOST_SEGMENTS);

  return (
    <div className="flex items-center gap-5 bg-void-raised/70 backdrop-blur-sm border border-line px-4 py-2.5 font-mono pointer-events-auto">
      <div className="flex items-baseline gap-2">
        <span className="text-[9px] uppercase tracking-wider text-ink-faint">Pos</span>
        <span className="text-[11px] tabular-nums text-ink">
          {position.x}, {position.y}
        </span>
      </div>

      <div className="w-px h-4 bg-line" />

      <div className="flex items-baseline gap-2">
        <span className="text-[9px] uppercase tracking-wider text-ink-faint">Vel</span>
        <span className="text-[11px] tabular-nums text-ink">{velocity.toFixed(0)} u/s</span>
      </div>

      <div className="w-px h-4 bg-line" />

      <div className="flex items-center gap-2">
        <span className={`text-[9px] uppercase tracking-wider ${hullCritical ? 'text-critical animate-pulse' : 'text-ink-faint'}`}>
          Hull
        </span>
        <div className="flex gap-[2px]">
          {Array.from({ length: BOOST_SEGMENTS }).map((_, i) => (
            <div key={i} className={`w-1.5 h-2.5 ${i < hullFilled ? hullColor : 'bg-line'} ${hullCritical ? 'animate-pulse' : ''}`} />
          ))}
        </div>
      </div>

      <div className="w-px h-4 bg-line" />

      <div className="flex items-center gap-2">
        <span className={`text-[9px] uppercase tracking-wider ${boostLocked ? 'text-critical animate-pulse' : 'text-ink-faint'}`}>
          {boostLocked ? 'Locked' : 'Boost'}
        </span>
        <div className="flex gap-[2px]">
          {Array.from({ length: BOOST_SEGMENTS }).map((_, i) => (
            <div key={i} className={`w-1.5 h-2.5 ${i < filledSegments ? boostColor : 'bg-line'} ${boostLocked ? 'animate-pulse' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

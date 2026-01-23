export const HUDPanel = ({ hudData, expanded, onToggle }) => {
  if (!hudData) return null;

  const { velocity, position, boostEnergy, isBoosting } = hudData;

  // Determine boost bar color based on energy level
  let boostColor = 'bg-blue-500'; // Blue
  let boostBorderColor = 'border-blue-500';
  let boostTextColor = 'text-blue-400';
  
  if (boostEnergy < 30) {
    boostColor = 'bg-red-500';
    boostBorderColor = 'border-red-500';
    boostTextColor = 'text-red-400';
  } else if (boostEnergy < 60) {
    boostColor = 'bg-orange-500';
    boostBorderColor = 'border-orange-500';
    boostTextColor = 'text-orange-400';
  }

  if (isBoosting) {
    boostColor = 'bg-cyan-500';
    boostBorderColor = 'border-cyan-500';
    boostTextColor = 'text-cyan-400';
  }

  return (
    <div className="bg-black bg-opacity-95 rounded-lg border-2 border-green-500 shadow-lg shadow-green-500/30 mb-3">
      <div 
        className="px-4 py-2 border-b border-green-700 cursor-pointer hover:bg-green-900 hover:bg-opacity-20 transition-colors"
        onClick={onToggle}
      >
        <div className="font-bold text-green-400 text-xs flex items-center justify-between">
          <span>🚀 SHIP STATUS</span>
          <span className="text-lg">{expanded ? '−' : '+'}</span>
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 py-3 space-y-2 text-xs">
          {/* Velocity */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Velocity:</span>
            <span className="text-green-400 font-mono">
              {velocity.toFixed(1)} u/s
            </span>
          </div>

          {/* Position */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Position:</span>
            <span className="text-cyan-400 font-mono">
              {position.x}, {position.y}
            </span>
          </div>

          {/* Boost Energy Label */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Boost Energy:</span>
            <span className={`${boostTextColor} font-mono flex items-center gap-1`}>
              {boostEnergy.toFixed(0)}%
              {isBoosting && <span className="text-[10px]">[ACTIVE]</span>}
            </span>
          </div>

          {/* Boost Energy Bar */}
          <div className="mt-1">
            <div className="w-full h-2 bg-gray-800 rounded border border-gray-600 overflow-hidden">
              <div 
                className={`h-full ${boostColor} transition-all duration-150 ${isBoosting ? 'shadow-lg' : ''}`}
                style={{ 
                  width: `${boostEnergy}%`,
                  boxShadow: isBoosting ? '0 0 8px currentColor' : 'none'
                }}
              />
            </div>
          </div>

          {/* Flight Tips */}
          <div className="pt-2 border-t border-green-700 space-y-1 text-[10px]">
            <div className="text-yellow-400 opacity-70">
              💡 PRESS M FOR MAP
            </div>
            <div className="text-blue-300 opacity-60">
              ⚡ SHIFT = BOOST
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
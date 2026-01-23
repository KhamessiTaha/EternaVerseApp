export const HUDPanel = ({ hudData, expanded, onToggle }) => {
  if (!hudData) return null;

  const { velocity, position, boostEnergy, isBoosting } = hudData;

  // Determine boost status and colors
  let boostGradient = 'from-blue-600 to-blue-400';
  let boostGlow = 'shadow-blue-500/50';
  let boostText = 'text-blue-400';
  
  if (boostEnergy < 30) {
    boostGradient = 'from-red-600 to-red-400';
    boostGlow = 'shadow-red-500/50';
    boostText = 'text-red-400';
  } else if (boostEnergy < 60) {
    boostGradient = 'from-orange-600 to-orange-400';
    boostGlow = 'shadow-orange-500/50';
    boostText = 'text-orange-400';
  }

  if (isBoosting) {
    boostGradient = 'from-cyan-500 to-blue-400';
    boostGlow = 'shadow-cyan-400/80';
    boostText = 'text-cyan-300';
  }

  // Speed indicator color based on velocity
  let speedColor = 'text-green-400';
  let speedGlow = 'text-shadow-sm';
  if (velocity > 400) {
    speedColor = 'text-cyan-300';
    speedGlow = 'drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]';
  } else if (velocity > 200) {
    speedColor = 'text-yellow-400';
    speedGlow = 'drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]';
  }

  if (!expanded) {
    return (
      <div 
        onClick={onToggle}
        className="bg-gradient-to-t from-gray-900 via-black to-gray-900/50 rounded-t-xl border-2 border-b-0 border-emerald-500/60 shadow-lg shadow-emerald-500/30 backdrop-blur-sm cursor-pointer hover:bg-gray-900/80 transition-all px-8 py-1.5"
      >
        <div className="flex items-center justify-center gap-3 text-emerald-400 font-bold text-xs">
          <span>🚀</span>
          <span className="tracking-wider">SYSTEMS</span>
          <span>+</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-6xl bg-gradient-to-t from-gray-900 via-black to-gray-900/50 border-t-2 border-emerald-500/60 shadow-2xl shadow-emerald-500/40 backdrop-blur-sm">
      {/* Compact Header */}
      <div 
        className="px-6 py-1 border-b border-emerald-700/50 cursor-pointer hover:bg-emerald-900/20 transition-all duration-200"
        onClick={onToggle}
      >
        <div className="font-bold text-emerald-400 text-xs flex items-center justify-center gap-2">
          <span>🚀</span>
          <span className="tracking-widest">SHIP SYSTEMS</span>
          <span className="text-emerald-300">−</span>
        </div>
      </div>
      
      {/* Dashboard - Ultra Wide Layout */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-12 gap-3 items-center">
          
          {/* Velocity Display - Compact */}
          <div className="col-span-3 bg-black/60 rounded-lg p-2 border border-green-500/40">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Velocity</div>
                <div className={`text-2xl font-bold font-mono ${speedColor} ${speedGlow} leading-none`}>
                  {velocity.toFixed(1)}
                  <span className="text-xs text-gray-500 ml-1">u/s</span>
                </div>
              </div>
              <div className="w-16 h-16 relative">
                {/* Circular speed indicator */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="#1f2937" strokeWidth="3"/>
                  <circle 
                    cx="18" cy="18" r="16" fill="none" 
                    className={velocity > 400 ? 'stroke-cyan-400' : velocity > 200 ? 'stroke-yellow-400' : 'stroke-green-400'}
                    strokeWidth="3"
                    strokeDasharray={`${(velocity / 600) * 100}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Boost Energy - Wide Center */}
          <div className={`col-span-6 bg-black/60 rounded-lg p-2 border ${isBoosting ? 'border-cyan-400/60 shadow-lg shadow-cyan-400/30' : 'border-blue-500/40'} transition-all duration-200`}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Boost</div>
                <div className={`text-2xl font-bold font-mono ${boostText} leading-none`}>
                  {boostEnergy.toFixed(0)}
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
              
              <div className="flex-1">
                {/* Large horizontal boost bar */}
                <div className="h-8 bg-gray-900 rounded-lg overflow-hidden border border-gray-700 relative">
                  <div 
                    className={`h-full bg-gradient-to-r ${boostGradient} transition-all duration-200`}
                    style={{ width: `${boostEnergy}%` }}
                  />
                  {isBoosting && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                  )}
                  {/* Energy level text overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-xs font-bold drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]">
                      {boostEnergy > 50 ? 'ENERGY OPTIMAL' : boostEnergy > 30 ? 'RECHARGING' : 'LOW ENERGY'}
                    </span>
                  </div>
                </div>
                
                {/* Segment indicators */}
                <div className="flex gap-1 mt-1">
                  {[...Array(20)].map((_, i) => (
                    <div 
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                        boostEnergy > (i * 5) 
                          ? isBoosting 
                            ? 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.8)]' 
                            : boostEnergy < 30 
                              ? 'bg-red-500' 
                              : boostEnergy < 60 
                                ? 'bg-orange-500' 
                                : 'bg-blue-500'
                          : 'bg-gray-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {isBoosting && (
                <div className="flex-shrink-0 text-cyan-300 animate-pulse font-bold text-xs flex items-center gap-1">
                  <span className="text-yellow-400 text-base">⚡</span>
                  <span>ACTIVE</span>
                </div>
              )}
            </div>
          </div>

          {/* Coordinates - Compact */}
          <div className="col-span-3 bg-black/60 rounded-lg p-2 border border-cyan-500/40">
            <div className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Coordinates</div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-gray-500">X</span>
                <span className="text-lg font-mono text-cyan-400 font-bold">{position.x}</span>
              </div>
              <div className="text-gray-600">/</div>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-gray-500">Y</span>
                <span className="text-lg font-mono text-cyan-400 font-bold">{position.y}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Ultra Compact Quick Reference */}
        <div className="mt-2 flex justify-center gap-6 text-[9px] text-gray-500">
          <span>🗺️ <kbd className="text-yellow-400">M</kbd> Map</span>
          <span>⚡ <kbd className="text-blue-300">SHIFT</kbd> Boost</span>
          <span>🔧 <kbd className="text-pink-400">F</kbd> Fix</span>
        </div>
      </div>
    </div>
  );
};
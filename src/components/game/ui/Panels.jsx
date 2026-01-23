import { formatNumber } from '../utils';
import { getStabilityStatus, getCosmicPhase } from './statusHelpers';

export const UniversePanel = ({ universe, expanded, onToggle }) => {
  const stabilityStatus = getStabilityStatus(universe);
  const cosmicPhase = getCosmicPhase(universe);

  return (
    <div className="bg-black bg-opacity-95 rounded-lg border-2 border-cyan-500 shadow-lg shadow-cyan-500/50 mb-3">
      <div 
        className="px-4 py-3 border-b border-cyan-700 cursor-pointer hover:bg-cyan-900 hover:bg-opacity-20 transition-colors"
        onClick={onToggle}
      >
        <div className="font-bold text-cyan-400 text-base flex items-center justify-between">
          <span>🌌 {universe?.name || "Unknown Universe"}</span>
          <span className="text-xs text-gray-400 flex items-center gap-2">
            {universe?.difficulty || "N/A"}
            <span className="text-lg">{expanded ? '−' : '+'}</span>
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {cosmicPhase.icon} {cosmicPhase.text}
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 py-3 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Age:</span>
            <span className="text-purple-400 font-mono">
              {((universe?.currentState?.age || 0) / 1e9).toFixed(2)} Gyr
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Stability:</span>
            <span className={`${stabilityStatus.color} font-mono flex items-center gap-1`}>
              <span>{stabilityStatus.icon}</span>
              {((universe?.currentState?.stabilityIndex || 1) * 100).toFixed(1)}%
              <span className="text-xs">({stabilityStatus.text})</span>
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Temperature:</span>
            <span className="text-blue-300 font-mono">
              {(universe?.currentState?.temperature || 2.725).toFixed(3)} K
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const StructuresPanel = ({ universe, expanded, onToggle }) => (
  <div className="bg-black bg-opacity-95 rounded-lg border-2 border-purple-500 shadow-lg shadow-purple-500/30 mb-3">
    <div 
      className="px-4 py-2 border-b border-purple-700 cursor-pointer hover:bg-purple-900 hover:bg-opacity-20 transition-colors"
      onClick={onToggle}
    >
      <div className="font-bold text-purple-400 text-xs flex items-center justify-between">
        <span>🗃️ COSMIC STRUCTURES</span>
        <span className="text-lg">{expanded ? '−' : '+'}</span>
      </div>
    </div>
    
    {expanded && (
      <div className="px-4 py-3 space-y-1.5 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Galaxies:</span>
          <span className="text-yellow-400 font-mono">
            {formatNumber(universe?.currentState?.galaxyCount)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Stars:</span>
          <span className="text-blue-400 font-mono">
            {formatNumber(universe?.currentState?.starCount)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Black Holes:</span>
          <span className="text-indigo-400 font-mono">
            {formatNumber(universe?.currentState?.blackHoleCount)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Metallicity:</span>
          <span className="text-amber-400 font-mono">
            {((universe?.currentState?.metallicity || 0) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    )}
  </div>
);

export const LifePanel = ({ universe, expanded, onToggle }) => {
  const activeCivs = universe?.civilizations?.filter(c => !c.extinct).length || 0;
  const advancedCivs = universe?.civilizations?.filter(c => !c.extinct && c.type !== 'Type0').length || 0;
  
  if (universe?.currentState?.lifeBearingPlanetsCount === 0 && activeCivs === 0) return null;

  return (
    <div className="bg-black bg-opacity-95 rounded-lg border-2 border-green-500 shadow-lg shadow-green-500/30 mb-3">
      <div 
        className="px-4 py-2 border-b border-green-700 cursor-pointer hover:bg-green-900 hover:bg-opacity-20 transition-colors"
        onClick={onToggle}
      >
        <div className="font-bold text-green-400 text-xs flex items-center justify-between">
          <span>🌿 LIFE & CIVILIZATION</span>
          <span className="text-lg">{expanded ? '−' : '+'}</span>
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 py-3 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Life-Bearing:</span>
            <span className="text-green-400 font-mono">
              {formatNumber(universe?.currentState?.lifeBearingPlanetsCount)}
            </span>
          </div>
          
          {activeCivs > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Civilizations:</span>
                <span className="text-cyan-400 font-mono">
                  {activeCivs}
                </span>
              </div>

              {advancedCivs > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Advanced (Type I+):</span>
                  <span className="text-purple-400 font-mono">
                    {advancedCivs}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-gray-500 text-[10px]">
                <span>Extinct:</span>
                <span className="font-mono">
                  {universe?.civilizations?.filter(c => c.extinct).length || 0}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const MissionPanel = ({ stats, universe, expanded, onToggle }) => (
  <div className="bg-black bg-opacity-95 rounded-lg border-2 border-pink-500 shadow-lg shadow-pink-500/30">
    <div 
      className="px-4 py-2 border-b border-pink-700 cursor-pointer hover:bg-pink-900 hover:bg-opacity-20 transition-colors"
      onClick={onToggle}
    >
      <div className="font-bold text-pink-400 text-xs flex items-center justify-between">
        <span>🎯 MISSION STATUS</span>
        <span className="text-lg">{expanded ? '−' : '+'}</span>
      </div>
    </div>
    
    {expanded && (
      <div className="px-4 py-3 space-y-1.5 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Anomalies Discovered:</span>
          <span className="text-green-400 font-mono">{stats.discovered}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Anomalies Resolved:</span>
          <span className="text-cyan-400 font-mono">{stats.resolved}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">⚡ Backend Active:</span>
          <span className="text-yellow-400 font-mono">
            {universe?.anomalies?.filter(a => !a.resolved).length || 0}
          </span>
        </div>

        {stats.discovered > 0 && (
          <div className="pt-2 border-t border-pink-700">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-gray-500">Success Rate:</span>
              <span className="text-purple-400 font-mono">
                {((stats.resolved / stats.discovered) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);

export const ControlsPanel = ({ expanded, onToggle }) => (
  <div className="bg-black bg-opacity-95 rounded-lg border-2 border-cyan-500 shadow-lg shadow-cyan-500/30">
    <div 
      className="px-4 py-2 border-b border-cyan-700 cursor-pointer hover:bg-cyan-900 hover:bg-opacity-20 transition-colors"
      onClick={onToggle}
    >
      <div className="font-bold text-cyan-400 text-sm flex items-center justify-between">
        <span>⌨️ CONTROLS</span>
        <span className="text-lg">{expanded ? '−' : '+'}</span>
      </div>
    </div>
    
    {expanded && (
      <div className="px-4 py-3 space-y-2 text-xs">
        <div className="space-y-1">
          <div className="text-cyan-300 font-semibold text-[11px] mb-1.5">Flight Controls</div>
          
          <div className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono min-w-[32px] text-center">
              Z
            </kbd>
            <span className="text-gray-300">Forward Thrust</span>
          </div>
          
          <div className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono min-w-[32px] text-center">
              S
            </kbd>
            <span className="text-gray-300">Reverse Thrust</span>
          </div>

          <div className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono min-w-[32px] text-center">
              Q
            </kbd>
            <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono min-w-[32px] text-center">
              D
            </kbd>
            <span className="text-gray-300">Rotate Left/Right</span>
          </div>

          <div className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono min-w-[32px] text-center">
              A
            </kbd>
            <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono min-w-[32px] text-center">
              E
            </kbd>
            <span className="text-gray-300">Strafe Left/Right</span>
          </div>

          <div className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-blue-900 rounded border border-blue-600 text-[10px] font-mono">
              SHIFT
            </kbd>
            <span className="text-blue-300">Boost (drains energy)</span>
          </div>
        </div>

        <div className="pt-2 border-t border-cyan-700 space-y-1">
          <div className="text-cyan-300 font-semibold text-[11px] mb-1.5">Actions</div>
          
          <div className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono min-w-[32px] text-center">
              F
            </kbd>
            <span className="text-gray-300">Resolve Anomaly</span>
          </div>
          
          <div className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono min-w-[32px] text-center">
              M
            </kbd>
            <span className="text-gray-300">Toggle Full Map</span>
          </div>
        </div>

        <div className="pt-2 border-t border-cyan-700 mt-2">
          <div className="text-yellow-400 text-[10px] flex items-center gap-1">
            <span>⚡</span>
            <span>Backend Anomaly (High Priority)</span>
          </div>
          <div className="text-gray-400 text-[10px] mt-1 flex items-center gap-1">
            <span>○</span>
            <span>Procedural Anomaly</span>
          </div>
        </div>
      </div>
    )}
  </div>
);
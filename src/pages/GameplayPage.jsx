import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import PhaserGame from "../components/PhaserGame";


const API_BASE = `${import.meta.env.VITE_API_URL}/universe`;

const GameplayPage = () => {
  const { id } = useParams();
  const [universe, setUniverse] = useState(null);
  const [error, setError] = useState(null);
  const [lastSimulation, setLastSimulation] = useState(Date.now());
  const simulationInProgress = useRef(false);

  // Initial universe fetch
  useEffect(() => {
    const fetchUniverse = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/${id}`, {
          headers: { Authorization: token },
        });
        
        if (res.data.ok) {
          setUniverse(res.data.universe);
          console.log(`🌌 Universe loaded: ${res.data.universe.name}`);
          console.log(`   Galaxies: ${res.data.universe.currentState.galaxyCount}`);
          console.log(`   Stars: ${res.data.universe.currentState.starCount}`);
          console.log(`   Backend Anomalies: ${res.data.universe.anomalies.length}`);
        } else {
          throw new Error(res.data.error || "Failed to fetch universe");
        }
      } catch (err) {
        console.error("Failed to fetch universe:", err);
        setError(err.response?.data?.error || "Failed to load universe");
      }
    };

    fetchUniverse();
  }, [id]);

  // Handle anomaly resolution from Phaser game
  const handleAnomalyResolved = async (anomaly) => {
    try {
      // Check if it's a backend anomaly (has proper UUID format from backend)
      // Backend anomaly IDs look like: "673ab123_1234567890_123456"
      // Procedural anomaly IDs look like: "chunkX:chunkY:index" (e.g., "0:0:0")
      const isBackendAnomaly = anomaly.id && !anomaly.id.includes(":");
      
      console.log(`🎯 Resolving ${isBackendAnomaly ? 'BACKEND' : 'procedural'} anomaly: ${anomaly.type} (${anomaly.id})`);
      
      if (isBackendAnomaly) {
        // Sync with backend for physics-based anomalies
        const token = localStorage.getItem("token");
        
        const res = await axios.post(
          `${API_BASE}/${id}/resolve-anomaly`,
          { anomalyId: anomaly.id },
          {
            headers: { 
              Authorization: token,
              'Content-Type': 'application/json'
            },
          }
        );

        if (res.data.ok) {
          setUniverse(res.data.universe);
          console.log(`✅ Backend anomaly resolved!`);
          console.log(`   Stability boost: +${(res.data.stabilityBoost * 100).toFixed(2)}%`);
          console.log(`   New stability: ${(res.data.universe.currentState.stabilityIndex * 100).toFixed(1)}%`);
        }
      } else {
        // Procedural anomaly - update locally with small boost
        console.log(`✅ Procedural anomaly resolved locally`);
        
        setUniverse(prev => ({
          ...prev,
          currentState: {
            ...prev.currentState,
            stabilityIndex: Math.min(1, (prev.currentState.stabilityIndex || 1) + 0.005)
          },
          metrics: {
            ...prev.metrics,
            playerInterventions: (prev.metrics?.playerInterventions || 0) + 1
          }
        }));
      }
    } catch (err) {
      console.error("❌ Failed to resolve anomaly:", err.response?.data?.error || err.message);
    }
  };

  // Background simulation (every 30 seconds)
  useEffect(() => {
    if (!universe || universe.status === 'ended') return;

    const runSimulation = async () => {
      if (simulationInProgress.current) return;
      if (Date.now() - lastSimulation < 25000) return; // Wait 25s between simulations

      simulationInProgress.current = true;

      try {
        const token = localStorage.getItem("token");
        
        console.log(`🔄 Running background simulation...`);
        
        const res = await axios.post(
          `${API_BASE}/${id}/simulate`,
          { steps: 1 },
          {
            headers: { 
              Authorization: token,
              'Content-Type': 'application/json'
            },
          }
        );

        if (res.data.ok) {
          setUniverse(res.data.universe);
          setLastSimulation(Date.now());

          const stats = res.data.stats;
          console.log(`✅ Simulation complete:`);
          console.log(`   Age: ${stats.ageGyr} Gyr (${stats.cosmicPhase})`);
          console.log(`   Galaxies: ${stats.galaxies}`);
          console.log(`   Stars: ${stats.stars}`);
          console.log(`   Stability: ${stats.stability}`);
          console.log(`   Backend Anomalies: ${stats.anomaliesActive}/${stats.anomaliesTotal}`);

          if (res.data.createdAnomalies?.length > 0) {
            console.log(`⚠️  Generated ${res.data.createdAnomalies.length} new backend anomalies:`);
            res.data.createdAnomalies.forEach(a => {
              console.log(`     - ${a.type} (severity ${a.severity}) at (${a.location.x.toFixed(0)}, ${a.location.y.toFixed(0)})`);
            });
          }

          if (res.data.hasEnded) {
            console.warn(`🌑 Universe ended: ${res.data.endCondition} - ${res.data.endReason}`);
          }
        }
      } catch (err) {
        console.warn("⚠️  Simulation failed:", err.response?.data?.error || err.message);
      } finally {
        simulationInProgress.current = false;
      }
    };

    // Run initial simulation after 5 seconds
    const initialTimeout = setTimeout(runSimulation, 5000);
    
    // Then run every 30 seconds
    const interval = setInterval(runSimulation, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [universe, id, lastSimulation]);

  // Cleanup resolved anomalies (every 5 minutes)
  useEffect(() => {
    if (!universe || universe.status === 'ended') return;

    const cleanupAnomalies = async () => {
      try {
        const resolvedCount = universe.anomalies?.filter(a => a.resolved).length || 0;
        
        // Only cleanup if we have more than 100 resolved anomalies
        if (resolvedCount > 100) {
          console.log(`🧹 Cleaning up ${resolvedCount} resolved anomalies...`);
          
          const token = localStorage.getItem("token");
          const res = await axios.post(
            `${API_BASE}/${id}/cleanup-anomalies`,
            { keepRecentMinutes: 10 }, // Keep last 10 minutes
            {
              headers: { 
                Authorization: token,
                'Content-Type': 'application/json'
              }
            }
          );

          if (res.data.ok) {
            console.log(`✅ Cleaned ${res.data.removed} old anomalies (${res.data.remaining} remaining)`);
            
            // Refresh universe data
            const refreshRes = await axios.get(`${API_BASE}/${id}`, {
              headers: { Authorization: token }
            });
            
            if (refreshRes.data.ok) {
              setUniverse(refreshRes.data.universe);
            }
          }
        }
      } catch (err) {
        console.warn("⚠️  Cleanup failed:", err.message);
      }
    };

    const cleanupInterval = setInterval(cleanupAnomalies, 300000); // Every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, [universe, id]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-red-500 text-xl mb-4">⚠️ {error}</div>
          <div className="space-x-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition"
            >
              Retry
            </button>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-cyan-400 text-2xl mb-4 animate-pulse">
            🌌 Loading Universe...
          </div>
          <div className="text-gray-400 text-sm">
            Initializing cosmic simulation
          </div>
        </div>
      </div>
    );
  }

  if (universe.status === 'ended') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-red-400 text-3xl mb-4">🌑 Universe Ended</div>
          <div className="text-gray-300 mb-6">
            End Condition: <span className="text-yellow-400 capitalize">
              {universe.endCondition?.replace(/-/g, ' ') || 'Unknown'}
            </span>
          </div>
          <div className="space-y-3 mb-6">
            <div className="text-sm text-gray-400">
              Final Age: <span className="text-cyan-400">
                {(universe.currentState?.age / 1e9).toFixed(2)} Gyr
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Galaxies: <span className="text-yellow-400">
                {universe.currentState?.galaxyCount?.toLocaleString() || 0}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Stars: <span className="text-blue-400">
                {universe.currentState?.starCount 
                  ? (universe.currentState.starCount / 1e9).toFixed(2) + ' Billion'
                  : '0'}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Player Interventions: <span className="text-green-400">
                {universe.metrics?.playerInterventions || 0}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Anomalies Resolved: <span className="text-purple-400">
                {universe.anomalies?.filter(a => a.resolved).length || 0}
              </span>
            </div>
          </div>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <PhaserGame 
      universe={universe} 
      onAnomalyResolved={handleAnomalyResolved}
    />
  );
};

export default GameplayPage;
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import PhaserGame from "../components/PhaserGame";

const GameplayPage = () => {
  const { id } = useParams();
  const [universe, setUniverse] = useState(null);
  const [error, setError] = useState(null);
  const [lastSimulation, setLastSimulation] = useState(Date.now());

  useEffect(() => {
    const fetchUniverse = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`http://localhost:5000/api/universe/${id}`, {
          headers: { Authorization: token },
        });
        setUniverse(res.data);
      } catch (err) {
        console.error("Failed to fetch universe:", err);
        setError("Failed to load universe. Please try again.");
      }
    };

    fetchUniverse();
  }, [id]);

  // Handle procedural anomaly resolution (from game)
  const handleAnomalyResolved = async (anomalyData) => {
    try {
      const token = localStorage.getItem("token");
      
      // Save resolved anomaly to backend
      const res = await axios.post(
        `http://localhost:5000/api/universe/${id}/resolve-procedural-anomaly`,
        anomalyData,
        {
          headers: { 
            Authorization: token,
            'Content-Type': 'application/json'
          },
        }
      );

      // Update local universe state
      setUniverse(prev => ({
        ...prev,
        metrics: res.data.metrics,
        currentState: {
          ...prev.currentState,
          stabilityIndex: prev.currentState.stabilityIndex + res.data.stabilityBoost
        }
      }));

      console.log(`✅ Resolved ${anomalyData.type} (severity: ${anomalyData.severity})`);
    } catch (err) {
      // Non-critical - game continues even if save fails
      console.warn("Failed to save anomaly resolution:", err);
    }
  };

  // Handle universe state updates from simulation
  const handleUniverseUpdate = (updatedState) => {
    setUniverse(prev => ({
      ...prev,
      ...updatedState
    }));
  };

  // Background simulation (every 30 seconds)
  useEffect(() => {
    if (!universe || universe.status !== 'active') return;

    const simulationInterval = setInterval(async () => {
      // Prevent spamming if user just loaded
      if (Date.now() - lastSimulation < 25000) return;

      try {
        const token = localStorage.getItem("token");
        const res = await axios.post(
          `http://localhost:5000/api/universe/${id}/simulate`,
          { steps: 1 }, // Simulate 1 step (100 million years)
          {
            headers: { 
              Authorization: token,
              'Content-Type': 'application/json'
            },
          }
        );

        // Update universe state with simulation results
        setUniverse(prev => ({
          ...prev,
          currentState: res.data.currentState,
          anomalies: res.data.anomalies,
          metrics: res.data.metrics,
          significantEvents: res.data.significantEvents,
          status: prev.status // Preserve status in case universe ended
        }));

        setLastSimulation(Date.now());

        const ageGyr = (res.data.currentState.age / 1e9).toFixed(2);
        const stability = (res.data.currentState.stabilityIndex * 100).toFixed(1);
        
        console.log(`🌌 Simulation: ${ageGyr} Gyr | Stability: ${stability}%`);

        // Check for universe end
        if (res.data.statistics?.status === 'ended') {
          console.warn(`⚠️ Universe has ended: ${res.data.statistics?.endCondition}`);
        }
      } catch (err) {
        console.warn("Simulation update failed:", err);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(simulationInterval);
  }, [universe, id, lastSimulation]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ {error}</div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition"
          >
            Retry
          </button>
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

  // Check if universe has ended
  if (universe.status === 'ended') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-3xl mb-4">🌑 Universe Ended</div>
          <div className="text-gray-300 mb-6">
            End Condition: <span className="text-yellow-400">{universe.endCondition}</span>
          </div>
          <div className="space-y-3">
            <div className="text-sm text-gray-400">
              Final Age: {(universe.currentState?.age / 1e9).toFixed(2)} Gyr
            </div>
            <div className="text-sm text-gray-400">
              Player Interventions: {universe.metrics?.playerInterventions || 0}
            </div>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PhaserGame 
      universe={universe} 
      onAnomalyResolved={handleAnomalyResolved}
      onUniverseUpdate={handleUniverseUpdate}
    />
  );
};

export default GameplayPage;
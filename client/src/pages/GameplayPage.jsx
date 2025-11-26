import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import PhaserGame from "../components/PhaserGame";

const GameplayPage = () => {
  const { id } = useParams();
  const [universe, setUniverse] = useState(null);
  const [error, setError] = useState(null);

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

  // Handle procedural anomaly resolution
  const handleAnomalyResolved = async (anomalyData) => {
    try {
      const token = localStorage.getItem("token");
      
      // Optional: Save resolved anomaly to backend for statistics/achievements
      await axios.post(
        `http://localhost:5000/api/universe/${id}/resolve-procedural-anomaly`,
        anomalyData,
        {
          headers: { 
            Authorization: token,
            'Content-Type': 'application/json'
          },
        }
      );

      // Update local universe state to reflect resolution
      setUniverse(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          playerInterventions: (prev.metrics?.playerInterventions || 0) + 1,
          anomalyResolutionRate: prev.metrics?.anomalyResolutionRate 
            ? prev.metrics.anomalyResolutionRate + 0.01 
            : 0.01
        }
      }));

      console.log(`✅ Resolved ${anomalyData.type} anomaly (severity: ${anomalyData.severity})`);
    } catch (err) {
      // Non-critical error - game continues even if save fails
      console.warn("Failed to save anomaly resolution:", err);
    }
  };

  // Optional: Periodic simulation updates (every 30 seconds)
  useEffect(() => {
    if (!universe) return;

    const simulationInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.post(
          `http://localhost:5000/api/universe/${id}/progress`,
          { steps: 1 }, // Simulate 1 step (100 million years)
          {
            headers: { 
              Authorization: token,
              'Content-Type': 'application/json'
            },
          }
        );

        // Update universe state with new simulation data
        setUniverse(prev => ({
          ...prev,
          currentState: res.data.currentState,
          anomalies: res.data.anomalies,
          metrics: res.data.metrics,
          significantEvents: res.data.significantEvents
        }));

        console.log(`Universe simulation updated - Age: ${(res.data.currentState.age / 1e9).toFixed(2)} Gyr`);
      } catch (err) {
        console.warn("Simulation update failed:", err);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(simulationInterval);
  }, [universe, id]);

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

  return <PhaserGame universe={universe} onAnomalyResolved={handleAnomalyResolved} />;
};

export default GameplayPage;
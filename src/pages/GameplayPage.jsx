import { useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import PhaserGame from "../components/PhaserGame";
import { getGradeForAccuracy } from "../components/game/utils";
import { Button, Eyebrow } from "../components/ui/primitives";
import { FadeFromColor } from "../components/ui/ScreenFlash";


const API_BASE = `${import.meta.env.VITE_API_URL}/universe`;

const GameplayPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const fromBigBang = location.state?.fromBigBang;
  const [universe, setUniverse] = useState(null);
  const [error, setError] = useState(null);
  const [lastSimulation, setLastSimulation] = useState(Date.now());
  const simulationInProgress = useRef(false);
  const playerPositionRef = useRef({ x: 0, y: 0 });

  const handlePlayerPositionUpdate = (position) => {
    playerPositionRef.current = position;
  };

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

  // Track anomalies being resolved to prevent duplicates
  const resolvingAnomaliesRef = useRef(new Set());
  const resolvedAnomaliesRef = useRef(new Set());

  // Handle anomaly resolution from minigame
  const handleAnomalyResolved = async (anomaly) => {
    try {
      // Validate anomaly object has required fields
      if (!anomaly || !anomaly.id) {
        console.error('❌ Invalid anomaly object:', anomaly);
        return;
      }

      // Check if we've already resolved this anomaly
      if (resolvedAnomaliesRef.current.has(anomaly.id)) {
        console.log(`✓ Anomaly ${anomaly.id} already resolved in this session`);
        return;
      }

      // Check if we're already resolving this anomaly
      if (resolvingAnomaliesRef.current.has(anomaly.id)) {
        console.log(`⏳ Anomaly ${anomaly.id} is already being resolved, skipping duplicate request`);
        return;
      }

      // Mark this anomaly as being resolved
      resolvingAnomaliesRef.current.add(anomaly.id);

      // Check if it's a backend anomaly (has proper UUID format from backend)
      // Backend anomaly IDs look like: "673ab123_1234567890_123456"
      // Procedural anomaly IDs look like: "chunkX:chunkY:index" (e.g., "0:0:0")
      const isBackendAnomaly = anomaly.id && !anomaly.id.includes(":");

      console.log(`🎯 Resolving ${isBackendAnomaly ? 'BACKEND' : 'procedural'} anomaly`);
      console.log(`   ID: ${anomaly.id}`);
      console.log(`   Type: ${anomaly.type}`);
      console.log(`   Severity: ${anomaly.severity}`);
      console.log(`   Game result: ${anomaly.gameResult?.status}, Score: ${anomaly.gameResult?.score}`);

      if (isBackendAnomaly) {
        // Sync with backend for physics-based anomalies
        const token = localStorage.getItem("token");
        const payload = { anomalyId: anomaly.id, accuracy: anomaly.gameResult?.accuracy };

        console.log(`📤 Sending to backend: POST ${API_BASE}/${id}/resolve-anomaly`);
        console.log(`   Payload:`, payload);
        console.log(`   Token present:`, !!token);

        try {
          const res = await axios.post(
            `${API_BASE}/${id}/resolve-anomaly`,
            payload,
            {
              headers: {
                Authorization: token,
                'Content-Type': 'application/json'
              },
            }
          );

          console.log(`📥 Backend response:`, res.data);

          if (res.data.ok) {
            // Mark as resolved in this session to prevent double-resolution
            resolvedAnomaliesRef.current.add(anomaly.id);
            
            setUniverse(res.data.universe);
            console.log(`✅ Backend anomaly resolved!`);
            console.log(`   Stability boost: +${(res.data.stabilityBoost * 100).toFixed(2)}%`);
            console.log(`   New stability: ${(res.data.universe.currentState.stabilityIndex * 100).toFixed(1)}%`);
          } else {
            console.error("❌ Backend returned not ok:", res.data);
          }
        } catch (axiosErr) {
          console.error(`❌ Axios error:`, axiosErr);
          console.error(`   Status: ${axiosErr.response?.status}`);
          console.error(`   Data:`, axiosErr.response?.data);
          
          const errorMsg = axiosErr.response?.data?.error || axiosErr.message;
          
          // If anomaly is already resolved, mark it as such locally
          if (errorMsg && errorMsg.includes('already resolved')) {
            console.log(`✓ Anomaly was already resolved on backend`);
            resolvedAnomaliesRef.current.add(anomaly.id);
          } else {
            console.error("❌ Failed to resolve backend anomaly:", errorMsg);
            throw axiosErr;
          }
        }
      } else {
        // Procedural anomaly - update locally, scaled by minigame performance
        // (same grade-tier multiplier the backend applies to real anomalies)
        resolvedAnomaliesRef.current.add(anomaly.id);
        console.log(`✅ Procedural anomaly resolved locally`);

        const multiplier = getGradeForAccuracy(anomaly.gameResult?.accuracy ?? 70).stabilityMultiplier;
        const boost = 0.005 * multiplier;

        setUniverse(prev => ({
          ...prev,
          currentState: {
            ...prev.currentState,
            stabilityIndex: Math.min(1, (prev.currentState.stabilityIndex || 1) + boost)
          },
          metrics: {
            ...prev.metrics,
            playerInterventions: (prev.metrics?.playerInterventions || 0) + 1
          }
        }));
      }
    } catch (err) {
      console.error("❌ Unhandled error in anomaly resolution:", err);
    } finally {
      // Only remove from currently-resolving set, not from resolved set
      resolvingAnomaliesRef.current.delete(anomaly.id);
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
          { playerPosition: playerPositionRef.current },
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
      <div className="w-full h-full bg-void flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-critical text-lg font-mono mb-6">{error}</div>
          <div className="flex justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Retry</Button>
            <Button variant="secondary" onClick={() => window.location.href = '/dashboard'}>
              Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="w-full h-full bg-void flex items-center justify-center">
        <div className="text-center">
          <div className="text-accent text-lg font-mono tracking-wide mb-3 animate-pulse">
            LOADING UNIVERSE
          </div>
          <div className="text-ink-faint text-sm font-mono">
            Initializing cosmic simulation...
          </div>
        </div>
      </div>
    );
  }

  if (universe.status === 'ended') {
    return (
      <div className="w-full h-full bg-void flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <Eyebrow className="justify-center flex mb-3 text-critical">Universe Ended</Eyebrow>
          <div className="text-ink-dim mb-8 font-mono text-sm capitalize">
            {universe.endCondition?.replace(/-/g, ' ') || 'Unknown end condition'}
          </div>
          <div className="space-y-2.5 mb-8 font-mono text-sm text-left border border-line bg-void-raised p-5">
            <div className="flex justify-between">
              <span className="text-ink-faint">Final Age</span>
              <span className="text-ink tabular-nums">{(universe.currentState?.age / 1e9).toFixed(2)} Gyr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Galaxies</span>
              <span className="text-ink tabular-nums">{universe.currentState?.galaxyCount?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Stars</span>
              <span className="text-ink tabular-nums">
                {universe.currentState?.starCount ? (universe.currentState.starCount / 1e9).toFixed(2) + ' Billion' : '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Player Interventions</span>
              <span className="text-good tabular-nums">{universe.metrics?.playerInterventions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Anomalies Resolved</span>
              <span className="text-accent tabular-nums">{universe.anomalies?.filter(a => a.resolved).length || 0}</span>
            </div>
          </div>
          <Button onClick={() => window.location.href = '/dashboard'}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PhaserGame
        universe={universe}
        onAnomalyResolved={handleAnomalyResolved}
        onPlayerPositionUpdate={handlePlayerPositionUpdate}
      />
      {fromBigBang && <FadeFromColor color="#ffffff" duration={0.9} />}
    </>
  );
};

export default GameplayPage;
import { useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import PhaserGame from "../components/PhaserGame";
import {
  getUniverse,
  simulateUniverse,
  resolveAnomaly,
  cleanupAnomalies,
  submitDiscoveries,
  purchaseUpgrade,
  contactCivilization,
  devAction,
  claimMission,
  resolveMinorAnomaly,
  claimEventReward,
} from "../api/universeApi";
import { Button, Eyebrow } from "../components/ui/primitives";
import { FadeFromColor } from "../components/ui/ScreenFlash";
import { useToast } from "../components/ui/ToastProvider";
import { ACHIEVEMENT_MAP } from "../components/game/content/achievements";
import { playSfx } from "../components/game/audio";
import { narrate, narrateOnce, pick, CURATOR } from "../components/game/narrator";
import { progressOf } from "../components/game/ui/MissionsPanel";
import { WelcomeBackPanel, buildDigest } from "../components/game/ui/WelcomeBackPanel";

const GameplayPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const toast = useToast();
  const fromBigBang = location.state?.fromBigBang;
  const [universe, setUniverse] = useState(null);
  const [error, setError] = useState(null);
  const [digest, setDigest] = useState(null);
  const [lastSimulation, setLastSimulation] = useState(Date.now());
  const simulationInProgress = useRef(false);
  const playerPositionRef = useRef({ x: 0, y: 0 });
  const pendingDiscoveriesRef = useRef([]);

  const handlePlayerPositionUpdate = (position) => {
    playerPositionRef.current = position;
  };

  // Any server response can carry newAchievements (see backend
  // utils/achievements.js) - surface each as a toast + jingle, in whatever
  // action happened to trigger it.
  const announceAchievements = (list) => {
    if (!list?.length) return;
    playSfx('minigameWin');
    list.forEach((a) => {
      const meta = ACHIEVEMENT_MAP[a.id];
      toast(`Achievement unlocked: ${meta?.title || a.id}`, 'success', 6000);
    });
    const first = ACHIEVEMENT_MAP[list[0].id];
    if (first) narrate(CURATOR.achievement(first.title));
  };

  // Live-notify the drama: new significantEvents arriving with any universe
  // refresh (simulate ticks, contact responses...) become toasts, and the
  // Curator comments on the ones worth commenting on.
  const lastEventStampRef = useRef(null);
  useEffect(() => {
    const events = universe?.significantEvents;
    if (!events?.length) return;
    const newestStamp = events[events.length - 1]?.timestamp;

    if (lastEventStampRef.current === null) {
      // First load: don't replay history
      lastEventStampRef.current = newestStamp;
      return;
    }
    if (newestStamp === lastEventStampRef.current) return;

    const lastIdx = events.findIndex((e) => e.timestamp === lastEventStampRef.current);
    const fresh = lastIdx >= 0 ? events.slice(lastIdx + 1) : events.slice(-3);
    lastEventStampRef.current = newestStamp;

    // Civ drama + milestones make good notifications; cap per tick so a big
    // catch-up sim doesn't flood the corner of the screen
    fresh
      .filter((e) => e.type === 'civilization' || e.type === 'milestone')
      .slice(0, 2)
      .forEach((e) => {
        toast(e.description, e.type === 'milestone' ? 'success' : 'info', 7000);
        if (/holy war|worship|monument|tribute|denounc/i.test(e.description || '')) {
          narrate(e.description);
        }
      });
  }, [universe?.significantEvents]);

  // Objective-complete nudge: fires the moment an active mission's progress
  // reaches its target, once per mission
  const notifiedMissionsRef = useRef(new Set());
  useEffect(() => {
    if (!universe) return;
    (universe.missions || [])
      .filter((m) => m.status === 'active' && !notifiedMissionsRef.current.has(m.id))
      .forEach((m) => {
        const { done, needed } = progressOf(universe, m);
        if (done >= needed) {
          notifiedMissionsRef.current.add(m.id);
          toast(`Objective complete: ${m.title} - press O to claim +${m.reward} RP`, 'success', 8000);
          narrateOnce('first-mission-complete', pick(CURATOR.missionComplete));
          playSfx('scanComplete');
        }
      });
  }, [universe]);

  // Initial universe fetch
  useEffect(() => {
    const fetchUniverse = async () => {
      try {
        const uni = await getUniverse(id);
        setUniverse(uni);
        // "While you were away" digest - only materializes after a real
        // absence with something to report (buildDigest returns null otherwise)
        setDigest(buildDigest(uni));
        console.log(`🌌 Universe loaded: ${uni.name}`);
        console.log(`   Galaxies: ${uni.currentState.galaxyCount}`);
        console.log(`   Stars: ${uni.currentState.starCount}`);
        console.log(`   Backend Anomalies: ${uni.anomalies.length}`);
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
        try {
          const data = await resolveAnomaly(id, anomaly.id, anomaly.gameResult?.accuracy);

          if (data.ok) {
            // Mark as resolved in this session to prevent double-resolution
            resolvedAnomaliesRef.current.add(anomaly.id);

            setUniverse(data.universe);
            console.log(`✅ Backend anomaly resolved!`);
            console.log(`   Stability boost: +${(data.stabilityBoost * 100).toFixed(2)}%`);
            console.log(`   New stability: ${(data.universe.currentState.stabilityIndex * 100).toFixed(1)}%`);
          } else {
            console.error("❌ Backend returned not ok:", data);
          }
        } catch (apiErr) {
          const errorMsg = apiErr.response?.data?.error || apiErr.message;

          // If anomaly is already resolved, mark it as such locally
          if (errorMsg && errorMsg.includes('already resolved')) {
            console.log(`✓ Anomaly was already resolved on backend`);
            resolvedAnomaliesRef.current.add(anomaly.id);
          } else {
            console.error("❌ Failed to resolve backend anomaly:", errorMsg);
            throw apiErr;
          }
        }
      } else {
        // MINOR anomaly (chunk-seeded). Server-validated like discoveries:
        // real RP, real stability, real mission credit, persistent dedup -
        // no longer a client-side illusion that respawned on reload.
        resolvedAnomaliesRef.current.add(anomaly.id);
        try {
          const data = await resolveMinorAnomaly(
            id, anomaly.id, anomaly.severity, anomaly.gameResult?.accuracy ?? 70
          );
          if (data.ok && data.universe) {
            setUniverse(data.universe);
            announceAchievements(data.newAchievements);
            console.log(`✅ Minor anomaly resolved (+${data.reward} RP)`);
          }
        } catch (apiErr) {
          const errorMsg = apiErr.response?.data?.error || apiErr.message;
          if (!errorMsg?.includes('already resolved')) {
            console.error("❌ Failed to resolve minor anomaly:", errorMsg);
          }
        }
      }
    } catch (err) {
      console.error("❌ Unhandled error in anomaly resolution:", err);
    } finally {
      // Only remove from currently-resolving set, not from resolved set
      resolvingAnomaliesRef.current.delete(anomaly.id);
    }
  };

  // Handle scan discoveries from the Phaser scene. The client-side
  // `research` value is display-only; the server recomputes the award.
  const handleDiscovery = async (discovery) => {
    // Optimistic: codex + RP update immediately; server ack reconciles.
    setUniverse((prev) => {
      if (!prev) return prev;
      if ((prev.discoveries || []).some((d) => d.id === discovery.id)) return prev;
      return {
        ...prev,
        discoveries: [
          ...(prev.discoveries || []),
          { ...discovery, researchValue: discovery.research, discoveredAt: new Date().toISOString() },
        ],
        research: {
          ...(prev.research || {}),
          points: (prev.research?.points || 0) + (discovery.research || 0),
        },
      };
    });

    try {
      const data = await submitDiscoveries(id, [discovery]);
      if (data.ok && data.research) {
        setUniverse((prev) => (prev ? { ...prev, research: data.research } : prev));
      }
      announceAchievements(data.newAchievements);
    } catch {
      // Server dedup makes retries safe; flush on the next simulate tick.
      pendingDiscoveriesRef.current.push(discovery);
    }
  };

  // Purchase a ship upgrade. No optimistic update: the server owns cost and
  // validation, and the response carries the new upgrades + research balance.
  // Returns the response so OutfittingPanel can surface a failure reason.
  const handlePurchaseUpgrade = async (track) => {
    try {
      const data = await purchaseUpgrade(id, track);
      if (data.ok) {
        setUniverse((prev) => (prev ? { ...prev, upgrades: data.upgrades, research: data.research } : prev));
        console.log(`🔧 Upgrade installed: ${track}`, data.upgrades);
        announceAchievements(data.newAchievements);
        narrateOnce('first-upgrade', pick(CURATOR.firstUpgrade));
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Purchase failed - try again" };
    }
  };

  // First Contact action - server owns all effects/costs/rolls; the response
  // carries the updated universe. Returns the payload so the panel can show
  // the outcome message.
  const handleContactAction = async (civId, action) => {
    try {
      const data = await contactCivilization(id, civId, action);
      if (data.ok && data.universe) {
        setUniverse(data.universe);
        announceAchievements(data.newAchievements);
        if (data.outcome === 'backfire') narrate(CURATOR.backfire);
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Contact failed - try again" };
    }
  };

  // Claim a completed mission - server validates completion and issues a
  // replacement; the response carries the updated universe.
  const handleClaimMission = async (missionId) => {
    try {
      const data = await claimMission(id, missionId);
      if (data.ok && data.universe) {
        setUniverse(data.universe);
        announceAchievements(data.newAchievements);
        if (Math.random() < 0.5) narrate(pick(CURATOR.claims));
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Claim failed - try again" };
    }
  };

  // Live cosmic event rewards - server rate-limits per event kind, so a
  // cooldown rejection is normal (event fired again too soon) and silent
  const handleEventReward = async (kind) => {
    try {
      const data = await claimEventReward(id, kind);
      if (data.ok && data.universe) {
        setUniverse(data.universe);
        toast(`+${data.reward} RP - ${data.title}`, 'success', 6000);
      }
    } catch (err) {
      if (!err.response?.data?.cooldown) {
        console.error("Event reward failed:", err.response?.data || err.message);
      }
    }
  };

  // Admin dev/test actions - server re-validates the admin flag per request
  const handleDevAction = async (action, payload) => {
    try {
      const data = await devAction(id, action, payload);
      if (data.ok && data.universe) {
        setUniverse(data.universe);
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Dev action failed" };
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
        // Flush any discoveries that failed to submit earlier (offline,
        // transient 5xx). Server-side dedup makes re-sends harmless.
        if (pendingDiscoveriesRef.current.length > 0) {
          const pending = pendingDiscoveriesRef.current.splice(0, 20);
          try {
            const retryData = await submitDiscoveries(id, pending);
            if (retryData.ok && retryData.research) {
              setUniverse((prev) => (prev ? { ...prev, research: retryData.research } : prev));
            }
          } catch {
            pendingDiscoveriesRef.current.unshift(...pending);
          }
        }

        console.log(`🔄 Running background simulation...`);

        const data = await simulateUniverse(id, playerPositionRef.current);

        if (data.ok) {
          setUniverse(data.universe);
          setLastSimulation(Date.now());
          announceAchievements(data.newAchievements);

          const stats = data.stats;
          console.log(`✅ Simulation complete:`);
          console.log(`   Age: ${stats.ageGyr} Gyr (${stats.cosmicPhase})`);
          console.log(`   Galaxies: ${stats.galaxies}`);
          console.log(`   Stars: ${stats.stars}`);
          console.log(`   Stability: ${stats.stability}`);
          console.log(`   Backend Anomalies: ${stats.anomaliesActive}/${stats.anomaliesTotal}`);

          if (data.createdAnomalies?.length > 0) {
            console.log(`⚠️  Generated ${data.createdAnomalies.length} new backend anomalies:`);
            data.createdAnomalies.forEach(a => {
              console.log(`     - ${a.type} (severity ${a.severity}) at (${a.location.x.toFixed(0)}, ${a.location.y.toFixed(0)})`);
            });
          }

          if (data.hasEnded) {
            console.warn(`🌑 Universe ended: ${data.endCondition} - ${data.endReason}`);
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

    const runCleanup = async () => {
      try {
        const resolvedCount = universe.anomalies?.filter(a => a.resolved).length || 0;

        // Only cleanup if we have more than 100 resolved anomalies
        if (resolvedCount > 100) {
          console.log(`🧹 Cleaning up ${resolvedCount} resolved anomalies...`);

          const data = await cleanupAnomalies(id, 10); // Keep last 10 minutes

          if (data.ok) {
            console.log(`✅ Cleaned ${data.removed} old anomalies (${data.remaining} remaining)`);

            // Refresh universe data
            const uni = await getUniverse(id);
            setUniverse(uni);
          }
        }
      } catch (err) {
        console.warn("⚠️  Cleanup failed:", err.message);
      }
    };

    const cleanupInterval = setInterval(runCleanup, 300000); // Every 5 minutes

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
        onDiscovery={handleDiscovery}
        onPurchaseUpgrade={handlePurchaseUpgrade}
        onContactAction={handleContactAction}
        onDevAction={handleDevAction}
        onClaimMission={handleClaimMission}
        onEventReward={handleEventReward}
      />
      {digest && (
        <WelcomeBackPanel
          digest={digest}
          onClose={() => {
            setDigest(null);
            narrate(pick(CURATOR.welcomeBack));
          }}
        />
      )}
      {fromBigBang && <FadeFromColor color="#ffffff" duration={0.9} />}
    </>
  );
};

export default GameplayPage;
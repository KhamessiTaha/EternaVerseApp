import { useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import PhaserGame from "../components/PhaserGame";
import { dlog } from "../devLog";
import {
  getUniverse,
  simulateUniverse,
  resolveAnomaly,
  cleanupAnomalies,
  submitDiscoveries,
  purchaseUpgrade,
  contactCivilization,
  respondPetition,
  devAction,
  claimMission,
  resolveMinorAnomaly,
  claimEventReward,
  registerVesselLost,
  setDoctrine,
  reportWarStrike,
  reportBombardment,
} from "../api/universeApi";
import { Button } from "../components/ui/primitives";
import { FadeFromColor } from "../components/ui/ScreenFlash";
import { useToast } from "../components/ui/ToastProvider";
import { ACHIEVEMENT_MAP } from "../components/game/content/achievements";
import { playSfx } from "../components/game/audio";
import { narrate, narrateOnce, pick, CURATOR } from "../components/game/narrator";
import { progressOf } from "../components/game/ui/MissionsPanel";
import { WelcomeBackPanel, buildDigest } from "../components/game/ui/WelcomeBackPanel";
import { PetitionPanel } from "../components/game/ui/PetitionPanel";
import { LegacyPanel } from "../components/game/ui/LegacyPanel";
import { recordAscension, recordAxis } from "../components/game/wardenProgress";
import {
  comprehensionForDiscovery, MASTERY_ASCENSION, MASTERY_RESOLVE,
  MASTERY_SIEGE_BROKEN, NEGLECT_AGGRESSION, MAX_STRIKE_KILLS, neglectDelta,
  endingAxis,
} from "../components/game/self/selfModel";
import { RevelationOverlay } from "../components/game/ui/RevelationOverlay";
import { ANAMNESIS_LINE } from "../components/game/content/revelations";
import { besiegedWorlds } from "../components/game/combat/fleetModel";
import { civDesignation } from "../components/game/utils";
import { UniverseEndPanel } from "../components/game/ui/UniverseEndPanel";
import { CinematicBoundary } from "../components/game/ui/CinematicBoundary";
import { hasSeenEnding, markEndingSeen } from "../components/game/content/universeEnds";
// UniverseEnding picks a prerendered film or the procedural three.js version
// per death, and keeps the latter lazily loaded so a ~1MB renderer is only
// ever fetched when a death without a film actually happens.
import { UniverseEnding } from "../components/game/ui/UniverseEnding";

const GameplayPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const toast = useToast();
  const fromBigBang = location.state?.fromBigBang;
  const [universe, setUniverse] = useState(null);
  const [error, setError] = useState(null);
  const [digest, setDigest] = useState(null);
  const [lastSimulation, setLastSimulation] = useState(Date.now());
  // Whether the death cinematic still owes this player a showing. Armed when
  // an ending is first observed (live or on load) and disarmed once seen.
  const [playEnding, setPlayEnding] = useState(false);
  // Dev-console preview: an endCondition to play over the LIVING game, purely
  // to look at. Never marks the ending seen and never touches the universe.
  const [previewEnd, setPreviewEnd] = useState(null);
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
      .filter((e) => e.type === 'civilization' || e.type === 'milestone' || e.type === 'war' || e.type === 'chosen')
      .slice(0, 3)
      .forEach((e) => {
        // Chosen-species milestones are the arc's big beats - always a loud
        // toast + a Curator line (red if your people fell, gold if they rose).
        if (e.type === 'chosen') {
          const fell = /are gone|ends here|lost to/i.test(e.description || '');
          toast(e.description, fell ? 'critical' : 'success', 11000);
          narrate(e.description);
          return;
        }
        toast(e.description, e.type === 'milestone' ? 'success' : 'info', 7000);
        if (e.type === 'war' || /holy war|worship|monument|tribute|denounc/i.test(e.description || '')) {
          narrate(e.description);
        }
        // First war the player ever witnesses: teach the intervention options
        if (e.type === 'war' && /erupts/i.test(e.description || '')) {
          narrateOnce('war-explainer', CURATOR.war.explainer);
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

  // Initial universe fetch. The guard matters: GET /:id stamps the visit
  // server-side, and React StrictMode double-runs effects in dev - without
  // it the second fetch sees "you were here milliseconds ago" and the
  // away-digest can never appear during development.
  const fetchedRef = useRef(null);
  useEffect(() => {
    if (fetchedRef.current === id) return;
    fetchedRef.current = id;

    const fetchUniverse = async () => {
      try {
        const uni = await getUniverse(id);
        setUniverse(uni);
        // "While you were away" digest - only materializes after a real
        // absence with something to report (buildDigest returns null otherwise)
        setDigest(buildDigest(uni));
        dlog(`🌌 Universe loaded: ${uni.name}`);
        dlog(`   Galaxies: ${uni.currentState.galaxyCount}`);
        dlog(`   Stars: ${uni.currentState.starCount}`);
        dlog(`   Backend Anomalies: ${uni.anomalies.length}`);
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
        dlog(`✓ Anomaly ${anomaly.id} already resolved in this session`);
        return;
      }

      // Check if we're already resolving this anomaly
      if (resolvingAnomaliesRef.current.has(anomaly.id)) {
        dlog(`⏳ Anomaly ${anomaly.id} is already being resolved, skipping duplicate request`);
        return;
      }

      // Mark this anomaly as being resolved
      resolvingAnomaliesRef.current.add(anomaly.id);

      // The Self: containing an anomaly (the minigame was won to reach here) is
      // an act of Mastery, whichever tier of anomaly it was.
      applySelfResult(recordAxis('mastery', MASTERY_RESOLVE));

      // Check if it's a backend anomaly (has proper UUID format from backend)
      // Backend anomaly IDs look like: "673ab123_1234567890_123456"
      // Procedural anomaly IDs look like: "chunkX:chunkY:index" (e.g., "0:0:0")
      const isBackendAnomaly = anomaly.id && !anomaly.id.includes(":");

      dlog(`🎯 Resolving ${isBackendAnomaly ? 'BACKEND' : 'procedural'} anomaly`);
      dlog(`   ID: ${anomaly.id}`);
      dlog(`   Type: ${anomaly.type}`);
      dlog(`   Severity: ${anomaly.severity}`);
      dlog(`   Game result: ${anomaly.gameResult?.status}, Score: ${anomaly.gameResult?.score}`);

      if (isBackendAnomaly) {
        // Sync with backend for physics-based anomalies
        try {
          const data = await resolveAnomaly(id, anomaly.id, anomaly.gameResult?.accuracy);

          if (data.ok) {
            // Mark as resolved in this session to prevent double-resolution
            resolvedAnomaliesRef.current.add(anomaly.id);

            setUniverse(data.universe);
            dlog(`✅ Backend anomaly resolved!`);
            dlog(`   Stability boost: +${(data.stabilityBoost * 100).toFixed(2)}%`);
            dlog(`   New stability: ${(data.universe.currentState.stabilityIndex * 100).toFixed(1)}%`);
          } else {
            console.error("❌ Backend returned not ok:", data);
          }
        } catch (apiErr) {
          const errorMsg = apiErr.response?.data?.error || apiErr.message;

          // If anomaly is already resolved, mark it as such locally
          if (errorMsg && errorMsg.includes('already resolved')) {
            dlog(`✓ Anomaly was already resolved on backend`);
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
            dlog(`✅ Minor anomaly resolved (+${data.reward} RP)`);
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
          // Optimistically include the survey-streak bonus; the server clamps
          // and reconciles on ack.
          points: (prev.research?.points || 0) + Math.round((discovery.research || 0) * (discovery.surveyMult || 1)),
        },
      };
    });

    // The Self: cataloging the cosmos is the core act of Comprehension. Deep
    // finds - things you had to DESCEND the scales to reach, or the exceptional
    // rarities - carry the "hidden" tag, which also feeds the Wanderer.
    const hidden = discovery.rarity === 'exceptional'
      || discovery.category === 'star' || discovery.category === 'planet';
    applySelfResult(recordAxis('comprehension', comprehensionForDiscovery(discovery.rarity), { hidden }));

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
        dlog(`🔧 Upgrade installed: ${track}`, data.upgrades);
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
        if (data.outcome === 'backfire') narrate(pick(CURATOR.backfire));
        if (data.outcome === 'armed') narrate(pick(CURATOR.war.armed));
        if (data.outcome === 'brokered') narrate(pick(CURATOR.war.brokered));
        if (data.outcome === 'rescued') narrate(pick(CURATOR.rescue));
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Contact failed - try again" };
    }
  };

  // Civilizations petition the player (utils/petitionSystem.js). New petitions
  // arrive on the universe object after a sim tick / on load; announce each
  // once and surface the oldest unanswered one in a dialog.
  const seenPetitionsRef = useRef(new Set());
  const dismissedPetitionsRef = useRef(new Set());
  const [petition, setPetition] = useState(null);

  useEffect(() => {
    if (!universe) return;
    const list = (universe.civilizations || [])
      .filter((c) => c.petition && !c.extinct)
      .map((c) => ({ civId: c.id, personality: c.personality, ...c.petition }));

    for (const p of list) {
      if (!seenPetitionsRef.current.has(p.id)) {
        seenPetitionsRef.current.add(p.id);
        toast(`${p.civName} calls out to you`, 'info', 8000);
        narrate(pick(CURATOR.petition));
      }
    }

    setPetition((prev) => {
      if (prev && list.some((p) => p.id === prev.id)) {
        return list.find((p) => p.id === prev.id); // keep open, refreshed
      }
      // otherwise open the oldest active petition the player hasn't deferred
      return list.find((p) => !dismissedPetitionsRef.current.has(p.id)) || null;
    });
  }, [universe, toast]);

  // Arm the death cinematic the moment an ending appears - whether it happened
  // in front of the player (a live tick flipping status to "ended") or before
  // they opened this universe at all. Once seen, it never plays again.
  //
  // The same moment marks the warden. A universe's death is the largest event
  // in the game and used to move the self by nothing at all; letting one
  // unravel pulls toward the Unmaker, and seeing one through to its natural
  // end is an act of witness. Keyed to the same "seen" flag so re-opening a
  // dead universe can't bank the ending twice.
  useEffect(() => {
    if (universe?.status !== 'ended') return;
    if (hasSeenEnding(id)) return;

    const axis = endingAxis(universe.endCondition);
    if (axis) applySelfResult(recordAxis(axis.kind, axis.weight));

    setPlayEnding(true);
  }, [universe?.status, universe?.endCondition, id]);

  // Distress calls. A siege is the most dramatic thing that happens in this
  // universe and the player would otherwise have to fly into one by accident,
  // so every new one is announced the moment it appears on the document. The
  // Locator ([B]) is where it becomes actionable - hence the nudge.
  const hailedSiegesRef = useRef(new Set());

  useEffect(() => {
    if (!universe) return;
    const civs = universe.civilizations || [];
    const sieges = besiegedWorlds(civs, universe.activeWars || []);
    const live = new Set(sieges.map((s) => `${s.attackerId}>${s.civ.id}`));

    for (const { civ, attackerId, war } of sieges) {
      const key = `${attackerId}>${civ.id}`;
      if (hailedSiegesRef.current.has(key)) continue;
      hailedSiegesRef.current.add(key);
      playSfx('alert');
      toast(`⚠ ${civDesignation(civ.id)} is under attack — Locator [B]`, 'critical', 12000);
      // The scripted opening siege (backend utils/openingSiege.js) teaches the
      // mechanic; every natural one after it gets the short version.
      if (war?.scripted) {
        narrateOnce('first-siege', pick(CURATOR.fleet.firstSiege), 'warning');
      } else {
        narrate(pick(CURATOR.fleet.distress), 'warning');
      }
    }

    // Forget resolved sieges so the same two peoples can raise a fresh call if
    // they go at it again later.
    for (const key of hailedSiegesRef.current) {
      if (!live.has(key)) hailedSiegesRef.current.delete(key);
    }
  }, [universe, toast]);

  // The Chosen Species climax: when the people you shepherded reach Type III,
  // the backend records an immortal legacy (and frees chosenCivId so you may
  // champion anew). Show the Legacy screen once per new legacy record. Seeding
  // the "seen" set on first load prevents replaying past ascensions as popups.
  const legacyCelebratedRef = useRef(null);
  const [legacy, setLegacy] = useState(null);
  // The Self: an ascension is the headline act of Mastery.
  const [pendingRevelation, setPendingRevelation] = useState(null);
  // Previous universe snapshot for scoring Neglect (the pull toward The Unmaker).
  const prevUniverseForNeglectRef = useRef(null);

  // Surface the fallout of an axis event: the Curator voices each recovered
  // Memory, and a realized Self triggers the Revelation sequence.
  const applySelfResult = (res) => {
    if (!res) return;
    for (const m of res.recoveredMemories || []) {
      narrate(m.text, 'curious');
    }
    if ((res.recoveredMemories || []).length > 0) {
      // Teach the panel the first time a memory ever surfaces (session-once;
      // effectively account-once since veterans will have heard it already).
      narrateOnce('self-panel-hint',
        "That was a memory, warden - a piece of what you are, come back. I keep what you recover where you can read it. Press [J] when you want to look at yourself.");
    }
    for (const ins of res.newInsights || []) {
      narrate(ins.text, 'proud');
    }
    if (res.revelation) setPendingRevelation(res.revelation);
    if (res.anamnesisComplete) narrate(ANAMNESIS_LINE, 'awe');
  };

  useEffect(() => {
    if (!universe) return;
    const records = universe.legacies || [];
    if (legacyCelebratedRef.current === null) {
      // First load: remember everything already achieved, celebrate nothing.
      legacyCelebratedRef.current = new Set(records.map((l) => l.civId));
      return;
    }
    const fresh = records.find((l) => !legacyCelebratedRef.current.has(l.civId));
    if (fresh) {
      legacyCelebratedRef.current.add(fresh.civId);
      // The Ascension is the main goal - completing one advances the eternal
      // Warden rank across all universes.
      const warden = recordAscension();
      applySelfResult(recordAxis('mastery', MASTERY_ASCENSION));
      setLegacy({ ...fresh, legacyNumber: records.length, warden });
    }
  }, [universe]);

  // The Self: score Neglect from each universe transition - the fabric tearing
  // into crisis, or a people you had met left to go extinct. Feeds The Unmaker.
  useEffect(() => {
    if (!universe) return;
    const prev = prevUniverseForNeglectRef.current;
    prevUniverseForNeglectRef.current = universe;
    if (!prev) return; // first snapshot: nothing to compare against
    const weight = neglectDelta(prev, universe);
    if (weight > 0) applySelfResult(recordAxis('neglect', weight));
  }, [universe]);

  const handlePetitionResponse = async (civId, petitionId, optionId) => {
    try {
      const data = await respondPetition(id, civId, petitionId, optionId);
      if (data.ok && data.universe) {
        setUniverse(data.universe);
        announceAchievements(data.newAchievements);
        if (data.message) toast(data.message, 'info', 7000);
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Response failed - try again" };
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

  // Commit to a build-identity doctrine. Server owns the reward-affecting part;
  // the movement/scan effects apply live because the scene reads universe.doctrine.
  const handleSetDoctrine = async (doctrine) => {
    try {
      const data = await setDoctrine(id, doctrine);
      if (data.ok) {
        setUniverse((prev) => (prev ? { ...prev, doctrine: data.doctrine } : prev));
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Failed to set doctrine" };
    }
  };

  // Destroyed civilization vessels. A firefight kills ships in bursts, so
  // strikes are batched per (victim, defended world) and flushed shortly after
  // the shooting stops - one request per engagement instead of one per kill.
  const strikeBufferRef = useRef(new Map());
  const strikeTimerRef = useRef(null);

  const flushWarStrikes = async () => {
    const pending = [...strikeBufferRef.current.entries()];
    strikeBufferRef.current.clear();
    strikeTimerRef.current = null;

    for (const [key, entry] of pending) {
      try {
        const data = await reportWarStrike(id, entry.civId, entry.kills, entry.defendingCivId);
        if (data.ok && data.universe) {
          setUniverse(data.universe);
          // The Self hears about this. Breaking a siege is the most direct act
          // of care available - you had to be there, in person, with a gun.
          // Killing a people's ships for any other reason is the same act
          // pointed the other way, and it costs you the same way.
          if (data.brokeSiege) {
            // The server's message carries the RP it paid, so the reward and
            // the reason for it arrive together.
            toast(data.message, 'good', 8000);
            playSfx('minigameWin');
            applySelfResult(recordAxis('mastery', MASTERY_SIEGE_BROKEN));
          } else {
            const counted = Math.min(entry.kills, MAX_STRIKE_KILLS);
            applySelfResult(recordAxis('neglect', NEGLECT_AGGRESSION * counted));
          }
        }
      } catch (err) {
        console.warn(`War strike (${key}) failed:`, err.response?.data?.error || err.message);
      }
    }
  };

  const handleWarStrike = (civId, kills, context = {}) => {
    // Only a strike against a genuine besieger can break a siege; a defender's
    // own losses are just aggression, and the server verifies both.
    const defendingCivId = context.wasRaider ? context.defendingCivId : undefined;
    const key = `${civId}:${defendingCivId ?? "-"}`;
    const buf = strikeBufferRef.current;
    const entry = buf.get(key) || { civId, defendingCivId, kills: 0 };
    entry.kills += kills;
    buf.set(key, entry);

    clearTimeout(strikeTimerRef.current);
    strikeTimerRef.current = setTimeout(flushWarStrikes, 2500);
  };

  // Bombardment runs the player did not stop. Batched the same way - a bomber
  // lands a run every few seconds, and the world only needs to hear about it
  // in chunks. The server decides what it costs, including extinction.
  const bombardBufferRef = useRef(new Map());
  const bombardTimerRef = useRef(null);

  const flushBombardments = async () => {
    const pending = [...bombardBufferRef.current.entries()];
    bombardBufferRef.current.clear();
    bombardTimerRef.current = null;

    for (const [key, entry] of pending) {
      try {
        const data = await reportBombardment(id, entry.civId, entry.runs, entry.attackerCivId);
        if (data.ok && data.universe) {
          setUniverse(data.universe);
          if (data.extinct) {
            toast(data.message, 'critical', 10000);
            narrate(
              "They are gone. Not by entropy, not by bad luck - by a decision someone " +
              "else made and you were close enough to contest. That is the weight of " +
              "being here, warden.",
              "grim"
            );
          }
        }
      } catch (err) {
        console.warn(`Bombardment (${key}) failed:`, err.response?.data?.error || err.message);
      }
    }
  };

  const handleBombardment = (civId, runs, attackerCivId) => {
    const key = `${attackerCivId}>${civId}`;
    const buf = bombardBufferRef.current;
    const entry = buf.get(key) || { civId, attackerCivId, runs: 0 };
    entry.runs += runs;
    buf.set(key, entry);

    clearTimeout(bombardTimerRef.current);
    bombardTimerRef.current = setTimeout(flushBombardments, 4000);
  };

  // The death penalty (fail state): the vessel is lost, so the universe drifts
  // while you recover - a stability hit + forced time-skip, server-authoritative.
  // The scene has already played the destruction; here we book the consequence
  // and surface it, so death finally means losing ground.
  const handleVesselLost = async () => {
    try {
      const data = await registerVesselLost(id);
      if (data.ok && data.universe) {
        setUniverse(data.universe);
        const p = data.penalty || {};
        const myr = Math.round((p.yearsSkipped || 0) / 1e6);
        const stabPct = Math.abs((p.stabilityDelta || 0) * 100).toFixed(0);
        toast(`Vessel lost — ${myr} Myr drifted, stability −${stabPct}%`, 'critical', 8000);
        if (p.hasEnded) {
          narrate("Your recovery came too late. The universe you were keeping is gone.");
        } else if ((p.stabilityDelta || 0) <= -0.08) {
          narrate("You are back — but the cosmos frayed while you were away. Deaths are not free out here.");
        }
      }
    } catch {
      // Non-fatal: the destruction/respawn already happened client-side.
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

        dlog(`🔄 Running background simulation...`);

        const data = await simulateUniverse(id, playerPositionRef.current);

        if (data.ok) {
          setUniverse(data.universe);
          setLastSimulation(Date.now());
          announceAchievements(data.newAchievements);

          const stats = data.stats;
          dlog(`✅ Simulation complete:`);
          dlog(`   Age: ${stats.ageGyr} Gyr (${stats.cosmicPhase})`);
          dlog(`   Galaxies: ${stats.galaxies}`);
          dlog(`   Stars: ${stats.stars}`);
          dlog(`   Stability: ${stats.stability}`);
          dlog(`   Backend Anomalies: ${stats.anomaliesActive}/${stats.anomaliesTotal}`);

          if (data.createdAnomalies?.length > 0) {
            dlog(`⚠️  Generated ${data.createdAnomalies.length} new backend anomalies:`);
            data.createdAnomalies.forEach(a => {
              dlog(`     - ${a.type} (severity ${a.severity}) at (${a.location.x.toFixed(0)}, ${a.location.y.toFixed(0)})`);
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
          dlog(`🧹 Cleaning up ${resolvedCount} resolved anomalies...`);

          const data = await cleanupAnomalies(id, 10); // Keep last 10 minutes

          if (data.ok) {
            dlog(`✅ Cleaned ${data.removed} old anomalies (${data.remaining} remaining)`);

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

  // A universe's death is a sequence, not a screen: the cinematic plays, fades
  // to its own resolve colour, and the epitaph card resolves out of that. It
  // plays ONCE per universe - an ended universe is permanent and the player may
  // reopen it many times; a 7-second animation every visit would be a tax.
  if (universe.status === 'ended') {
    if (playEnding) {
      const endSequence = () => {
        markEndingSeen(id);
        setPlayEnding(false);
      };
      return (
        // If the cinematic can't load or throws, go straight to the summary -
        // never strand the player on a black screen (CinematicBoundary).
        <CinematicBoundary
          fallback={null}
          onFail={(err) => {
            toast(`Cinematic failed: ${err?.message || err}`, 'critical', 10000);
            endSequence();
          }}
        >
          <UniverseEnding universe={universe} onComplete={endSequence} />
        </CinematicBoundary>
      );
    }
    return (
      <UniverseEndPanel
        universe={universe}
        onReturn={() => { window.location.href = '/dashboard'; }}
      />
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
        onVesselLost={handleVesselLost}
        onSetDoctrine={handleSetDoctrine}
        onWarStrike={handleWarStrike}
        onBombardment={handleBombardment}
        onPreviewEnding={setPreviewEnd}
      />
      {previewEnd && (
        <CinematicBoundary
          fallback={null}
          onFail={(err) => {
            setPreviewEnd(null);
            // A dev tool that fails silently is worse than no dev tool: say
            // exactly what broke, on screen, where it can be reported.
            toast(`Cinematic failed: ${err?.message || err}`, 'critical', 12000);
          }}
        >
          <UniverseEnding
            universe={{ ...universe, endCondition: previewEnd }}
            onComplete={() => setPreviewEnd(null)}
          />
        </CinematicBoundary>
      )}
      <RevelationOverlay selfId={pendingRevelation} onDone={() => setPendingRevelation(null)} />
      {digest && (
        <WelcomeBackPanel
          digest={digest}
          onClose={() => {
            setDigest(null);
            narrate(pick(CURATOR.welcomeBack));
          }}
        />
      )}
      {petition && !digest && !legacy && (
        <PetitionPanel
          petition={petition}
          onRespond={handlePetitionResponse}
          onClose={() => {
            dismissedPetitionsRef.current.add(petition.id);
            setPetition(null);
          }}
        />
      )}
      {legacy && (
        <LegacyPanel legacy={legacy} onClose={() => setLegacy(null)} />
      )}
      {fromBigBang && <FadeFromColor color="#ffffff" duration={0.9} />}
    </>
  );
};

export default GameplayPage;
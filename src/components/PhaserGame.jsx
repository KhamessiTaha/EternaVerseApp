import { useEffect, useRef, useState, useContext } from "react";
import Phaser from "phaser";
import { AuthContext } from "../context/AuthContext";
import { UniverseSceneFactory } from "./game/scenes/UniverseScene";
import { QuantumStabilizerScene } from "./game/scenes/QuantumStabilizerScene";
import { GravityWellScene } from "./game/scenes/GravityWellScene";
import { CascadeReactionScene } from "./game/scenes/CascadeReactionScene";
import { WaveformCollapseScene } from "./game/scenes/WaveformCollapseScene";
import { ExpansionContainmentScene } from "./game/scenes/ExpansionContainmentScene";
import { StructuralRealignmentScene } from "./game/scenes/StructuralRealignmentScene";
import { PolarityBalanceScene } from "./game/scenes/PolarityBalanceScene";
import { PrimaryInstrument, Console, ControlsHint } from "./game/ui/Panels";
import { HUDPanel } from "./game/ui/HUDPanel";
import { MinimapPanel } from "./game/ui/MinimapPanel";
import { FullMapPanel } from "./game/ui/FullMapPanel";
import { CodexPanel } from "./game/ui/CodexPanel";
import { DiscoveryToast } from "./game/ui/DiscoveryToast";
import { OutfittingPanel } from "./game/ui/OutfittingPanel";
import { SettingsPanel } from "./game/ui/SettingsPanel";
import { ChroniclePanel } from "./game/ui/ChroniclePanel";
import { FirstContactPanel } from "./game/ui/FirstContactPanel";
import { DevPanel } from "./game/ui/DevPanel";
import { MissionsPanel } from "./game/ui/MissionsPanel";
import { AchievementsPanel } from "./ui/AchievementsPanel";
import { HangarPanel } from "./ui/HangarPanel";
import { GameMenu } from "./game/ui/GameMenu";
import { NarratorOverlay } from "./game/ui/NarratorOverlay";
import { narrate, narrateOnce, pick, CURATOR } from "./game/narrator";
import { getLoadout } from "../api/userApi";
import { setLoadoutLocal, getLoadoutLocal } from "./game/loadoutStore";
import { HULL_CATALOG } from "./game/content/hullCatalog";
import { playSfx, stopEngine, stopAmbient } from "./game/audio";

const PhaserGame = ({ universe, onAnomalyResolved, onUniverseUpdate, onPlayerPositionUpdate, onDiscovery, onPurchaseUpgrade, onContactAction, onDevAction, onClaimMission }) => {
  const { user } = useContext(AuthContext);
  const isAdmin = !!user?.isAdmin;
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const [stats, setStats] = useState({ resolved: 0, discovered: 0 });
  const [hudData, setHudData] = useState(null);
  const [minimapData, setMinimapData] = useState(null);
  const [fullMapData, setFullMapData] = useState(null);
  const [isFullMapOpen, setIsFullMapOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [isOutfittingOpen, setIsOutfittingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChronicleOpen, setIsChronicleOpen] = useState(false);
  const [contactCivId, setContactCivId] = useState(null);
  const [isDevOpen, setIsDevOpen] = useState(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isHangarOpen, setIsHangarOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loadout, setLoadout] = useState(null); // { hull, shipColor } - fetched once, applied at scene creation

  // Fetch the player's saved hull/color before the scene mounts: seed the
  // module store the scene reads at spawn (and polls each frame for live
  // Hangar swaps), then unblock scene creation via the state gate.
  useEffect(() => {
    let cancelled = false;
    getLoadout()
      .then((data) => {
        if (cancelled) return;
        setLoadoutLocal(data.hull, data.shipColor);
        setLoadout({ hull: data.hull, shipColor: data.shipColor });
      })
      .catch(() => { if (!cancelled) setLoadout({ hull: 'interceptor', shipColor: '#dfa73f' }); });
    return () => { cancelled = true; };
  }, []);

  // Scan completions: show the toast locally, then hand the discovery up to
  // GameplayPage for the backend submission / optimistic universe update.
  const handleDiscoveryFromScene = (discovery) => {
    playSfx('discovery', discovery.rarity);
    narrateOnce('first-scan', pick(CURATOR.firstScan));
    if (discovery.rarity === 'exceptional') narrate(pick(CURATOR.exceptional));
    setToast({ discovery, key: Date.now() });
    onDiscovery?.(discovery);
  };

  // Open/close blips for the overlay panels. Compared against previous state
  // so the mount itself (all closed) never fires a sound.
  const prevPanelsRef = useRef({ map: false, codex: false, outfitting: false, settings: false, chronicle: false, contact: false });
  useEffect(() => {
    const prev = prevPanelsRef.current;
    const next = { map: isFullMapOpen, codex: isCodexOpen, outfitting: isOutfittingOpen, settings: isSettingsOpen, chronicle: isChronicleOpen, contact: !!contactCivId, missions: isMissionsOpen, achievements: isAchievementsOpen, hangar: isHangarOpen, menu: isMenuOpen };
    Object.keys(next).forEach((k) => {
      if (next[k] !== prev[k]) playSfx(next[k] ? 'uiOpen' : 'uiClose');
    });
    prevPanelsRef.current = next;
  }, [isFullMapOpen, isCodexOpen, isOutfittingOpen, isSettingsOpen, isChronicleOpen, contactCivId, isMissionsOpen, isAchievementsOpen, isHangarOpen, isMenuOpen]);

  // HUD update callback
  const handleHUDUpdate = (data) => {
    setHudData(data);
    if (data?.hull !== undefined && data.hull <= 30 && data.hull > 0) {
      narrateOnce('hull-critical', pick(CURATOR.hullCritical));
    }
    if (data?.position) {
      onPlayerPositionUpdate?.(data.position);
    }
  };

  // Minimap update callback
  const handleMinimapUpdate = (data) => {
    setMinimapData(data);
  };

  // Full map update callback
  const handleFullMapUpdate = (data) => {
    setFullMapData(data);
  };

  // Map toggle handler
  const handleMapToggle = () => {
    setIsFullMapOpen(prev => !prev);
  };

  // Overlay hotkeys. ESC behaves like a real game: closes whatever overlay
  // is open first, otherwise toggles Settings - and does nothing while a
  // minigame is running, where ESC already means "abort minigame".
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'm' || e.key === 'M') {
        handleMapToggle();
      }
      if (e.key === 'c' || e.key === 'C') {
        setIsCodexOpen(prev => !prev);
      }
      if (e.key === 'u' || e.key === 'U') {
        setIsOutfittingOpen(prev => !prev);
      }
      if (e.key === 'l' || e.key === 'L') {
        setIsChronicleOpen(prev => !prev);
      }
      if ((e.key === 'k' || e.key === 'K') && isAdmin) {
        setIsDevOpen(prev => !prev);
      }
      if (e.key === 'o' || e.key === 'O') {
        setIsMissionsOpen(prev => !prev);
      }
      if (e.key === 'p' || e.key === 'P') {
        setIsAchievementsOpen(prev => !prev);
      }
      if (e.key === 'h' || e.key === 'H') {
        setIsHangarOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        if (sceneRef.current?.inputSystem?.isMinigameActive) return;
        if (isDevOpen) { setIsDevOpen(false); return; }
        if (contactCivId) { setContactCivId(null); return; }
        if (isMissionsOpen) { setIsMissionsOpen(false); return; }
        if (isAchievementsOpen) { setIsAchievementsOpen(false); return; }
        if (isHangarOpen) { setIsHangarOpen(false); return; }
        if (isFullMapOpen) { setIsFullMapOpen(false); return; }
        if (isCodexOpen) { setIsCodexOpen(false); return; }
        if (isOutfittingOpen) { setIsOutfittingOpen(false); return; }
        if (isChronicleOpen) { setIsChronicleOpen(false); return; }
        if (isSettingsOpen) { setIsSettingsOpen(false); return; }
        // Nothing open: ESC is the game menu hub
        setIsMenuOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullMapOpen, isCodexOpen, isOutfittingOpen, isChronicleOpen, contactCivId, isDevOpen, isAdmin, isMissionsOpen, isAchievementsOpen, isHangarOpen, isSettingsOpen]);

  useEffect(() => {
    // Wait for the saved loadout so the ship never spawns/pops from a
    // default hull into the player's actual one.
    if (!loadout) return;

    const SceneClass = UniverseSceneFactory({
      universe,
      onAnomalyResolved,
      setStats,
      onHUDUpdate: handleHUDUpdate,
      onMinimapUpdate: handleMinimapUpdate,
      onFullMapUpdate: handleFullMapUpdate,
      onDiscovery: handleDiscoveryFromScene,
      onCivContact: (civId) => {
        narrateOnce('first-contact', pick(CURATOR.firstContact));
        setContactCivId(civId);
      }
    });

    const container = document.getElementById("phaser-container");
    if (!container) return;

    const config = {
      type: Phaser.AUTO,
      backgroundColor: "#000000",
      parent: "phaser-container",
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: "100%",
        height: "100%",
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [
        SceneClass,
        QuantumStabilizerScene,
        GravityWellScene,
        CascadeReactionScene,
        WaveformCollapseScene,
        ExpansionContainmentScene,
        StructuralRealignmentScene,
        PolarityBalanceScene,
      ]
    };

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
      gameRef.current.scene.start("UniverseScene", { universe, onAnomalyResolved, setStats });
      sceneRef.current = gameRef.current.scene.getScene("UniverseScene");
    }

    const resizeHandler = () => {
      if (gameRef.current && container) {
        gameRef.current.scale.resize(container.clientWidth, container.clientHeight);
      }
    };

    const resizeObserver = new ResizeObserver(resizeHandler);
    resizeObserver.observe(container);
    window.addEventListener("resize", resizeHandler);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeHandler);
      if (gameRef.current) {
        try {
          gameRef.current.destroy(true);
        } catch (e) {
          console.error("Cleanup error:", e);
        }
      }
      gameRef.current = null;
      sceneRef.current = null;
      // The audio engine lives outside Phaser - destroying the game does not
      // silence it, so the drone/hum must be stopped here or it would keep
      // playing on the dashboard after leaving the universe.
      stopEngine();
      stopAmbient();
    };
  }, [universe?.seed, universe?.name, loadout]);

  useEffect(() => {
    if (sceneRef.current && universe) {
      sceneRef.current.updateFromUniverse(universe);
    }
    // upgrades must be a dep: InputSystem/ScanSystem read stat modifiers off
    // the scene's universe reference, which only refreshes through this effect
  }, [universe?.anomalies, universe?.currentState, universe?.discoveries, universe?.upgrades, universe?.civilizations]);

  return (
    <div className="w-full h-full bg-void relative overflow-hidden">
      {/* Primary instrument - top left */}
      <div className="absolute top-5 left-5 z-10">
        <PrimaryInstrument universe={universe} />
      </div>

      {/* Right column: radar, console, controls hint - stacked in normal
          flow (not independently-positioned absolute blocks) so a taller
          Console or a resized radar (settings) can never overlap the hint
          pinned below it. Scrolls internally if the viewport is short. */}
      <div className="absolute top-5 right-5 bottom-5 z-10 flex flex-col items-end gap-3 pointer-events-none">
        <div className="pointer-events-auto shrink-0">
          <MinimapPanel minimapData={minimapData} onMapToggle={handleMapToggle} />
        </div>
        <div className="pointer-events-auto min-h-0 overflow-y-auto">
          <Console universe={universe} stats={stats} />
        </div>
        <div className="pointer-events-auto shrink-0 mt-auto">
          <ControlsHint />
        </div>
      </div>

      {/* Telemetry bar - bottom center */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
        <HUDPanel hudData={hudData} />
      </div>

      {/* Full Map Overlay */}
      <FullMapPanel
        isOpen={isFullMapOpen}
        onClose={handleMapToggle}
        fullMapData={fullMapData}
      />

      {/* Discovery toast + Codex + Outfitting overlays */}
      <DiscoveryToast toast={toast} />
      <CodexPanel
        isOpen={isCodexOpen}
        onClose={() => setIsCodexOpen(false)}
        universe={universe}
      />
      <OutfittingPanel
        isOpen={isOutfittingOpen}
        onClose={() => setIsOutfittingOpen(false)}
        universe={universe}
        onPurchase={onPurchaseUpgrade}
      />
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <ChroniclePanel
        isOpen={isChronicleOpen}
        onClose={() => setIsChronicleOpen(false)}
        universe={universe}
      />
      <FirstContactPanel
        civId={contactCivId}
        onClose={() => setContactCivId(null)}
        universe={universe}
        onAction={onContactAction}
      />
      {isAdmin && (
        <DevPanel
          isOpen={isDevOpen}
          onClose={() => setIsDevOpen(false)}
          onDevAction={onDevAction}
          onClientAction={(action) => {
            const scene = sceneRef.current;
            if (!scene?.player) return;
            if (action === 'damage-hull') {
              const remaining = scene.player.takeDamage(50);
              if (remaining <= 0) scene.handleShipDestroyed();
            } else if (action === 'destroy-ship') {
              scene.player.takeDamage(1000);
              scene.handleShipDestroyed();
            } else if (action === 'repair-hull') {
              scene.player.heal(100);
            } else if (action === 'cycle-hull') {
              // Session-only: writes the local store the scene polls, never
              // the server - locked hulls stay locked for real saves
              const { hull, shipColor } = getLoadoutLocal();
              const idx = HULL_CATALOG.findIndex((h) => h.id === hull);
              const next = HULL_CATALOG[(idx + 1) % HULL_CATALOG.length];
              setLoadoutLocal(next.id, shipColor);
            }
          }}
        />
      )}
      <MissionsPanel
        isOpen={isMissionsOpen}
        onClose={() => setIsMissionsOpen(false)}
        universe={universe}
        onClaim={onClaimMission}
      />
      <AchievementsPanel
        isOpen={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
      />
      {/* Live swap needs no wiring: HangarPanel writes the loadout store on
          save, and the running scene polls it every frame */}
      <HangarPanel
        isOpen={isHangarOpen}
        onClose={() => setIsHangarOpen(false)}
      />
      <GameMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        universeName={universe?.name}
        onOpenPanel={(id) => {
          const open = {
            missions: setIsMissionsOpen,
            codex: setIsCodexOpen,
            outfitting: setIsOutfittingOpen,
            hangar: setIsHangarOpen,
            chronicle: setIsChronicleOpen,
            achievements: setIsAchievementsOpen,
            map: setIsFullMapOpen,
            settings: setIsSettingsOpen,
          }[id];
          open?.(true);
        }}
      />
      <NarratorOverlay />

      <div id="phaser-container" className="w-full h-full" />
    </div>
  );
};

export default PhaserGame;
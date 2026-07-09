import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
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

const PhaserGame = ({ universe, onAnomalyResolved, onUniverseUpdate, onPlayerPositionUpdate, onDiscovery, onPurchaseUpgrade }) => {
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

  // Scan completions: show the toast locally, then hand the discovery up to
  // GameplayPage for the backend submission / optimistic universe update.
  const handleDiscoveryFromScene = (discovery) => {
    setToast({ discovery, key: Date.now() });
    onDiscovery?.(discovery);
  };

  // HUD update callback
  const handleHUDUpdate = (data) => {
    setHudData(data);
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

  // Listen for M key to toggle map
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
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    const SceneClass = UniverseSceneFactory({
      universe,
      onAnomalyResolved,
      setStats,
      onHUDUpdate: handleHUDUpdate,
      onMinimapUpdate: handleMinimapUpdate,
      onFullMapUpdate: handleFullMapUpdate,
      onDiscovery: handleDiscoveryFromScene
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
    };
  }, [universe?.seed, universe?.name]);

  useEffect(() => {
    if (sceneRef.current && universe) {
      sceneRef.current.updateFromUniverse(universe);
    }
    // upgrades must be a dep: InputSystem/ScanSystem read stat modifiers off
    // the scene's universe reference, which only refreshes through this effect
  }, [universe?.anomalies, universe?.currentState, universe?.discoveries, universe?.upgrades]);

  return (
    <div className="w-full h-full bg-void relative overflow-hidden">
      {/* Primary instrument - top left */}
      <div className="absolute top-5 left-5 z-10">
        <PrimaryInstrument universe={universe} />
      </div>

      {/* Radar - top right */}
      <div className="absolute top-5 right-5 z-10">
        <MinimapPanel minimapData={minimapData} onMapToggle={handleMapToggle} />
      </div>

      {/* Console - below radar, right */}
      <div className="absolute top-[172px] right-5 z-10">
        <Console universe={universe} stats={stats} />
      </div>

      {/* Telemetry bar - bottom center */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
        <HUDPanel hudData={hudData} />
      </div>

      {/* Controls hint - bottom right */}
      <div className="absolute bottom-5 right-5 z-10">
        <ControlsHint />
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

      <div id="phaser-container" className="w-full h-full" />
    </div>
  );
};

export default PhaserGame;
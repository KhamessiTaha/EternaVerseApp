import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { UniverseSceneFactory } from "./game/scenes/UniverseScene";
import { UniversePanel, StructuresPanel, LifePanel, MissionPanel, ControlsPanel } from "./game/ui/Panels";
import { HUDPanel } from "./game/ui/HUDPanel";

const PhaserGame = ({ universe, onAnomalyResolved, onUniverseUpdate }) => {
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const [stats, setStats] = useState({ resolved: 0, discovered: 0 });
  const [hudData, setHudData] = useState(null);
  const [expandedPanels, setExpandedPanels] = useState({
    hud: true,
    universe: true,
    structures: true,
    life: true,
    mission: true,
    controls: true
  });

  const togglePanel = (panel) => {
    setExpandedPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  // HUD update callback
  const handleHUDUpdate = (data) => {
    setHudData(data);
  };

  useEffect(() => {
    const SceneClass = UniverseSceneFactory({ 
      universe, 
      onAnomalyResolved, 
      setStats,
      onHUDUpdate: handleHUDUpdate 
    });

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
      scene: SceneClass,
    };

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
      gameRef.current.scene.start("UniverseScene", { universe, onAnomalyResolved, setStats });
      sceneRef.current = gameRef.current.scene.getScene("UniverseScene");
    }

    const resizeHandler = () => {
      gameRef.current?.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resizeHandler);

    return () => {
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
  }, [universe?.anomalies, universe?.currentState]);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      {/* Status Panels */}
      <div className="absolute top-4 left-4 z-10 text-white text-sm max-w-xs">
        <HUDPanel 
          hudData={hudData}
          expanded={expandedPanels.hud} 
          onToggle={() => togglePanel('hud')} 
        />

        <UniversePanel 
          universe={universe} 
          expanded={expandedPanels.universe} 
          onToggle={() => togglePanel('universe')} 
        />
        
        <StructuresPanel 
          universe={universe} 
          expanded={expandedPanels.structures} 
          onToggle={() => togglePanel('structures')} 
        />
        
        <LifePanel 
          universe={universe} 
          expanded={expandedPanels.life} 
          onToggle={() => togglePanel('life')} 
        />
        
        <MissionPanel 
          stats={stats} 
          universe={universe} 
          expanded={expandedPanels.mission} 
          onToggle={() => togglePanel('mission')} 
        />
      </div>

      {/* Controls Panel */}
      <div className="absolute bottom-5 right-4 z-10 text-white">
        <ControlsPanel 
          expanded={expandedPanels.controls} 
          onToggle={() => togglePanel('controls')} 
        />
      </div>

      <div id="phaser-container" className="w-full h-full" />
    </div>
  );
};

export default PhaserGame;
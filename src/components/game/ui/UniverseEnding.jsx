// src/components/game/ui/UniverseEnding.jsx
//
// Picks how a universe's death gets shown, and hides that choice from everyone
// above it.
//
// A prerendered film if one exists for this ending, and the procedural
// three.js version if not - decided per death, so the six films can land one
// at a time without a code change or a broken build in between. Drop
// public/cinematics/heat-death.mp4 in and heat deaths start using it; the
// other five carry on as they were.
//
// The procedural version stays LAZY. It drags a 1MB three.js chunk behind it,
// and once every death has a film that chunk should never be fetched during
// gameplay at all.
import { lazy, Suspense, useState } from "react";
import { sceneFor } from "../content/universeEnds";
import { UniverseEndVideo } from "./UniverseEndVideo";

const UniverseEndCinematic = lazy(() => import("./UniverseEndCinematic"));

export const UniverseEnding = ({ universe, onComplete }) => {
  const scene = sceneFor(universe?.endCondition);
  // A film that 404s or won't decode falls back to the procedural death rather
  // than to nothing. Missing art must never cost the player the moment.
  const [filmFailed, setFilmFailed] = useState(false);

  if (scene.video && !filmFailed) {
    return (
      <UniverseEndVideo
        scene={scene}
        onComplete={onComplete}
        onUnavailable={(err) => {
          console.warn(`Falling back to the procedural ending: ${err.message}`);
          setFilmFailed(true);
        }}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="w-full h-full bg-void flex items-center justify-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-faint animate-pulse">
            The end of everything
          </div>
        </div>
      }
    >
      <UniverseEndCinematic universe={universe} onComplete={onComplete} />
    </Suspense>
  );
};

export default UniverseEnding;

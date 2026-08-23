// src/components/game/ui/UniverseEndVideo.jsx
//
// A prerendered death, played from a video file.
//
// Same contract as the procedural cinematic it replaces: full-screen, skippable,
// calls onComplete exactly once when it's over. The caller can't tell which one
// it got, which is what lets the two coexist while the films are being made.
//
// Files live in public/cinematics/ and are served as plain static assets - NOT
// bundled - so adding one costs nothing at build time and only the death that
// actually happens gets downloaded.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FadeToColor } from "../../ui/ScreenFlash";

export const UniverseEndVideo = ({ scene, onComplete, onUnavailable }) => {
  const videoRef = useRef(null);
  const [handingOff, setHandingOff] = useState(false);
  const [showEpitaph, setShowEpitaph] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setHandingOff(true);
  };

  // Autoplay is allowed here in practice - the player has been clicking and
  // typing for a whole session, so the gesture requirement is long satisfied -
  // but a rejected play() must never strand anyone on a frozen first frame.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => onUnavailable?.(new Error("playback blocked")));
  }, [onUnavailable]);

  // The epitaph is overlaid only when the film doesn't carry its own titles.
  useEffect(() => {
    if (scene.videoHasTitles) return;
    const t = setTimeout(() => setShowEpitaph(true), (scene.epitaphAt ?? 0.32) * 4000);
    return () => clearTimeout(t);
  }, [scene]);

  // Skippable, armed after a beat so a click already in flight doesn't eat it.
  useEffect(() => {
    let armed = false;
    const arm = setTimeout(() => { armed = true; }, 800);
    const skip = () => { if (armed) finish(); };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(arm);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  // Same failsafe as the procedural version: a stalled buffer or a dropped
  // 'ended' event must not leave the player on a black rectangle forever.
  useEffect(() => {
    const cap = setTimeout(finish, (scene.duration + 6) * 1000);
    return () => clearTimeout(cap);
  }, [scene.duration]);

  useEffect(() => {
    if (!handingOff) return;
    const stuck = setTimeout(() => onComplete?.(), 1600);
    return () => clearTimeout(stuck);
  }, [handingOff, onComplete]);

  return (
    <div className="fixed inset-0 z-[90] bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={scene.video}
        poster={scene.videoPoster}
        playsInline
        // Muted unless the film carries its own sound: the synthesised
        // universeEnd cue is still playing underneath, and two scores at once
        // is worse than either alone.
        muted={!scene.videoHasAudio}
        preload="auto"
        onEnded={finish}
        onError={() => onUnavailable?.(new Error(`missing or unplayable: ${scene.video}`))}
      />

      {showEpitaph && !handingOff && (
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-24 px-6">
          <motion.div
            className="text-center max-w-xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          >
            <h1 className="font-sans text-4xl md:text-5xl text-ink font-light tracking-wide mb-4 drop-shadow-lg">
              {scene.title}
            </h1>
            <p className="font-sans text-[15px] leading-relaxed text-ink-dim/90 italic drop-shadow">
              {scene.line}
            </p>
          </motion.div>
        </div>
      )}

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: handingOff ? 0 : 0.55 }}
        transition={{ delay: handingOff ? 0 : 1.8, duration: handingOff ? 0.3 : 1 }}
      >
        Press any key to skip
      </motion.div>

      {handingOff && (
        <FadeToColor color={scene.resolveTo} duration={0.85} onComplete={onComplete} />
      )}
    </div>
  );
};

export default UniverseEndVideo;

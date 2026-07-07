import { motion } from "framer-motion";

// Full-screen cinematic flash primitives. Three.js (Big Bang) and Phaser
// (gameplay) are two separate rendering contexts that can't be crossfaded
// directly - a flash-cut is the reliable way to bridge them: cover the
// screen completely at the exact moment one unmounts and the other mounts,
// so the technical seam reads as an intentional beat instead of a glitch.

// Quick flash-in-then-out - for punctuating a beat within one scene
// (e.g. a stage transition) without leaving the screen covered.
export const FlashCut = ({ color = "#e9e7f2", peakOpacity = 0.35, duration = 0.4 }) => (
  <motion.div
    className="fixed inset-0 pointer-events-none z-[100]"
    style={{ backgroundColor: color }}
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, peakOpacity, 0] }}
    transition={{ duration, times: [0, 0.35, 1], ease: "easeInOut" }}
  />
);

// Fades TO full opacity and stays - use right before a route/scene handoff,
// fire the actual navigation from onComplete so it happens while covered.
export const FadeToColor = ({ color = "#ffffff", duration = 0.7, onComplete }) => (
  <motion.div
    className="fixed inset-0 pointer-events-none z-[100]"
    style={{ backgroundColor: color }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration, ease: "easeIn" }}
    onAnimationComplete={onComplete}
  />
);

// Fades FROM full opacity to transparent - render on mount of the scene
// being handed off into, so it reveals from the same flash color.
export const FadeFromColor = ({ color = "#ffffff", duration = 0.9 }) => (
  <motion.div
    className="fixed inset-0 pointer-events-none z-[100]"
    style={{ backgroundColor: color }}
    initial={{ opacity: 1 }}
    animate={{ opacity: 0 }}
    transition={{ duration, ease: "easeOut" }}
  />
);

// src/components/game/content/customAssets.js
//
// Optional custom art. Drop transparent-background PNGs into EternaVerseApp/
// public/ at the paths below and the game uses them automatically; anything
// you leave out falls back to the built-in procedural texture. This is
// additive - you can replace one type or all of them.
//
// NOT limited: add MORE files to any array for more variety. Every instance is
// independently rotated and scaled (and stars are tinted to their spectral
// color), so even 2-3 images per type read as an endlessly varied sky.
//
// See public/assets/objects/README.md for full prompts. Short version:
//  - Galaxies/nebulae/stars/quasars render ADDITIVELY, so a solid BLACK
//    background is invisible - generate them on black, no transparency needed.
//  - Planets are solid bodies - they need a TRANSPARENT background.
//  - Stars must be WHITE / grayscale (tinted to each spectral color at runtime);
//    galaxies and planets are full color.
//  - Square, centered, subject filling ~80% of the frame, soft edges.
//
// Only list a file here once it actually exists (a listed-but-missing file
// just 404s and falls back). Uncomment / add lines as you create the art.
export const CUSTOM_ASSETS = {
  // --- Galaxies, by morphology (full color) --------------------------------
  spiral: ["assets/objects/galaxy-spiral-1.jpg", "assets/objects/galaxy-spiral-2.jpg"],
  // barred: ["assets/objects/galaxy-barred-1.png"],
  // elliptical: ["assets/objects/galaxy-elliptical-1.png", "assets/objects/galaxy-elliptical-2.png"],
  // irregular: ["assets/objects/galaxy-irregular-1.png"],
  // nebula: ["assets/objects/nebula-1.png", "assets/objects/nebula-2.png"],
  // quasar: ["assets/objects/quasar-1.png"],
  // merger: ["assets/objects/galaxy-merger-1.png"],

  // --- Stars: one WHITE glow (tinted per spectral class at runtime) ---------
  // star: ["assets/objects/star.png"],

  // --- Planets: one full-color PNG per class -------------------------------
  // "planet:terran": ["assets/objects/planet-terran.png"],
  // "planet:ocean": ["assets/objects/planet-ocean.png"],
  // "planet:desert": ["assets/objects/planet-desert.png"],
  // "planet:rocky": ["assets/objects/planet-rocky.png"],
  // "planet:barren": ["assets/objects/planet-barren.png"],
  // "planet:ice": ["assets/objects/planet-ice.png"],
  // "planet:gas": ["assets/objects/planet-gas.png"],
  // "planet:lava": ["assets/objects/planet-lava.png"],
};

// The texture key a manifest entry maps to. Galaxies get an indexed variant
// key (evtex:spiral:0, :1, ...); stars and planets are single keys that match
// what TextureFactory.keyFor() already returns.
export function customTextureKey(family, index) {
  if (family === "star") return "evtex:star";
  if (family.startsWith("planet:")) return `evtex:${family}`; // evtex:planet:terran
  return `evtex:${family}:${index}`;
}

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
  barred: ["assets/objects/galaxy-barred-1.jpg", "assets/objects/galaxy-barred-2.jpg"],
  elliptical: ["assets/objects/galaxy-elliptical-1.jpg", "assets/objects/galaxy-elliptical-2.jpg"],
  irregular: ["assets/objects/galaxy-irregular-1.jpg", "assets/objects/galaxy-irregular-2.jpg"],
  nebula: ["assets/objects/nebula-1.jpg", "assets/objects/nebula-2.jpg"],
  quasar: ["assets/objects/quasar-1.jpg", "assets/objects/quasar-2.jpg"],
  merger: ["assets/objects/galaxy-merger-1.jpg", "assets/objects/galaxy-merger-2.jpg"],

  // --- Stars ---------------------------------------------------------------
  // Either ONE white glow (tinted to every spectral color)...
  // star: ["assets/objects/star.png"],
  // ...OR a distinct, already-colored image per spectral class (any class you
  // omit falls back to the tinted white star above). O/B are hot & blue,
  // G is sun-like yellow, M is a small red dwarf.
  "star:O": ["assets/objects/star-o.jpg"],
  "star:B": ["assets/objects/star-b.jpg"],
  "star:A": ["assets/objects/star-a.jpg"],
  "star:F": ["assets/objects/star-f.jpg"],
  "star:G": ["assets/objects/star-g.jpg"],
  "star:K": ["assets/objects/star-k.jpg"],
  "star:M": ["assets/objects/star-m.jpg"],

  // --- Planets: one full-color image per class -----------------------------
  "planet:terran": ["assets/objects/planet-terran.jpg"],
  "planet:ocean": ["assets/objects/planet-ocean.jpg"],
  "planet:desert": ["assets/objects/planet-desert.jpg"],
  "planet:rocky": ["assets/objects/planet-rocky.jpg"],
  "planet:barren": ["assets/objects/planet-barren.jpg"],
  "planet:ice": ["assets/objects/planet-ice-1.jpg"],
  "planet:gas": ["assets/objects/planet-gas.jpg"],
  "planet:lava": ["assets/objects/planet-lava.jpg"],
};

// The texture key a manifest entry maps to. Galaxies get an indexed variant
// key (evtex:spiral:0, :1, ...); stars and planets are single keys that match
// what TextureFactory.keyFor() already returns.
export function customTextureKey(family, index) {
  if (family === "star") return "evtex:star";            // single white star (tinted)
  if (family.startsWith("star:")) return `evtex:${family}`;   // per-class, e.g. evtex:star:O
  if (family.startsWith("planet:")) return `evtex:${family}`; // evtex:planet:terran
  return `evtex:${family}:${index}`;
}

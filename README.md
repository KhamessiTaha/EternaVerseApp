# EternaVerse

A browser-based universe simulation game. Create a universe, watch real cosmology unfold from the Big Bang, contain spacetime anomalies, and guide civilizations from first fire to interstellar transcendence — worshipped, allied with, or at war with you. The universe keeps evolving even while you're away.

Frontend for [EternaVerseApp_Backend](https://github.com/KhamessiTaha/EternaVerseApp_Backend), which owns all simulation and economy logic — this app is the renderer and the controller.

## What it does

- **Big Bang to now.** Every universe is procedurally generated from a seed and advances through real simulated cosmology — structure formation, stellar evolution, life emergence, and civilizations climbing the Kardashev scale — server-side, continuously, whether or not you're logged in.
- **Flight, not menus.** The core loop happens in a Phaser 3 scene: fly a ship, scan objects, resolve anomalies in real time, make first contact, choose a side in a civilization's war. Eight unlockable hulls, each with a distinct ability.
- **Relativity as a game mechanic.** Approach light speed and mass visibly climbs toward infinity, thrust falls off, the ship's length contracts, and the sky darkens — the Lorentz factor is computed every frame and actually drives the flight model, not just a HUD number.
- **The Curator.** An ambient narrator entity (in the spirit of *Solar 2*) that greets you by cosmic era, reacts to what you do, and idles into unprompted musings — carries onboarding and flavor instead of tutorial popups.
- **Everything else is procedural.** Ship textures, particle effects, and ambient audio are generated at runtime — no external art or sound assets.
- **A universe that doesn't pause.** Backend sweeps advance every active universe on a schedule, and a "While You Were Away" digest summarizes what happened the moment you return.

## Stack

React 19 · Vite · Phaser 3.88 (gameplay) · Three.js + react-three-fiber (Big Bang cinematic) · Tailwind CSS

## Architecture

```
src/
  pages/            route-level pages (Dashboard, GameplayPage, BigBangPage, auth)
  components/game/
    scenes/         Phaser scene(s) — UniverseScene is the core gameplay loop
    systems/        one class per concern: input, civilizations, hazards, salvage,
                     abilities, cosmic events, minimap/full map, HUD, player object
    ui/             React panels rendered over the canvas (menus, HUD, dev console)
    graphics/       runtime-generated textures (TextureFactory)
    content/        display-only catalogs (hulls, abilities, achievements) —
                     mirrors of the backend's source of truth, for rendering only
    world/          procedural generation (density fields, object placement)
    narrator.js     the Curator's dialogue queue and shuffle-bags
    settings.js     persisted client settings, shared by React and Phaser via a
                     module-level store with a subscribe/notify pattern
    loadoutStore.js same pattern, for the player's current hull/color
  api/              typed fetch wrappers over the backend REST API
```

React and Phaser share state through small module-singleton stores (`settings.js`, `loadoutStore.js`) rather than prop-drilling into the canvas — Phaser polls them per frame, React writes to them on user action, and both stay in sync without React re-rendering the scene.

The simulation itself is never trusted client-side: gameplay content in `components/game/content/` mirrors the backend's catalogs purely for display, and every reward or state change is a request to the server, which recomputes and validates it independently.

## Getting started

```bash
npm install
cp .env.example .env   # set VITE_API_URL to your backend's URL
npm run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the [backend API](https://github.com/KhamessiTaha/EternaVerseApp_Backend) (e.g. `http://localhost:3000/api` locally, or the deployed Vercel URL) |

## Testing

```bash
npm test    # unit tests for the procedural-generation modules
npm run lint
```

Procedural-generation modules (`components/game/world/`) carry their own unit tests alongside the source, covering the density field, object placement, and research-value catalogs.

## Related

- [EternaVerseApp_Backend](https://github.com/KhamessiTaha/EternaVerseApp_Backend) — the API and simulation engine this app talks to

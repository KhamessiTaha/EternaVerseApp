# EternaVerse

**A browser-based universe simulation game.** Create a universe, watch real cosmology unfold from the Big Bang, contain spacetime anomalies, and guide civilizations from first fire to interstellar transcendence — worshipped, allied with, or at war with you. The universe keeps evolving even while you're away.

> 🔒 **Proprietary — commercial project in active development.** This repository is published for portfolio and demonstration purposes. The source is **not** open for reuse, redistribution, or self-hosting. See [copyright](#copyright).

**▶ Play it:** [eterna-verse-app.vercel.app](https://eterna-verse-app.vercel.app/)

<!-- Add screenshots / a short GIF here — Big Bang cinematic, flight + an anomaly resolve, first contact, the Chronicle. -->

---

## Highlights

- **Big Bang to now.** Every universe is procedurally generated from a seed and advances through simulated cosmology — structure formation, stellar evolution, life emergence, and civilizations climbing the Kardashev scale — continuously, whether or not you're logged in.
- **Flight, not menus.** The core loop is a real-time space scene: fly a ship, scan objects, resolve anomalies, make first contact, choose a side in a civilization's war. Eight unlockable hulls, each with a distinct ability.
- **Relativity as a game mechanic.** Approach light speed and mass visibly climbs toward infinity, thrust falls off, the ship's length contracts, and the sky darkens — the Lorentz factor is computed every frame and actually drives the flight model, not just a HUD number.
- **The Curator.** An ambient narrator entity that greets you by cosmic era, reacts to what you do, and idles into unprompted musings — carrying tone and guidance instead of tutorial popups.
- **Everything is procedural.** Ship textures, particle effects, and ambient audio are generated at runtime — no external art or sound assets.
- **A universe that doesn't pause.** The backend advances every active universe on a schedule, and a "While You Were Away" digest summarizes what happened the moment you return.

## Engineering notes

A few things a technical reviewer might find interesting:

- **Server-authoritative by design.** The client never decides its own rewards or state. Every economy action is validated and recomputed by the [backend](https://github.com/KhamessiTaha/EternaVerseApp_Backend); the frontend holds display-only mirrors. Tampering with the client changes nothing that persists.
- **React and a game engine, sharing state cleanly.** UI panels (React) and the live gameplay scene (a canvas engine) stay in sync through small subscribe/notify module stores rather than prop-drilling into the canvas — the engine polls per frame, React writes on user action.
- **Offline progression on free-tier infrastructure.** No always-on process; universes catch up via scheduled sweeps and opportunistically on reopen, with optimistic-concurrency handling for writes that race the sweep.
- **Code-split engine payloads.** The Three.js cinematic and the gameplay engine are lazy-loaded so the landing and auth pages paint fast.

## Tech stack

React 19 · Vite · Phaser 3 (gameplay) · Three.js + react-three-fiber (Big Bang cinematic) · Tailwind CSS · deployed on Vercel

The simulation engine and economy live in a separate private service: **[EternaVerseApp_Backend](https://github.com/KhamessiTaha/EternaVerseApp_Backend)** (Node · Express · MongoDB).

## Copyright

© 2026 Taha Khamessi. All rights reserved.

This project and its source code are proprietary. No permission is granted to use, copy, modify, distribute, or self-host any part of this repository. It is shared publicly solely to demonstrate the author's work. For inquiries: **khamessi.taha@gmail.com**.

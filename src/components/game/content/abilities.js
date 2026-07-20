// src/components/game/content/abilities.js
//
// One active ability per hull, triggered on SPACE (AbilitySystem). Client-
// side gameplay effects only - nothing here touches server state, so no
// backend mirror is needed. Cooldowns/durations in ms.

export const ABILITIES = {
  interceptor: {
    label: "Overcharge Scan", cooldown: 22000,
    description: "Instantly completes a scan of the nearest object in range.",
  },
  cutter: {
    label: "Containment Pulse", cooldown: 20000, duration: 2000,
    description: "Detonates a pulse that wipes nearby missiles and grants 2s of immunity.",
  },
  falcon: {
    label: "Afterburner", cooldown: 8000, duration: 900,
    description: "Violent dash along the nose with a split-second of immunity. The dodge tool.",
  },
  cruiser: {
    label: "Ceasefire Broadcast", cooldown: 45000, duration: 20000,
    description: "All hostile civilizations hold their fire for 20 seconds.",
  },
  bastion: {
    label: "Fortress Mode", cooldown: 30000, duration: 4000,
    description: "Anchors the ship: immune to all damage and forces for 4 seconds.",
  },
  hauler: {
    label: "Salvage Magnet", cooldown: 25000,
    description: "Pulls every salvage mote in a wide radius into the hull.",
  },
  tachyon: {
    label: "Time Dilation", cooldown: 40000, duration: 3500,
    description: "Slows the universe around you for 3.5s. Missiles crawl. You don't.",
  },
  vanguard: {
    label: "Flagship Rally", cooldown: 35000,
    description: "Emergency resupply: restores 35 hull and half the boost reactor.",
  },
};

// src/components/game/systems/HazardSystem.js
//
// Makes anomalies physically real. Gravitational anomalies PULL the ship,
// cosmological ones (dark energy) push it away, and every anomaly deals
// hull damage inside its danger ring - so approaching a severity-5 black
// hole merger to resolve it is a risk decision, not a chore. Forces are
// added on top of the acceleration InputSystem already set this frame.
import { getLoadoutLocal } from "../loadoutStore.js";
import { HULL_STATS } from "../content/hullCatalog.js";

export const dangerRadius = (severity) => 110 + (severity || 1) * 28;
export const pullRadius = (severity) => 400 + (severity || 1) * 80;

// Tuning rule: the TOTAL hazard force must stay below base thrust (280),
// so escape is always possible - anomalies are hazards, not tractor beams.
const PULL_ACCEL = 45;   // per severity: sev 5 = 225 at point-blank
const PUSH_ACCEL = 30;   // dark-energy repulsion, weaker
const MAX_HAZARD_ACCEL = 220; // hard cap on the summed force from ALL anomalies
const DAMAGE_TICK_MS = 500;
const dps = (severity) => 5 + (severity || 1) * 3;

export class HazardSystem {
  constructor(scene) {
    this.scene = scene;
    this.lastDamageAt = 0;
  }

  update(time) {
    const player = this.scene.player;
    if (!player?.body) return;
    if (this.scene.respawning) return;
    if (this.scene.inputSystem?.isMinigameActive) return;
    // Full grace during invulnerability (fresh spawn / respawn): no forces,
    // no damage - the player always gets a moment to orient and fly clear
    if (time < (player.invulnerableUntil || 0)) return;

    let incomingDps = 0;
    let fx = 0;
    let fy = 0;

    const applyAnomaly = (x, y, severity, category, resolved) => {
      if (resolved) return;
      const dx = x - player.x;
      const dy = y - player.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;

      const pr = pullRadius(severity);
      if (d < pr) {
        // Quadratic falloff: barely felt at the rim, strong at the core
        const falloff = Math.pow(1 - d / pr, 2);
        let accel = 0;
        if (category === "gravitational") accel = PULL_ACCEL * severity * falloff;
        else if (category === "cosmological") accel = -PUSH_ACCEL * severity * falloff;
        fx += (dx / d) * accel;
        fy += (dy / d) * accel;
      }

      if (d < dangerRadius(severity)) {
        incomingDps = Math.max(incomingDps, dps(severity));
      }
    };

    this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
      chunk.anomalies.forEach((a) => applyAnomaly(a.x, a.y, a.severity, a.category, a.resolved));
    });
    this.scene.anomalySystem.backendAnomalies.forEach((a) => {
      if (typeof a.location?.x === "number") {
        applyAnomaly(a.location.x, a.location.y, a.severity, a.category, false);
      }
    });

    // Cap the SUMMED force so stacked anomalies can never out-pull thrust
    const total = Math.sqrt(fx * fx + fy * fy);
    if (total > MAX_HAZARD_ACCEL) {
      fx = (fx / total) * MAX_HAZARD_ACCEL;
      fy = (fy / total) * MAX_HAZARD_ACCEL;
    }
    player.body.acceleration.x += fx;
    player.body.acceleration.y += fy;

    if (incomingDps > 0 && time - this.lastDamageAt >= DAMAGE_TICK_MS) {
      this.lastDamageAt = time;
      // Hull armor rating scales exposure (Bastion 0.55x ... Tachyon 1.25x)
      const armor = HULL_STATS[getLoadoutLocal().hull]?.damageTaken ?? 1;
      // takeDamage plays the hit feedback (scale pulse + shake if enabled)
      const remaining = player.takeDamage(incomingDps * (DAMAGE_TICK_MS / 1000) * armor);
      if (remaining <= 0) {
        this.scene.handleShipDestroyed();
      }
    }
  }
}

// src/components/game/systems/SurgeSystem.js
//
// Anomaly Surges: the PUNCTUATION of the loop. Scanning and slingshotting are
// the calm flow; a surge is the spike - every couple of minutes the fabric
// tears in a cluster right on top of you, demanding you drop the flow and
// contain it. Ignore it and the tears SPREAD; seal it fast and you're rewarded
// (full boost, a flourish, the Curator's rare approval). This is the rhythm
// that keeps hours from blurring: calm -> alarm -> engage -> relief.
//
// Surge anomalies are just minor anomalies pushed into the loaded chunks, so
// interaction / hazards / scanning all handle them with zero new plumbing; the
// system tracks their ids to know when the cluster is contained.
import { getChunkCoords, getChunkKey } from "../utils";
import { ANOMALY_TYPES } from "../constants";
import { playSfx } from "../audio.js";
import { narrate, pick, CURATOR } from "../narrator.js";

const FIRST_SURGE_DELAY = 95000; // ms of settle time before the first surge
const CALM_MIN = 80000;          // base calm between surges (scaled by stability)
const CALM_MAX = 150000;
const ESCALATE_AFTER = 34000;    // unresolved this long -> the tears spread
const ABANDON_AFTER = 105000;    // give-up window if the player just leaves
const CHECK_INTERVAL = 500;      // ms between (cheap) containment checks

let surgeSeq = 0; // unique index namespace for surge anomaly ids

export class SurgeSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = null; // { ids:[], total, startedAt, escalated }
    this.nextAt = FIRST_SURGE_DELAY;
    this._lastCheck = 0;
    this.contained = 0;
  }

  getSurge() {
    if (!this.active) return { active: false };
    const { resolved, present } = this._tally();
    return { active: true, total: this.active.total, resolved, remaining: present, escalated: this.active.escalated };
  }

  _stability() {
    return this.scene.universe?.currentState?.stabilityIndex ?? 1;
  }

  update(time) {
    if (this.active) {
      if (time - this._lastCheck > CHECK_INTERVAL) { this._lastCheck = time; this._tick(time); }
      return;
    }
    if (time < this.nextAt) return;
    if (!this._canSurge()) { this.nextAt = time + 15000; return; }
    this._begin(time);
  }

  _canSurge() {
    const s = this.scene;
    return (s.world?.scale ?? "galactic") === "galactic"
      && !s.respawning
      && !s.inputSystem?.isMinigameActive
      && !s.firstLightId
      && s.player
      && this.scene.time.now > (s.player.invulnerableUntil || 0);
  }

  _begin(time) {
    const stability = this._stability();
    const count = 3 + Math.floor((1 - stability) * 3); // 3..6, worse when unstable
    const ids = [];
    for (let i = 0; i < count; i++) {
      const id = this._spawnOne(stability);
      if (id) ids.push(id);
    }
    if (ids.length === 0) { this.nextAt = time + 20000; return; } // no loaded chunk near - retry soon

    this.active = { ids, total: ids.length, startedAt: time, escalated: false };
    playSfx("surgeAlarm");
    this.scene.cameras.main.flash(260, 90, 30, 40, false);
    narrate(pick(CURATOR.surge.start), "warning");
  }

  // Spawn one surge anomaly in a ring around the player, pushed into its chunk.
  _spawnOne(stability) {
    const p = this.scene.player;
    const angle = Math.random() * Math.PI * 2;
    const dist = 420 + Math.random() * 440;
    const x = p.x + Math.cos(angle) * dist;
    const y = p.y + Math.sin(angle) * dist;

    const { chunkX, chunkY } = getChunkCoords(x, y);
    const chunk = this.scene.chunkSystem.loadedChunks.get(getChunkKey(chunkX, chunkY));
    if (!chunk) return null;

    const type = ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)];
    // Higher severity when the universe is already unstable.
    const roll = Math.random() + (1 - stability) * 0.6;
    const severity = roll > 1.1 ? 3 : roll > 0.65 ? 2 : 1;
    const id = `${chunkX}:${chunkY}:${900 + (surgeSeq++)}`;

    const anomaly = this.scene.anomalySystem.createAnomaly(x, y, type, severity, id, false);
    anomaly.surge = true;
    chunk.anomalies.push(anomaly);
    this.scene.anomalySystem.discoveredAnomalies.add(id);
    return id;
  }

  // How many of the surge's anomalies are resolved vs still present in-world.
  _tally() {
    const resolvedSet = this.scene.anomalySystem.resolvedAnomalies;
    let resolved = 0;
    let present = 0;
    const live = new Set();
    this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
      for (const a of chunk.anomalies) if (a.surge && !a.resolved) live.add(a.id);
    });
    for (const id of this.active.ids) {
      if (resolvedSet.has(id)) resolved += 1;
      else if (live.has(id)) present += 1;
      // else: fled/unloaded - counts as neither
    }
    return { resolved, present };
  }

  _tick(time) {
    const { resolved, present } = this._tally();

    if (present === 0) {
      // No tears left in-world: contained if the player sealed them all.
      if (resolved >= this.active.total) this._contain();
      else this._fizzle();
      return;
    }

    if (!this.active.escalated && time - this.active.startedAt > ESCALATE_AFTER) {
      this.active.escalated = true;
      const stability = this._stability();
      for (let i = 0; i < 2; i++) {
        const id = this._spawnOne(stability);
        if (id) { this.active.ids.push(id); this.active.total += 1; }
      }
      playSfx("surgeAlarm");
      narrate(pick(CURATOR.surge.escalate), "warning");
    } else if (time - this.active.startedAt > ABANDON_AFTER) {
      this._fizzle();
    }
  }

  _contain() {
    this.contained += 1;
    if (this.scene.inputSystem) this.scene.inputSystem.boostEnergy = 100; // reward: full boost
    playSfx("surgeContained");
    this.scene.cameras.main.flash(320, 80, 220, 180, false);
    narrate(pick(CURATOR.surge.contained), "awe");
    this._end(this.scene.time.now);
  }

  _fizzle() {
    narrate(pick(CURATOR.surge.fizzled), "grim");
    this._end(this.scene.time.now);
  }

  _end(time) {
    this.active = null;
    const stability = this._stability();
    // Unstable universes surge more often; calm ones get real breathing room.
    const calm = (CALM_MIN + Math.random() * (CALM_MAX - CALM_MIN)) * (0.55 + stability * 0.6);
    this.nextAt = time + calm;
  }

  destroy() {}
}

// src/components/game/systems/ScanSystem.js
//
// V-key scan channel: target the nearest unscanned object (cosmic objects
// AND active anomalies), channel for SCAN_DURATION_MS with a ring + progress
// arc, cancel if the player leaves range, and emit "scan:complete" with a
// normalized discovery payload on success. Scanning an anomaly is
// independent of resolving it (each is once-only per object).
import Phaser from "phaser";
import { SCAN_RANGE, SCAN_DURATION_MS, SCAN_CANCEL_RANGE, ANOMALY_TYPE_MAP } from "../constants";
import { ANOMALY_SCAN_BASE } from "../world/researchValues.js";
import { getShipModifiers } from "../content/upgradeCatalog.js";
import { playSfx } from "../audio.js";
import { narrate, narrateOnce, pick, CURATOR } from "../narrator.js";

// Survey streak: chaining scans builds a combo that makes scans FASTER and
// worth more RP, but a decay window means you have to keep moving/finding.
// Turns the game's most-repeated action from a passive wait into a flow game.
const STREAK_WINDOW_MS = 5200; // idle longer than this and the streak breaks
const STREAK_MAX_SPEEDUP = 9;  // streaks past this don't get faster
const STREAK_RP_PER = 0.05;    // +5% RP per streak step...
const STREAK_RP_CAP = 0.6;     // ...up to +60%

export class ScanSystem {
  constructor(scene) {
    this.scene = scene;
    this.scannedIds = new Set();
    this.active = null; // { target, elapsed, gfx }
    this.streak = 0;
    this.best = 0;
    this.lastScanAt = -Infinity;
  }

  // Multiplier the streak grants to research (mirrored/clamped server-side).
  surveyMult() {
    return 1 + Math.min(this.streak * STREAK_RP_PER, STREAK_RP_CAP);
  }

  // Streak state for the HUD: current, best, and the decay bar (1 -> 0).
  getSurvey() {
    const remaining = this.streak > 0
      ? Math.max(0, 1 - (this.scene.time.now - this.lastScanAt) / STREAK_WINDOW_MS)
      : 0;
    return { streak: this.streak, best: this.best, remaining, mult: this.surveyMult() };
  }

  seedScanned(ids) {
    for (const id of ids || []) this.scannedIds.add(id);
  }

  isScanned(id) {
    return this.scannedIds.has(id);
  }

  // Collect scannable candidates as { id, x, y, discovery }.
  _candidates() {
    const out = [];

    this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
      for (const { descriptor } of chunk.objects) {
        if (this.scannedIds.has(descriptor.id)) continue;
        out.push({
          id: descriptor.id, x: descriptor.x, y: descriptor.y,
          discovery: {
            id: descriptor.id, name: descriptor.name, category: descriptor.category,
            objectClass: descriptor.objectClass, rarity: descriptor.rarity,
            research: descriptor.research, location: { x: descriptor.x, y: descriptor.y },
          },
        });
      }
      for (const anom of chunk.anomalies) {
        if (anom.resolved || this.scannedIds.has(`scan:${anom.id}`)) continue;
        out.push(this._anomalyCandidate(anom.id, anom.x, anom.y, anom.type, anom.severity, false));
      }
    });

    this.scene.anomalySystem.backendAnomalies.forEach((anom) => {
      if (!anom.visual || this.scannedIds.has(anom.id)) return;
      out.push(this._anomalyCandidate(anom.id, anom.location.x, anom.location.y, anom.type, anom.severity, true));
    });

    return out;
  }

  _anomalyCandidate(id, x, y, type, severity, isBackend) {
    const label = ANOMALY_TYPE_MAP[type]?.label ?? type;
    // Procedural anomaly ids collide with nothing server-side but are never
    // sent there anyway (GameplayPage routes them by the ":" convention);
    // prefix their scan-tracking key so a resolved+rescanned chunk regen
    // can't confuse them with object ids.
    return {
      id: isBackend ? id : `scan:${id}`, x, y,
      discovery: {
        id, name: `Anomaly · ${label}`, category: "anomaly",
        objectClass: type, rarity: severity >= 4 ? "rare" : severity >= 3 ? "uncommon" : "common",
        research: ANOMALY_SCAN_BASE * Math.max(1, Math.floor(severity || 1)),
        location: { x, y },
        isBackend,
      },
    };
  }

  // Scanner Array upgrade widens range and shortens channel time; read live
  // from the scene's universe so a purchase applies immediately.
  _mods() {
    return getShipModifiers(this.scene.universe?.upgrades, this.scene.universe?.doctrine);
  }

  tryStartScan() {
    if (this.active) return;
    const player = this.scene.player;
    let nearest = null;
    let best = SCAN_RANGE * this._mods().scanRange;
    for (const c of this._candidates()) {
      const d = Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y);
      if (d < best) { best = d; nearest = c; }
    }
    if (!nearest) return;

    playSfx('scanStart');
    this.active = {
      target: nearest,
      elapsed: 0,
      gfx: this.scene.add.graphics().setDepth(50),
    };
  }

  update(delta) {
    // Streak decay runs whether or not a scan is in progress.
    if (this.streak > 0 && this.scene.time.now - this.lastScanAt > STREAK_WINDOW_MS) {
      this._breakStreak();
    }

    if (!this.active) return;
    const { target, gfx } = this.active;
    const player = this.scene.player;
    const mods = this._mods();

    // Cancel range keeps the stock cancel/start ratio, scaled with the upgrade
    const cancelRange = SCAN_RANGE * mods.scanRange * (SCAN_CANCEL_RANGE / SCAN_RANGE);
    if (Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y) > cancelRange) {
      playSfx('scanCancel');
      this._cancel();
      return;
    }

    // A hot streak scans faster - flow is self-reinforcing.
    const speed = Math.max(0.45, 1 - Math.min(this.streak, STREAK_MAX_SPEEDUP) * 0.06);
    this.active.elapsed += delta;
    const t = Math.min(1, this.active.elapsed / (SCAN_DURATION_MS * mods.scanDuration * speed));

    gfx.clear();
    gfx.lineStyle(1.5, 0x4ec9e0, 0.5);
    gfx.strokeCircle(target.x, target.y, 34 + Math.sin(this.scene.time.now / 120) * 3);
    gfx.lineStyle(3, 0x4ec9e0, 0.95);
    gfx.beginPath();
    gfx.arc(target.x, target.y, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    gfx.strokePath();
    gfx.lineStyle(1, 0x4ec9e0, 0.35);
    gfx.lineBetween(player.x, player.y, target.x, target.y);

    if (t >= 1) this._complete();
  }

  _breakStreak() {
    if (this.streak >= 3) playSfx('surveyBreak');
    this.streak = 0;
  }

  _complete() {
    const { target, gfx } = this.active;
    gfx.destroy();
    this.active = null;

    // Advance the survey streak: chain, juice, milestones.
    this.streak += 1;
    this.best = Math.max(this.best, this.streak);
    this.lastScanAt = this.scene.time.now;
    playSfx('surveyTick', { streak: this.streak });

    if (this.streak > 0 && this.streak % 5 === 0) {
      playSfx('surveyMilestone');
      this.scene.cameras.main.flash(180, 78, 200, 220, false);
      if (this.streak === 5) narrateOnce('survey-5', pick(CURATOR.survey.rhythm), 'amused');
      else if (this.streak === 10) narrateOnce('survey-10', pick(CURATOR.survey.hot), 'awe');
      else if (this.streak >= 15) narrate(pick(CURATOR.survey.blazing), 'awe');
    }

    playSfx('scanComplete');
    this.scannedIds.add(target.id);
    target.discovery.surveyStreak = this.streak;
    target.discovery.surveyMult = this.surveyMult();

    // Pulse effect
    const pulse = this.scene.add.graphics({ x: target.x, y: target.y }).setDepth(50);
    pulse.lineStyle(2, 0x4ec9e0, 0.9);
    pulse.strokeCircle(0, 0, 20);
    this.scene.tweens.add({
      targets: pulse, scaleX: 4, scaleY: 4, alpha: 0,
      duration: 600, ease: "Cubic.easeOut",
      onComplete: () => pulse.destroy(),
    });

    // Cataloged marker for cosmic objects still in a loaded chunk
    if (target.discovery.category !== "anomaly") {
      this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
        const entry = chunk.objects.find((o) => o.descriptor.id === target.id);
        if (entry) this.attachCatalogedMarker(entry);
      });
    }

    this.scene.events.emit("scan:complete", { discovery: target.discovery });
  }

  attachCatalogedMarker(entry) {
    if (entry.marker) return;
    const { descriptor } = entry;
    entry.marker = this.scene.add.graphics({ x: descriptor.x, y: descriptor.y }).setDepth(8);
    entry.marker.lineStyle(1, 0x4fd1a5, 0.55);
    entry.marker.strokeCircle(0, 0, 10);
    entry.marker.lineBetween(-3, 0, -1, 3);
    entry.marker.lineBetween(-1, 3, 4, -3);
  }

  _cancel() {
    this.active?.gfx.destroy();
    this.active = null;
  }

  destroy() {
    this._cancel();
  }
}

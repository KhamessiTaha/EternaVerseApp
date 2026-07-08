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

export class ScanSystem {
  constructor(scene) {
    this.scene = scene;
    this.scannedIds = new Set();
    this.active = null; // { target, elapsed, gfx }
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

  tryStartScan() {
    if (this.active) return;
    const player = this.scene.player;
    let nearest = null;
    let best = SCAN_RANGE;
    for (const c of this._candidates()) {
      const d = Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y);
      if (d < best) { best = d; nearest = c; }
    }
    if (!nearest) return;

    this.active = {
      target: nearest,
      elapsed: 0,
      gfx: this.scene.add.graphics().setDepth(50),
    };
  }

  update(delta) {
    if (!this.active) return;
    const { target, gfx } = this.active;
    const player = this.scene.player;

    if (Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y) > SCAN_CANCEL_RANGE) {
      this._cancel();
      return;
    }

    this.active.elapsed += delta;
    const t = Math.min(1, this.active.elapsed / SCAN_DURATION_MS);

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

  _complete() {
    const { target, gfx } = this.active;
    gfx.destroy();
    this.active = null;

    this.scannedIds.add(target.id);

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

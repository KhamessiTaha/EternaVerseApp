import Phaser from 'phaser';
import seedrandom from 'seedrandom';
import { CHUNK_SIZE, ANOMALY_SPAWN_CHANCE, ANOMALIES_PER_CHUNK, ANOMALY_TYPES } from '../constants';
import { getChunkKey } from '../utils';
import { generateScaleObjects } from '../world/worldScales.js';
import { cosmicProfile } from '../world/cosmicProfile.js';
import { TextureFactory } from '../graphics/TextureFactory.js';
import { axisRatioFor } from '../world/researchValues.js';

export class ChunkSystem {
  constructor(scene, anomalySystem) {
    this.scene = scene;
    this.anomalySystem = anomalySystem;
    this.loadedChunks = new Map();
    this.activeChunkRadius = 2;
    // First Light: a scripted, guaranteed first-session anomaly (set by the
    // scene). Injected whenever its chunk generates, until it's resolved.
    this.forcedAnomaly = null;
  }

  loadNearbyChunks(centerX, centerY) {
    const newChunks = new Map();
    const radius = this.activeChunkRadius;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const chunkX = centerX + dx;
        const chunkY = centerY + dy;
        const key = getChunkKey(chunkX, chunkY);

        if (!this.loadedChunks.has(key)) {
          newChunks.set(key, this.generateChunk(chunkX, chunkY));
        } else {
          newChunks.set(key, this.loadedChunks.get(key));
        }
      }
    }

    // Cleanup far chunks
    this.loadedChunks.forEach((chunk, key) => {
      if (!newChunks.has(key)) {
        this.cleanupChunk(chunk);
      }
    });

    this.loadedChunks = newChunks;
  }

  // Tear down every loaded chunk - used when changing cosmic scale (descend /
  // ascend), after which loadNearbyChunks repopulates from the new scale.
  reset() {
    this.loadedChunks.forEach((chunk) => this.cleanupChunk(chunk));
    this.loadedChunks = new Map();
  }

  generateChunk(chunkX, chunkY) {
    const chunk = { objects: [], anomalies: [], salvage: [] };
    // Scale-aware seed: at the galactic scale this is just the universe seed;
    // descending into a galaxy/star re-seeds off that structure's id so its
    // interior is a distinct, stable world (Cosmic Scales).
    const seed = this.scene.worldSeed?.() ?? this.scene.universe.seed ?? "seed";
    const scale = this.scene.world?.scale ?? "galactic";
    // Name of the structure we descended into (the star, at planetary scale) so
    // its planets can be named after it.
    const labels = this.scene.world?.labels ?? [];
    const parentName = labels[labels.length - 1];

    // Coherent Cosmos: the same authoritative state the HUD shows drives what
    // this chunk actually contains - density, era mood, and fabric turbulence.
    const cp = cosmicProfile(this.scene.universe?.currentState);

    for (const descriptor of generateScaleObjects(seed, chunkX, chunkY, scale, parentName, cp)) {
      chunk.objects.push(this.renderObject(descriptor));
    }

    this.generateSalvage(chunk, chunkX, chunkY, seed);

    // Procedural anomalies only at the galactic scale for now - their ids are
    // "chunkX:chunkY:index" and would collide across scales (Cosmic Scales
    // Phase 1 keeps anomaly/civ gameplay at the top scale). Ambient turbulence
    // scales inversely with the universe's stability: a failing cosmos frays
    // and spawns more field anomalies around the player.
    const chunkSeed = seed + getChunkKey(chunkX, chunkY);
    const rng = seedrandom(chunkSeed);
    if (scale === "galactic" && rng() < Math.min(0.95, ANOMALY_SPAWN_CHANCE * cp.turbulence)) {
      this.generateProceduralAnomalies(chunk, chunkX, chunkY, rng);
    }

    // Scripted First Light anomaly: a guaranteed gentle tear right by spawn so a
    // new warden always has an obvious first target. Persists until resolved.
    const fa = this.forcedAnomaly;
    if (fa && scale === "galactic" && fa.chunkX === chunkX && fa.chunkY === chunkY
        && !this.anomalySystem.resolvedAnomalies.has(fa.id)) {
      const anomaly = this.anomalySystem.createAnomaly(fa.x, fa.y, ANOMALY_TYPES[0], fa.severity, fa.id, false);
      anomaly.firstLight = true;
      chunk.anomalies.push(anomaly);
      this.anomalySystem.discoveredAnomalies.add(fa.id);
    }

    return chunk;
  }

  // Salvage motes: session-only hull-repair collectibles (see SalvageSystem).
  // Seeded per chunk so layouts are stable, but collection state is not
  // persisted - motes respawn when a chunk regenerates, by design.
  generateSalvage(chunk, chunkX, chunkY, seed) {
    const rng = seedrandom(`${seed}#salvage#${getChunkKey(chunkX, chunkY)}`);
    const count = 2 + Math.floor(rng() * 4); // 2-5 per chunk

    for (let i = 0; i < count; i++) {
      const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;

      const gfx = this.scene.add.graphics({ x, y }).setDepth(3);
      gfx.fillStyle(0xdfa73f, 0.9);
      gfx.fillRect(-2.5, -2.5, 5, 5);
      gfx.rotation = Math.PI / 4;

      this.scene.tweens.add({
        targets: gfx,
        y: y + 6,
        alpha: { from: 0.5, to: 0.95 },
        duration: 1400 + rng() * 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      chunk.salvage.push({ x, y, gfx, collected: false });
    }
  }

  renderObject(descriptor) {
    const isNebula = descriptor.category === "nebula";
    const isPhenomenon = descriptor.category === "phenomenon";
    const isStar = descriptor.category === "star";
    const isPlanet = descriptor.category === "planet";

    const textureKey = this.scene.textureFactory.keyFor(descriptor);
    const isCustom = TextureFactory.isCustom(textureKey);
    // Ellipticals are drawn at their actual Hubble flattening - an E7 is a lens,
    // an E0 is round. The class always said so; the renderer used to ignore it
    // and pick a texture by hashing the id, so a player could be paid 14 RP for
    // something drawn as a 6-RP round blob. Rotation is applied after, so the
    // flattening tilts with the galaxy.
    const ratio = axisRatioFor(descriptor.objectClass);
    const image = this.scene.add.image(descriptor.x, descriptor.y, textureKey)
      .setScale(descriptor.scale, descriptor.scale * ratio)
      .setRotation(descriptor.rotation)
      .setAlpha(descriptor.alpha)
      .setDepth(isNebula ? -3 : -1);

    // Tint only the shared WHITE star texture to its spectral color. A custom
    // per-class star image (evtex:star:O, etc.) is already colored - don't tint.
    if (isStar && textureKey === "evtex:star" && typeof descriptor.color === "number") {
      image.setTint(descriptor.color);
    }

    // Custom art is already background-keyed to transparent, so it renders with
    // normal blend (shows the image as-is). Procedural emissive objects
    // (galaxies/nebulae/stars/phenomena) are faint glows meant to be ADDITIVE,
    // which also stops them boxing each other on overlap. Planets are always
    // normal-blend solid bodies.
    if (!isPlanet && !isCustom) {
      image.setBlendMode(Phaser.BlendModes.ADD);
    }

    if (descriptor.objectClass === "quasar") {
      this.scene.tweens.add({
        targets: image,
        alpha: { from: 0.75, to: 1 },
        scaleX: { from: descriptor.scale * 0.96, to: descriptor.scale * 1.06 },
        scaleY: { from: descriptor.scale * 0.96, to: descriptor.scale * 1.06 },
        duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
    }

    // Point lights for the larger structures only (perf budget).
    // NOTE: the old implementation leaked these lights on chunk unload -
    // they are now tracked per-object and removed in cleanupChunk.
    let light = null;
    if (!this.scene.graphicsQualityLow) {
      const lightThreshold = this.scene.graphicsQualityMedium ? 0.75 : 0.65;
      if (isStar) {
        // Stars cast their own colored light on the system around them.
        light = this.scene.lights.addLight(descriptor.x, descriptor.y, 200 * descriptor.scale + 90, descriptor.color ?? 0xffe2b0, 0.55);
      } else if (isPhenomenon || (descriptor.category === "galaxy" && descriptor.scale > lightThreshold)) {
        const color = descriptor.objectClass === "quasar" ? 0x9fe6f0 : 0xffe2b0;
        light = this.scene.lights.addLight(descriptor.x, descriptor.y, 140 * descriptor.scale + 60, color, 0.35);
      }
    }

    const entry = { descriptor, image, light };

    if (this.scene.scanSystem?.isScanned(descriptor.id)) {
      this.scene.scanSystem.attachCatalogedMarker(entry);
    }

    return entry;
  }

  generateProceduralAnomalies(chunk, chunkX, chunkY, rng) {
    const anomalyCount = Math.floor(rng() * ANOMALIES_PER_CHUNK) + 1;

    for (let i = 0; i < anomalyCount; i++) {
      const type = ANOMALY_TYPES[Math.floor(rng() * ANOMALY_TYPES.length)];
      const severity = Math.floor(rng() * 3) + 1;
      const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const anomalyId = `${chunkX}:${chunkY}:${i}`;

      if (this.anomalySystem.resolvedAnomalies.has(anomalyId)) continue;

      const anomaly = this.anomalySystem.createAnomaly(x, y, type, severity, anomalyId, false);
      chunk.anomalies.push(anomaly);

      if (!this.anomalySystem.discoveredAnomalies.has(anomalyId)) {
        this.anomalySystem.discoveredAnomalies.add(anomalyId);
        this.scene.setStats?.((prev) => ({
          ...prev,
          discovered: (prev.discovered || 0) + 1
        }));
      }
    }
  }

  cleanupChunk(chunk) {
    for (const entry of chunk.objects) {
      this.scene.tweens.killTweensOf(entry.image);
      entry.image.destroy();
      if (entry.light) this.scene.lights.removeLight(entry.light);
      entry.marker?.destroy();
    }
    chunk.anomalies.forEach(a => this.anomalySystem.destroyAnomalyVisual(a));
    chunk.salvage?.forEach((mote) => {
      this.scene.tweens.killTweensOf(mote.gfx);
      mote.gfx.destroy();
    });
  }
}

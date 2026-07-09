// src/components/game/systems/SalvageSystem.js
//
// Salvage motes: small drifting debris scattered through every chunk,
// collected by flying through them. Each repairs a bit of hull - the
// micro-reward loop that makes transit between objectives feel alive, and
// the economy that makes hull damage recoverable. Client-only ambience
// (chunk-seeded, respawn with chunk regeneration); generation lives in
// ChunkSystem, this system handles collection.
import Phaser from "phaser";
import { playSfx } from "../audio.js";

const COLLECT_RANGE = 42;
const HULL_REPAIR = 8;

export class SalvageSystem {
  constructor(scene) {
    this.scene = scene;
  }

  update() {
    const player = this.scene.player;
    if (!player || this.scene.respawning) return;

    this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
      if (!chunk.salvage) return;
      for (const mote of chunk.salvage) {
        if (mote.collected) continue;
        if (Phaser.Math.Distance.Between(player.x, player.y, mote.x, mote.y) > COLLECT_RANGE) continue;

        mote.collected = true;
        this.scene.tweens.killTweensOf(mote.gfx);
        // Zip into the ship, then vanish
        this.scene.tweens.add({
          targets: mote.gfx,
          x: player.x,
          y: player.y,
          scale: 0.2,
          alpha: 0,
          duration: 160,
          ease: "Cubic.easeIn",
          onComplete: () => mote.gfx.destroy(),
        });
        player.heal(HULL_REPAIR);
        playSfx("salvage");
      }
    });
  }
}

// src/components/game/systems/BackgroundSystem.js
//
// Parallax starfield depth. The world is infinite, so each layer is a large
// screen-fixed TileSprite re-centered on the camera every frame; parallax
// comes from scrolling tilePosition at a fraction of camera scroll.
import { TextureFactory } from "../graphics/TextureFactory.js";

const LAYERS = [
  { key: 0, factor: 0.08, alpha: 0.5, depth: -10 },
  { key: 1, factor: 0.2, alpha: 0.6, depth: -9 },
  { key: 2, factor: 0.42, alpha: 0.7, depth: -8 },
];

// Oversized so camera zoom (1.5x) and any window size stay covered.
const LAYER_W = 3200;
const LAYER_H = 2200;

export class BackgroundSystem {
  constructor(scene) {
    this.scene = scene;
    this.layers = [];
  }

  create() {
    this.layers = LAYERS.map((cfg) =>
      this.scene.add.tileSprite(0, 0, LAYER_W, LAYER_H, TextureFactory.STARFIELD_KEYS[cfg.key])
        .setAlpha(cfg.alpha)
        .setDepth(cfg.depth)
    );
  }

  update() {
    const cam = this.scene.cameras.main;
    const cx = cam.worldView.centerX;
    const cy = cam.worldView.centerY;
    this.layers.forEach((layer, i) => {
      layer.setPosition(cx, cy);
      layer.setTilePosition(cam.scrollX * LAYERS[i].factor, cam.scrollY * LAYERS[i].factor);
    });
  }

  destroy() {
    this.layers.forEach((l) => l.destroy());
    this.layers = [];
  }
}

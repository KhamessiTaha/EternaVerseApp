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
    this.quality = 'high';
  }

  create(quality = 'high') {
    this.quality = quality;
    this.layers = LAYERS.map((cfg) => {
      const layer = this.scene.add.tileSprite(0, 0, LAYER_W, LAYER_H, TextureFactory.STARFIELD_KEYS[cfg.key])
        .setAlpha(cfg.alpha)
        .setDepth(cfg.depth);

      if (quality !== 'low') {
        // Slow asynchronous breathing per layer - reads as starfield twinkle
        // without per-star cost. Different periods keep the layers out of
        // phase so the whole sky never pulses in unison.
        this.scene.tweens.add({
          targets: layer,
          alpha: { from: cfg.alpha * 0.75, to: cfg.alpha },
          duration: 2600 + cfg.key * 1400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      return layer;
    });
    this.configureQuality(quality);
  }

  update() {
    const cam = this.scene.cameras.main;
    const cx = cam.worldView.centerX;
    const cy = cam.worldView.centerY;
    this.layers.forEach((layer, i) => {
      layer.setPosition(cx, cy);
      if (this.quality === 'low') {
        layer.setTilePosition(cam.scrollX * LAYERS[i].factor * 0.7, cam.scrollY * LAYERS[i].factor * 0.7);
      } else {
        layer.setTilePosition(cam.scrollX * LAYERS[i].factor, cam.scrollY * LAYERS[i].factor);
      }
    });
  }

  configureQuality(quality = 'high') {
    this.quality = quality;
    this.layers.forEach((layer, i) => {
      if (quality === 'low') {
        layer.setAlpha(LAYERS[i].alpha * 0.55);
        layer.setVisible(i === 0);
      } else if (quality === 'medium') {
        layer.setAlpha(LAYERS[i].alpha * 0.8);
        layer.setVisible(i !== 2);
      } else {
        layer.setAlpha(LAYERS[i].alpha);
        layer.setVisible(true);
      }
    });
  }

  destroy() {
    this.layers.forEach((l) => {
      this.scene.tweens.killTweensOf(l);
      l.destroy();
    });
    this.layers = [];
  }
}

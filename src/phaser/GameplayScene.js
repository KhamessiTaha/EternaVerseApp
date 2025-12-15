import Phaser from "phaser";
import seedrandom from "seedrandom";

export default class GameplayScene extends Phaser.Scene {
  constructor() {
    super("GameplayScene");
    this.galaxies = [];
  }

  init(data) {
    this.universe = data.universe;
    this.rng = seedrandom(this.universe.seed);
  }

  preload() {
    // Load assets here if needed (e.g. player sprite, galaxy image)
  }

  create() {
    // Setup background
    this.cameras.main.setBackgroundColor("#000");

    // Create player (simple white circle for now)
    this.player = this.add.circle(400, 300, 8, 0xffffff);
    this.cameras.main.startFollow(this.player);

    // Create galaxies procedurally
    for (let i = 0; i < 200; i++) {
      const x = this.rng() * 8000 - 4000;
      const y = this.rng() * 8000 - 4000;
      const radius = this.rng() * 5 + 2;
      const color = Phaser.Display.Color.HSLToColor(this.rng(), 0.8, 0.6).color;
      const galaxy = this.add.circle(x, y, radius, color).setAlpha(0.9);
      this.galaxies.push(galaxy);
    }

    // Movement keys
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
  }

  update() {
    const speed = 200;
    const delta = this.game.loop.delta / 1000;

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.player.x -= speed * delta;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.player.x += speed * delta;
    }
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.player.y -= speed * delta;
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.player.y += speed * delta;
    }
  }
}

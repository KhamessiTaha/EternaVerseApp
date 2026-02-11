/**
 * Base class for mini-game scenes
 *
 * Mini-games are Phaser scenes that handle interactive gameplay.
 * Extend this class to create new mini-games.
 */

export class MiniGameScene extends Phaser.Scene {
  constructor(sceneKey) {
    super({ key: sceneKey });
    this.anomaly = null;
    this.universeScene = null;
  }

  /**
   * Initialize scene with anomaly data
   */
  init(data) {
    this.anomaly = data.anomaly;
  }

  /**
   * Create is called when scene starts
   * Override in subclasses to set up game UI and objects
   */
  create() {
    // Get reference to main UniverseScene
    this.universeScene = this.scene.get('UniverseScene');

    // Add ESC key listener to abort game
    this.input.keyboard.on('keydown-ESC', () => {
      this.abortGame();
    });
  }

  /**
   * Update is called every frame
   * Override in subclasses for game logic
   */
  update(time, delta) {
    // Override in subclasses
  }

  /**
   * Complete the minigame with a result
   * This will emit the result to UniverseScene and switch back
   */
  completeGame(result) {
    if (!this.universeScene) {
      console.error('UniverseScene reference not found');
      return;
    }

    console.log(`[MiniGameScene] Completing game with result:`, result);

    // Emit result event that UniverseScene will listen for
    this.universeScene.events.emit('minigame:complete', {
      anomaly: this.anomaly,
      result: result
    });

    // Stop this minigame scene and resume UniverseScene
    this.scene.stop();
    this.scene.resume('UniverseScene');
  }

  /**
   * Abort the minigame (ESC key or close button)
   */
  abortGame() {
    if (this.universeScene) {
      this.universeScene.events.emit('minigame:abort', {
        anomaly: this.anomaly
      });
    }

    // Stop this minigame scene and resume UniverseScene
    this.scene.stop();
    this.scene.resume('UniverseScene');
  }

  /**
   * Utility: Create a styled text in the center of canvas
   */
  createCenteredText(text, y, style = {}) {
    const defaultStyle = {
      font: 'bold 32px Arial',
      fill: '#00ffff',
      align: 'center',
      ...style
    };

    return this.add.text(
      this.cameras.main.width / 2,
      y,
      text,
      defaultStyle
    ).setOrigin(0.5);
  }

  /**
   * Utility: Create a styled button
   */
  createButton(x, y, text, callback) {
    const button = this.add.rectangle(x, y, 200, 50, 0x00aa00);
    button.setInteractive();
    button.on('pointerdown', callback);

    const buttonText = this.add.text(x, y, text, {
      font: 'bold 20px Arial',
      fill: '#000000',
      align: 'center'
    }).setOrigin(0.5);

    return { button, buttonText };
  }
}

export default MiniGameScene;

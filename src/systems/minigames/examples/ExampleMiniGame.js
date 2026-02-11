/**
 * Mini-Game Template/Example
 *
 * This is a skeleton template showing how to create a mini-game.
 * Copy this file and implement the abstract methods.
 *
 * Key points:
 * - Extend MiniGame base class
 * - Implement all abstract methods
 * - Provide a React component for rendering
 * - Don't couple to anomalies - keep it generic
 * - Use complete() to finish and return results
 */

import MiniGame from './MiniGame.js';
import { MiniGameResult } from './MiniGameConstants.js';

/**
 * STEP 1: Create your game class
 */
export class ExampleMiniGame extends MiniGame {
  /**
   * Game identifier (must be unique)
   */
  get id() {
    return 'example-game';
  }

  /**
   * Human-readable name
   */
  get name() {
    return 'Example Mini-Game';
  }

  /**
   * Description/instructions
   */
  get description() {
    return 'This is an example mini-game template. Replace this with your game.';
  }

  /**
   * React component that renders this game
   * Will receive props: { gameState, onComplete, onProgress, config, gameInstance }
   */
  get Component() {
    return ExampleGameUI;
  }

  /**
   * REQUIRED: Initialize game (load assets, setup, etc.)
   */
  async initialize() {
    console.log('Example game initializing...');

    // Simulate async setup (e.g., loading images, sounds)
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('Example game ready!');
        resolve();
      }, 500);
    });
  }

  /**
   * OPTIONAL: Called every frame (deltaTime in ms)
   * Good for animations, state updates, physics, etc.
   */
  update(deltaTime) {
    // Example: Update game state based on time
    // This is called at ~60fps during game
  }

  /**
   * REQUIRED: Handle game completion
   * This is called by your React component via gameInstance.complete()
   */
  onGameComplete(payload) {
    // payload = { score, accuracy, bonus, ... }
    console.log('Example game completed with payload:', payload);
  }

  /**
   * OPTIONAL: Cleanup resources
   */
  async destroy() {
    console.log('Example game cleaning up...');
    // Cleanup resources, cancel animations, etc.
  }
}

/**
 * STEP 2: Create your React UI component
 *
 * This component receives game instance via context/props
 * and communicates back via gameInstance.complete()
 */
function ExampleGameUI({ gameInstance, gameState }) {
  if (!gameInstance) return <div>Loading game...</div>;

  const handleComplete = () => {
    // Pass result data and completion status
    gameInstance.complete(
      {
        score: 100,
        accuracy: 95,
        bonus: 50
      },
      'success' // or 'partial', 'failed', 'abandoned'
    );
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 rounded-lg p-8">
      <h1 className="text-white text-3xl font-bold mb-4">
        Example Mini-Game
      </h1>

      <p className="text-gray-300 mb-8 text-center">
        This is a template. Replace with your actual game UI.
      </p>

      <div className="text-white mb-8">
        <p>Game State: {gameState}</p>
        <p>Elapsed Time: {gameInstance.getElapsedTime()}ms</p>
      </div>

      <button
        onClick={handleComplete}
        className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition"
      >
        Complete Game
      </button>

      <button
        onClick={() => gameInstance.abort()}
        className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition"
      >
        Abort
      </button>
    </div>
  );
}

export default ExampleMiniGame;

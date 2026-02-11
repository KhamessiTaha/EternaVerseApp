/**
 * Mini-Game Testing Utilities
 *
 * Helpers for testing mini-games without React/Phaser
 * Use for unit tests, debugging, and prototyping
 */

import { MiniGameManager } from './MiniGameManager.js';
import { MiniGameState } from './MiniGameConstants.js';

/**
 * Create a test harness for a mini-game
 * @param {Class} GameClass - Mini-game class to test
 * @param {Object} config - Game config
 * @param {Object} context - Game context
 * @returns {Object} Test harness with utilities
 */
export async function createMiniGameTestHarness(
  GameClass,
  config = {},
  context = {}
) {
  const game = new GameClass(config, context);
  const events = [];
  const stateChanges = [];

  // Track all events
  game.on('minigame:started', (data) => events.push({ type: 'started', data }));
  game.on('minigame:updated', (data) => events.push({ type: 'updated', data }));
  game.on('minigame:progressed', (data) => events.push({ type: 'progressed', data }));
  game.on('minigame:completed', (data) => events.push({ type: 'completed', data }));
  game.on('minigame:state_changed', (data) => {
    stateChanges.push(data);
    events.push({ type: 'state_changed', data });
  });

  // Start the game
  await game.start();

  return {
    game,
    events,
    stateChanges,

    /**
     * Simulate time passing
     */
    tick(deltaTime = 16) {
      game.tick(deltaTime);
    },

    /**
     * Simulate multiple frames
     */
    tickFrames(count = 1, deltaTime = 16) {
      for (let i = 0; i < count; i++) {
        this.tick(deltaTime);
      }
    },

    /**
     * Simulate time passing (in seconds)
     */
    advanceTime(seconds) {
      this.tickFrames(Math.ceil(seconds * 1000 / 16), 16);
    },

    /**
     * Get events of specific type
     */
    getEvents(type) {
      return events.filter(e => e.type === type);
    },

    /**
     * Assert game state
     */
    assertState(expectedState) {
      const actual = game.getState();
      if (actual !== expectedState) {
        throw new Error(
          `Expected state ${expectedState}, got ${actual}`
        );
      }
    },

    /**
     * Assert game has completed with status
     */
    assertCompleted(expectedType) {
      this.assertState(MiniGameState.COMPLETED);

      const result = game.getResult();
      if (result.resultType !== expectedType) {
        throw new Error(
          `Expected completion type ${expectedType}, got ${result.resultType}`
        );
      }
    },

    /**
     * Assert payload contains values
     */
    assertPayload(expectedValues) {
      const result = game.getResult();
      Object.entries(expectedValues).forEach(([key, value]) => {
        if (result.payload[key] !== value) {
          throw new Error(
            `Expected payload.${key} = ${value}, got ${result.payload[key]}`
          );
        }
      });
    },

    /**
     * Get the final result
     */
    getResult() {
      return game.getResult();
    },

    /**
     * Log all events (for debugging)
     */
    logEvents() {
      console.group('Mini-game Events');
      events.forEach((e, i) => {
        console.log(`${i}. ${e.type}`, e.data);
      });
      console.groupEnd();
    },

    /**
     * Cleanup
     */
    async destroy() {
      await game.cleanup();
    }
  };
}

/**
 * Test a mini-game flow
 */
export async function testMiniGameFlow(GameClass, config, context) {
  const harness = await createMiniGameTestHarness(GameClass, config, context);

  try {
    // Game should start in RUNNING state
    harness.assertState(MiniGameState.RUNNING);

    // Should emit started event
    const startedEvents = harness.getEvents('started');
    if (startedEvents.length === 0) {
      throw new Error('No started event emitted');
    }

    return harness;
  } catch (error) {
    await harness.destroy();
    throw error;
  }
}

/**
 * Benchmark mini-game performance
 */
export async function benchmarkMiniGame(GameClass, config, duration = 5000) {
  const harness = await createMiniGameTestHarness(GameClass, config);
  const startTime = performance.now();
  let frameCount = 0;

  while (performance.now() - startTime < duration) {
    harness.tick(16);
    frameCount++;
  }

  await harness.destroy();

  const elapsed = performance.now() - startTime;
  const fps = (frameCount / (elapsed / 1000)).toFixed(1);

  return {
    frameCount,
    elapsedMs: elapsed.toFixed(2),
    averageFPS: fps
  };
}

/**
 * Test result handler processing
 */
export async function testResultHandler(resultHandler, mockResult) {
  const manager = new MiniGameManager();

  // Register handler
  manager.registerResultHandler('success', resultHandler);

  // Simulate game completion
  const result = {
    gameId: 'test-game',
    gameName: 'Test Game',
    resultType: 'success',
    timestamp: Date.now(),
    duration: 5000,
    config: { difficulty: 'normal' },
    payload: mockResult || { score: 100 },
    difficulty: 'normal',
    scoreMultiplier: 1.0
  };

  try {
    const impact = resultHandler(result);

    return {
      success: true,
      input: result,
      output: impact,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      input: result,
      output: null,
      error: error.message
    };
  }
}

export default {
  createMiniGameTestHarness,
  testMiniGameFlow,
  benchmarkMiniGame,
  testResultHandler
};

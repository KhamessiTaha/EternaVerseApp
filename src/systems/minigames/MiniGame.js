/**
 * MiniGame Abstract Base Class
 *
 * All mini-games MUST extend this class and implement required methods.
 * This ensures consistent API across all mini-games and prevents tight coupling.
 *
 * Usage:
 * class MyGame extends MiniGame {
 *   get id() { return 'my-game'; }
 *   get name() { return 'My Awesome Game'; }
 *   // ... implement required methods
 * }
 */

import {
  MiniGameState,
  MiniGameError,
  DEFAULT_MINIGAME_CONFIG,
  MiniGameEvent
} from './MiniGameConstants.js';

export class MiniGame {
  /**
   * Initialize mini-game instance
   * @param {Object} config - Game-specific configuration
   * @param {Object} context - Shared context (not anomaly-specific)
   */
  constructor(config = {}, context = {}) {
    // Merge with defaults
    this.config = { ...DEFAULT_MINIGAME_CONFIG, ...config };
    this.context = context;

    // Internal state
    this._state = MiniGameState.IDLE;
    this._startTime = null;
    this._elapsedTime = 0;
    this._eventListeners = new Map();
    this._result = null;

    this._validateConfig();
  }

  /**
   * ABSTRACT - Game identifier
   * Must be unique across all mini-games
   * @returns {string} 'memory-puzzle', 'pattern-match', etc.
   */
  get id() {
    throw new Error('MiniGame.id must be implemented');
  }

  /**
   * ABSTRACT - Human-readable game name
   * @returns {string}
   */
  get name() {
    throw new Error('MiniGame.name must be implemented');
  }

  /**
   * ABSTRACT - Game description/instructions
   * @returns {string}
   */
  get description() {
    throw new Error('MiniGame.description must be implemented');
  }

  /**
   * ABSTRACT - React component that renders this game
   * Should accept props: { gameState, onComplete, onProgress, config }
   * @returns {React.Component}
   */
  get Component() {
    throw new Error('MiniGame.Component must be implemented');
  }

  /**
   * REQUIRED - Initialize game (load assets, setup)
   * Called once before game starts
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('MiniGame.initialize() must be implemented');
  }

  /**
   * OPTIONAL - Called every frame/tick
   * Use for animations, state updates, etc.
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    // Optional - override if needed
  }

  /**
   * REQUIRED - Called when game completes
   * Must call this.complete() with result
   * @param {Object} payload - Game result data
   */
  onGameComplete(payload) {
    throw new Error('MiniGame.onGameComplete() must be implemented');
  }

  /**
   * OPTIONAL - Cleanup resources
   * Called after result is processed
   */
  destroy() {
    // Optional - override if needed
  }

  // ============================================================
  // LIFECYCLE MANAGEMENT (Called by MiniGameManager)
  // ============================================================

  /**
   * Start the mini-game
   * Called by MiniGameManager - DO NOT OVERRIDE
   */
  async start() {
    if (this._state !== MiniGameState.IDLE) {
      throw new Error(`Cannot start: game is ${this._state}`);
    }

    try {
      this._setState(MiniGameState.INITIALIZING);

      // Call user's initialize method
      await this.initialize();

      this._state = MiniGameState.RUNNING;
      this._startTime = Date.now();
      this._elapsedTime = 0;

      this._emit(MiniGameEvent.STARTED, {
        gameId: this.id,
        timestamp: this._startTime
      });
    } catch (error) {
      this._state = MiniGameState.IDLE;
      throw new Error(`${this.id} initialization failed: ${error.message}`);
    }
  }

  /**
   * Update game state
   * Called by MiniGameManager - DO NOT OVERRIDE
   */
  tick(deltaTime) {
    if (this._state !== MiniGameState.RUNNING && this._state !== MiniGameState.PAUSED) {
      return;
    }

    if (this._state === MiniGameState.RUNNING) {
      this._elapsedTime += deltaTime;

      // Call user's update method
      this.update(deltaTime);

      // Check time limit
      if (
        this.config.timeLimit &&
        this._elapsedTime >= this.config.timeLimit
      ) {
        this.complete(
          {
            status: 'timeout',
            timeExpired: true
          },
          'timeout'
        );
      }
    }
  }

  /**
   * Complete the game with result
   * Called by mini-game implementation - DO NOT OVERRIDE SIGNATURE
   * @param {Object} payload - Result data { score, accuracy, bonus, etc. }
   * @param {string} resultType - 'success', 'partial', 'failed', 'abandoned'
   */
  complete(payload, resultType) {
    if (this._state === MiniGameState.DESTROYED) {
      console.warn(`${this.id}: Cannot complete destroyed game`);
      return;
    }

    this._setState(MiniGameState.COMPLETING);

    try {
      // Build result object
      this._result = {
        gameId: this.id,
        gameName: this.name,
        resultType,
        timestamp: Date.now(),
        duration: this._elapsedTime,
        config: { ...this.config },
        payload,
        difficulty: this.config.difficulty
      };

      // Calculate score multiplier based on difficulty
      this._result.scoreMultiplier = this._getDifficultyMultiplier();

      // Call game's completion handler
      this.onGameComplete(payload);

      this._setState(MiniGameState.COMPLETED);

      this._emit(MiniGameEvent.COMPLETED, this._result);
    } catch (error) {
      console.error(`${this.id} completion error:`, error);
      this._setState(MiniGameState.IDLE);
      throw error;
    }
  }

  /**
   * Cleanup resources
   * Called by MiniGameManager - DO NOT OVERRIDE
   */
  async cleanup() {
    this._setState(MiniGameState.DESTROYING);

    try {
      // Call user's destroy method
      if (this.destroy && typeof this.destroy === 'function') {
        await this.destroy();
      }

      // Clear event listeners
      this._eventListeners.clear();

      this._setState(MiniGameState.DESTROYED);
    } catch (error) {
      console.error(`${this.id} cleanup error:`, error);
    }
  }

  // ============================================================
  // GAME CONTROL (Can be called by React component)
  // ============================================================

  /**
   * Pause the game
   */
  pause() {
    if (this._state === MiniGameState.RUNNING && this.config.allowPause) {
      this._setState(MiniGameState.PAUSED);
      this._emit(MiniGameEvent.PAUSED, { elapsedTime: this._elapsedTime });
    }
  }

  /**
   * Resume the game
   */
  resume() {
    if (this._state === MiniGameState.PAUSED && this.config.allowPause) {
      this._setState(MiniGameState.RUNNING);
      this._emit(MiniGameEvent.RESUMED, { elapsedTime: this._elapsedTime });
    }
  }

  /**
   * Abort the game
   */
  abort() {
    if (this.config.allowAbort && this._state !== MiniGameState.COMPLETED) {
      this.complete(
        { reason: 'user_abort' },
        'abandoned'
      );
    }
  }

  // ============================================================
  // EVENT SYSTEM
  // ============================================================

  /**
   * Listen to game events
   * @param {string} eventType - MiniGameEvent.*
   * @param {Function} callback
   */
  on(eventType, callback) {
    if (!this._eventListeners.has(eventType)) {
      this._eventListeners.set(eventType, []);
    }
    this._eventListeners.get(eventType).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this._eventListeners.get(eventType);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event (internal use)
   * @private
   */
  _emit(eventType, data) {
    const listeners = this._eventListeners.get(eventType) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${this.id} event listener:`, error);
      }
    });
  }

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================

  /**
   * Get current game state
   * @returns {string} MiniGameState.*
   */
  getState() {
    return this._state;
  }

  /**
   * Get game result (null if not completed)
   * @returns {Object|null}
   */
  getResult() {
    return this._result;
  }

  /**
   * Get elapsed time in ms
   * @returns {number}
   */
  getElapsedTime() {
    return this._elapsedTime;
  }

  /**
   * Get time remaining in ms (or null if no limit)
   * @returns {number|null}
   */
  getTimeRemaining() {
    if (!this.config.timeLimit) return null;
    return Math.max(0, this.config.timeLimit - this._elapsedTime);
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  /**
   * Set internal state and emit event
   * @private
   */
  _setState(newState) {
    const oldState = this._state;
    this._state = newState;
    this._emit(MiniGameEvent.STATE_CHANGED, { oldState, newState });
  }

  /**
   * Get score multiplier based on difficulty
   * @private
   */
  _getDifficultyMultiplier() {
    const multipliers = {
      'easy': 0.5,
      'normal': 1.0,
      'hard': 1.5,
      'extreme': 2.0
    };
    return multipliers[this.config.difficulty] || 1.0;
  }

  /**
   * Validate config
   * @private
   */
  _validateConfig() {
    if (this.config.timeLimit !== null && this.config.timeLimit <= 0) {
      throw new Error('timeLimit must be positive');
    }

    const validDifficulties = ['easy', 'normal', 'hard', 'extreme'];
    if (!validDifficulties.includes(this.config.difficulty)) {
      throw new Error(`Invalid difficulty: ${this.config.difficulty}`);
    }
  }

  /**
   * Debug helper - log current state
   */
  logState() {
    console.log(`[${this.id}] State: ${this._state}, Time: ${this._elapsedTime}ms`, {
      config: this.config,
      result: this._result
    });
  }
}

export default MiniGame;

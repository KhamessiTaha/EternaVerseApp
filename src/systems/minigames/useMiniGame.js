/**
 * useMiniGame Hook
 *
 * React hook for managing mini-game lifecycle in components.
 * Handles state management, event listening, and cleanup.
 *
 * Usage:
 * const { gameInstance, isRunning, result, error, start } = useMiniGame(manager);
 *
 * Then in your component:
 * <button onClick={() => start('my-game', { difficulty: 'hard' })}>
 *   Start Game
 * </button>
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MiniGameState, MiniGameEvent } from './MiniGameConstants.js';

export const useMiniGame = (miniGameManager) => {
  // Game instance and state
  const [gameInstance, setGameInstance] = useState(null);
  const [gameState, setGameState] = useState(MiniGameState.IDLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Refs for tracking
  const unsubscribesRef = useRef([]);
  const animationFrameRef = useRef(null);

  if (!miniGameManager) {
    throw new Error('useMiniGame requires a MiniGameManager instance');
  }

  /**
   * Setup event listeners for game instance
   */
  const setupGameListeners = useCallback((game) => {
    const unsubscribes = [];

    // Track state changes
    unsubscribes.push(
      game.on(MiniGameEvent.STATE_CHANGED, ({ oldState, newState }) => {
        setGameState(newState);
      })
    );

    // Track progress
    unsubscribes.push(
      game.on(MiniGameEvent.PROGRESSED, (progress) => {
        setElapsedTime(game.getElapsedTime());
        setTimeRemaining(game.getTimeRemaining());
      })
    );

    // Track completion
    unsubscribes.push(
      game.on(MiniGameEvent.COMPLETED, (gameResult) => {
        setResult(gameResult);
        setGameState(MiniGameState.COMPLETED);
      })
    );

    // Update time regularly
    const updateTimer = setInterval(() => {
      if (game.getState() === MiniGameState.RUNNING) {
        setElapsedTime(game.getElapsedTime());
        setTimeRemaining(game.getTimeRemaining());
      }
    }, 100);

    unsubscribes.push(() => clearInterval(updateTimer));

    unsubscribesRef.current = unsubscribes;
  }, []);

  /**
   * Start a mini-game
   */
  const start = useCallback(
    async (gameId, gameConfig = {}, context = {}) => {
      setError(null);
      setResult(null);
      setElapsedTime(0);
      setTimeRemaining(null);

      try {
        const game = await miniGameManager.start(gameId, gameConfig, context);
        setGameInstance(game);
        setupGameListeners(game);
      } catch (err) {
        setError(err.message);
        setGameState(MiniGameState.IDLE);
      }
    },
    [miniGameManager, setupGameListeners]
  );

  /**
   * Stop/abort the game
   */
  const stop = useCallback(async () => {
    if (gameInstance) {
      gameInstance.abort();
      await miniGameManager.stop();
      setGameInstance(null);
      setGameState(MiniGameState.IDLE);
    }
  }, [gameInstance, miniGameManager]);

  /**
   * Pause the game
   */
  const pause = useCallback(() => {
    gameInstance?.pause();
  }, [gameInstance]);

  /**
   * Resume the game
   */
  const resume = useCallback(() => {
    gameInstance?.resume();
  }, [gameInstance]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      unsubscribesRef.current.forEach(unsub => unsub());
      if (gameInstance) {
        miniGameManager.stop();
      }
    };
  }, [gameInstance, miniGameManager]);

  // Derive computed values
  const isRunning = gameState === MiniGameState.RUNNING;
  const isPaused = gameState === MiniGameState.PAUSED;
  const isComplete = gameState === MiniGameState.COMPLETED;
  const isInitializing = gameState === MiniGameState.INITIALIZING;

  return {
    // State
    gameInstance,
    gameState,
    result,
    error,
    elapsedTime,
    timeRemaining,

    // Computed
    isRunning,
    isPaused,
    isComplete,
    isInitializing,

    // Controls
    start,
    stop,
    pause,
    resume
  };
};

export default useMiniGame;

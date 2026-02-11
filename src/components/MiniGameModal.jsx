/**
 * Mini-Game Modal Component
 *
 * Displays the mini-game in a modal overlay.
 * Handles game lifecycle, state, and result processing.
 */

import { useState, useEffect, useRef } from 'react';
import { useMiniGame } from '../systems/minigames/useMiniGame.js';
import { MiniGameState } from '../systems/minigames/MiniGameConstants.js';

export default function MiniGameModal({
  isOpen,
  miniGameManager,
  gameId,
  anomaly,
  onComplete,
  onAbort
}) {
  const {
    gameInstance,
    gameState,
    result,
    error,
    isRunning,
    isComplete,
    start,
    stop
  } = useMiniGame(miniGameManager);

  const [showResult, setShowResult] = useState(false);
  const startedRef = useRef(false);

  // Auto-start game when modal opens
  useEffect(() => {
    if (isOpen && gameId && !startedRef.current) {
      startedRef.current = true;
      startGame();
    }

    return () => {
      if (!isOpen) {
        startedRef.current = false;
      }
    };
  }, [isOpen, gameId]);

  // Handle completion (auto-close after showing result)
  useEffect(() => {
    if (isComplete && result && !showResult) {
      setShowResult(true);

      // Emit result to parent
      onComplete(result);

      // Auto-close after delay
      setTimeout(() => {
        handleClose();
      }, 2000);
    }
  }, [isComplete, result, showResult, onComplete]);

  const startGame = async () => {
    if (!gameId || !anomaly || !miniGameManager) return;

    try {
      // Calculate difficulty from anomaly severity
      const difficulty = getDifficultyFromSeverity(anomaly.severity);

      await start(
        gameId,
        { difficulty },
        {
          anomalyType: anomaly.type,
          anomalySeverity: anomaly.severity,
          anomalyId: anomaly.id
        }
      );
    } catch (err) {
      console.error('Failed to start mini-game:', err);
    }
  };

  const handleClose = () => {
    startedRef.current = false;
    stop();
    onAbort();
  };

  function getDifficultyFromSeverity(severity) {
    if (severity >= 0.8) return 'extreme';
    if (severity >= 0.6) return 'hard';
    if (severity >= 0.4) return 'normal';
    return 'easy';
  }

  if (!isOpen) return null;

  // Loading state
  if (!gameInstance || gameState === MiniGameState.INITIALIZING) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading mini-game...</div>
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-red-500 rounded-lg p-8 max-w-md text-center">
          <h2 className="text-red-400 text-xl font-bold mb-4">Game Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Game running
  if (isRunning || (showResult && !gameInstance)) {
    const GameComponent = gameInstance?.Component;

    if (!GameComponent) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="relative w-full max-w-3xl max-h-[90vh] bg-gray-900 rounded-lg border-2 border-cyan-500 overflow-hidden shadow-2xl">
          {/* Game UI */}
          <GameComponent gameInstance={gameInstance} gameState={gameState} />

          {/* Header with title and controls */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 flex justify-between items-center">
            <div className="text-white font-bold text-lg">
              {gameInstance?.name || 'Mini-Game'}
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all"
              title="Exit game"
            >
              Exit (ESC)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

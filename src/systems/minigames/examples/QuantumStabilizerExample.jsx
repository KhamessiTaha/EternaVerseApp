/**
 * Quantum Stabilizer Integration Example
 *
 * Shows how to integrate the Quantum Stabilizer mini-game
 * into your React application.
 *
 * This example demonstrates:
 * - Starting a game
 * - Handling results
 * - Processing impact data
 * - Resolving anomalies
 */

import { useState, useRef } from 'react';
import useMiniGame from '../useMiniGame.js';
import { getMiniGameManager } from '../MiniGameRegistry.js';

/**
 * Example: Quantum Stabilizer Handler Component
 *
 * This component wraps the mini-game and handles:
 * - Game lifecycle
 * - Result processing
 * - Anomaly resolution
 */
export function QuantumStabilizerExample() {
  const managerRef = useRef(getMiniGameManager());
  const [isOpen, setIsOpen] = useState(false);
  const [anomaly, setAnomaly] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const {
    gameInstance,
    gameState,
    result,
    error,
    isRunning,
    isComplete,
    start,
    stop
  } = useMiniGame(managerRef.current);

  // Start game when modal opens
  const handleStartGame = async (selectedAnomaly) => {
    setAnomaly(selectedAnomaly);
    setIsOpen(true);

    // Calculate difficulty based on anomaly severity
    const difficulty = selectedAnomaly.severity >= 0.8 ? 'extreme'
      : selectedAnomaly.severity >= 0.6 ? 'hard'
      : selectedAnomaly.severity >= 0.4 ? 'normal'
      : 'easy';

    try {
      await start('quantum-stabilizer', {
        difficulty,
        timeLimit: null  // No time limit for quantum stabilizer
      }, {
        anomalyType: selectedAnomaly.type,
        anomalySeverity: selectedAnomaly.severity
      });
    } catch (err) {
      console.error('Failed to start game:', err);
    }
  };

  // Handle game completion
  const handleGameComplete = async () => {
    if (!result || !anomaly) return;

    setLastResult(result);
    console.log('Game result:', result);

    // If game was successful, process the result
    if (result.impact && result.impact.anomalyResolved) {
      try {
        // Call your backend to resolve the anomaly
        await resolveAnomalyOnBackend(anomaly.id, result);

        // Show success message
        console.log('✓ Anomaly resolved!');
      } catch (error) {
        console.error('Failed to resolve anomaly:', error);
      }
    }

    // Close after showing result (UI handles delay)
    setTimeout(() => {
      setIsOpen(false);
      stop();
    }, 2000);
  };

  // Detect when game completes
  if (isComplete && result && result.impact && !lastResult) {
    handleGameComplete();
  }

  return (
    <div className="flex gap-4">
      {/* Test Button */}
      <button
        onClick={() => handleStartGame({
          id: 'anomaly-1',
          type: 'quantum_fluctuation',
          severity: 0.7,
          name: 'Quantum Fluctuation'
        })}
        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-semibold"
      >
        Test Quantum Stabilizer
      </button>

      {/* Game Modal */}
      {isOpen && (
        <GameModal
          gameInstance={gameInstance}
          gameState={gameState}
          error={error}
          isRunning={isRunning}
          isComplete={isComplete}
          result={result}
          onClose={() => {
            setIsOpen(false);
            stop();
          }}
        />
      )}

      {/* Last Result Display */}
      {lastResult && (
        <div className="mt-4 p-4 bg-gray-800 rounded border border-cyan-500">
          <p className="text-white">Last Result: {lastResult.impact.message}</p>
          <p className="text-gray-400 text-sm">Score: {lastResult.payload.score}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Game Modal Component
 *
 * Displays the game UI and manages the game experience
 */
function GameModal({
  gameInstance,
  gameState,
  error,
  isRunning,
  isComplete,
  result,
  onClose
}) {
  if (!gameInstance) return null;

  // Loading state
  if (!isRunning && !isComplete && !error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-white text-xl">Loading mini-game...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-8 rounded border border-red-500 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Game running
  if (isRunning) {
    const GameUI = gameInstance.Component;
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="relative w-full max-w-3xl max-h-[90vh] bg-gray-900 rounded-lg border-2 border-cyan-500 overflow-hidden">
          <GameUI gameInstance={gameInstance} gameState={gameState} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
          >
            Exit
          </button>
        </div>
      </div>
    );
  }

  // Game complete (showing result)
  if (isComplete && result) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="relative w-full max-w-3xl max-h-[90vh] bg-gray-900 rounded-lg border-2 border-cyan-500 overflow-hidden">
          <GameUI gameInstance={gameInstance} gameState={gameState} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Placeholder for backend anomaly resolution
 * Replace with your actual API call
 */
async function resolveAnomalyOnBackend(anomalyId, result) {
  // TODO: Replace with actual API endpoint
  const token = localStorage.getItem('token');

  const response = await fetch('/api/universe/resolve-anomaly', {
    method: 'POST',
    headers: {
      'Authorization': token || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      anomalyId,
      miniGameScore: result.payload.score,
      miniGameId: result.gameId,
      accuracy: result.payload.accuracy
    })
  });

  if (!response.ok) {
    throw new Error('Failed to resolve anomaly');
  }

  return response.json();
}

export default QuantumStabilizerExample;

/**
 * Quantum Stabilizer Mini-Game
 *
 * A timed precision game where the player must hit a moving indicator
 * within a target zone using the SPACE key.
 *
 * Gameplay:
 * - Indicator oscillates left-right across a horizontal track
 * - Target zone appears at a fixed location
 * - Player presses SPACE to attempt stabilization
 * - Win: 5 successful hits before 3 failures
 * - Speed scales with anomaly severity
 *
 * Success Conditions:
 * - Indicator position is within the zone bounds when SPACE is pressed
 * - Must reach 5 hits before accumulating 3 misses
 */

import MiniGame from '../MiniGame.js';
import { MiniGameResult } from '../MiniGameConstants.js';

export class QuantumStabilizer extends MiniGame {
  get id() {
    return 'quantum-stabilizer';
  }

  get name() {
    return 'Quantum Stabilizer';
  }

  get description() {
    return 'Press SPACE to stabilize the quantum fluctuation within the target zone.';
  }

  get Component() {
    return QuantumStabilizerUI;
  }

  constructor(config = {}, context = {}) {
    super(config, context);

    // Game state
    this.indicatorPosition = 0;      // 0-100 (percentage across track)
    this.oscillationSpeed = 0;       // Pixels per frame
    this.oscillationDirection = 1;   // 1 or -1
    this.targetZoneStart = 35;       // Where target zone begins (%)
    this.targetZoneWidth = 30;       // Width of target zone (%)
    this.trackWidth = 100;           // Total track width (%)

    // Game counters
    this.successHits = 0;
    this.failures = 0;
    this.totalAttempts = 0;
    this.hits = [];                  // Track each attempt { success, position, accuracy }

    // Game settings
    this.targetSuccesses = 5;
    this.maxFailures = 3;
    this.isGameOver = false;

    // Listeners
    this.listeners = [];
    this.keyboardListener = null;
  }

  /**
   * Initialize game
   */
  async initialize() {
    console.log(`[Quantum Stabilizer] Initializing (difficulty: ${this.config.difficulty})`);

    // Calculate oscillation speed based on difficulty
    this.oscillationSpeed = this._calculateSpeed();

    // Position indicator randomly at start
    this.indicatorPosition = Math.random() * 100;
    this.oscillationDirection = Math.random() > 0.5 ? 1 : -1;

    // Generate random target zone location
    this._generateTargetZone();

    console.log(`[Quantum Stabilizer] Ready! Speed: ${this.oscillationSpeed}%/frame`);
  }

  /**
   * Update game state every frame
   */
  update(deltaTime) {
    if (this.isGameOver) return;

    // Oscillate the indicator position
    this.indicatorPosition += this.oscillationSpeed * this.oscillationDirection;

    // Bounce off edges
    if (this.indicatorPosition >= 100) {
      this.indicatorPosition = 100;
      this.oscillationDirection = -1;
    } else if (this.indicatorPosition <= 0) {
      this.indicatorPosition = 0;
      this.oscillationDirection = 1;
    }

    // Emit progress for UI updates
    this._emit('progress', {
      indicatorPosition: this.indicatorPosition,
      successHits: this.successHits,
      failures: this.failures
    });
  }

  /**
   * Handle spacebar press
   */
  attemptStabilization() {
    if (this.isGameOver) return;

    this.totalAttempts++;

    // Check if indicator is in target zone
    const isSuccess = this._checkHit();

    // Store attempt record
    this.hits.push({
      attempt: this.totalAttempts,
      success: isSuccess,
      position: this.indicatorPosition,
      targetStart: this.targetZoneStart,
      targetEnd: this.targetZoneStart + this.targetZoneWidth,
      accuracy: isSuccess ? this._calculateAccuracy() : 0
    });

    if (isSuccess) {
      this.successHits++;
      this._emit('hit', { accuracy: this._calculateAccuracy() });
    } else {
      this.failures++;
      this._emit('miss', { position: this.indicatorPosition });
    }

    // Check win/lose conditions
    if (this.successHits >= this.targetSuccesses) {
      this._gameWon();
    } else if (this.failures >= this.maxFailures) {
      this._gameLost();
    }
  }

  /**
   * Handle game completion
   */
  onGameComplete(payload) {
    console.log('QuantumStabilizer complete:', payload);
  }

  /**
   * Cleanup
   */
  destroy() {
    // Remove keyboard listener
    if (this.keyboardListener) {
      window.removeEventListener('keydown', this.keyboardListener);
      this.keyboardListener = null;
    }
    this.listeners = [];
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  /**
   * Check if current indicator position is within target zone
   */
  _checkHit() {
    const zoneEnd = this.targetZoneStart + this.targetZoneWidth;
    return (
      this.indicatorPosition >= this.targetZoneStart &&
      this.indicatorPosition <= zoneEnd
    );
  }

  /**
   * Calculate accuracy percentage (how centered in zone)
   */
  _calculateAccuracy() {
    const zoneCenter = this.targetZoneStart + this.targetZoneWidth / 2;
    const zoneRadius = this.targetZoneWidth / 2;

    const distanceFromCenter = Math.abs(this.indicatorPosition - zoneCenter);
    const accuracy = Math.max(0, 100 - (distanceFromCenter / zoneRadius) * 100);

    return Math.round(accuracy);
  }

  /**
   * Calculate oscillation speed based on difficulty
   */
  _calculateSpeed() {
    const speedFactors = {
      'easy': 0.4,
      'normal': 0.8,
      'hard': 1.4,
      'extreme': 2.0
    };

    const baseFactor = speedFactors[this.config.difficulty] || 0.8;

    // Additional scaling from context (anomaly severity)
    const severityMultiplier = this.context.anomalySeverity || 1;

    return baseFactor * severityMultiplier;
  }

  /**
   * Generate a random target zone location
   */
  _generateTargetZone() {
    // Ensure zone fits within track
    const maxStart = this.trackWidth - this.targetZoneWidth;
    this.targetZoneStart = Math.random() * maxStart;
  }

  /**
   * Player won!
   */
  _gameWon() {
    this.isGameOver = true;

    const result = this._calculateResult('success');
    this._emit('won', result);

    // Complete the game
    this.complete(result, MiniGameResult.SUCCESS);
  }

  /**
   * Player lost!
   */
  _gameLost() {
    this.isGameOver = true;

    const result = this._calculateResult('failed');
    this._emit('lost', result);

    // Complete the game
    this.complete(result, MiniGameResult.FAILED);
  }

  /**
   * Calculate final result object
   */
  _calculateResult(status) {
    // Calculate accuracy across all attempts
    const successfulHits = this.hits.filter(h => h.success);
    const avgAccuracy = successfulHits.length > 0
      ? Math.round(
          successfulHits.reduce((sum, h) => sum + h.accuracy, 0) / successfulHits.length
        )
      : 0;

    // Calculate score
    const hitBonus = this.successHits * 100;
    const accuracyBonus = Math.round(avgAccuracy * 10);
    const failurePenalty = this.failures * 50;
    const totalScore = Math.max(0, hitBonus + accuracyBonus - failurePenalty);

    return {
      status,
      successHits: this.successHits,
      failures: this.failures,
      totalAttempts: this.totalAttempts,
      accuracy: avgAccuracy,
      score: totalScore,
      timeTaken: this.getElapsedTime(),
      hits: this.hits
    };
  }

  /**
   * Event emitter
   */
  _emit(eventType, data) {
    this.listeners.forEach(listener => {
      if (listener.type === eventType) {
        try {
          listener.handler(data);
        } catch (error) {
          console.error(`Error in event listener:`, error);
        }
      }
    });
  }

  /**
   * Event listener registration
   */
  on(eventType, handler) {
    this.listeners.push({ type: eventType, handler });
  }
}

// ============================================================
// REACT UI COMPONENT
// ============================================================

import React, { useState, useEffect, useRef } from 'react';

export function QuantumStabilizerUI({ gameInstance, gameState }) {
  const [indicatorPos, setIndicatorPos] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [lastHitAccuracy, setLastHitAccuracy] = useState(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [result, setResult] = useState(null);
  const elapsedRef = useRef(0);

  if (!gameInstance) return <div className="w-full h-full flex items-center justify-center bg-gray-900">Loading...</div>;

  // Setup game listeners
  useEffect(() => {
    if (!gameInstance) return;

    // Track position updates
    const unsubProgress = gameInstance.listeners ? undefined : null;
    gameInstance.on('progress', ({ indicatorPosition, successHits, failures }) => {
      setIndicatorPos(indicatorPosition);
      setSuccessCount(successHits);
      setFailureCount(failures);
    });

    // Track hits
    gameInstance.on('hit', ({ accuracy }) => {
      setLastHitAccuracy(accuracy);
      setTimeout(() => setLastHitAccuracy(null), 500);
    });

    // Track misses
    gameInstance.on('miss', () => {
      setLastHitAccuracy('miss');
      setTimeout(() => setLastHitAccuracy(null), 500);
    });

    // Track game end
    gameInstance.on('won', (gameResult) => {
      setGameEnded(true);
      setResult(gameResult);
    });

    gameInstance.on('lost', (gameResult) => {
      setGameEnded(true);
      setResult(gameResult);
    });

    // Setup keyboard listener
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        gameInstance.attemptStabilization();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameInstance]);

  // Update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameInstance && !gameEnded) {
        elapsedRef.current = gameInstance.getElapsedTime();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameInstance, gameEnded]);

  if (gameEnded && result) {
    return <GameResultScreen result={result} />;
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-8 flex flex-col items-center justify-center">
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-cyan-300 mb-2 tracking-widest">
          QUANTUM STABILIZER
        </h1>
        <p className="text-gray-300 text-sm">
          Press SPACE when the indicator enters the target zone
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-12 mb-12">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-400">{successCount}</div>
          <div className="text-xs text-green-300 whitespace-nowrap">HITS / 5</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-400">{failureCount}</div>
          <div className="text-xs text-red-300 whitespace-nowrap">FAILS / 3</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-cyan-400">
            {(elapsedRef.current / 1000).toFixed(1)}s
          </div>
          <div className="text-xs text-cyan-300 whitespace-nowrap">TIME</div>
        </div>
      </div>

      {/* Game Display */}
      <div className="w-full max-w-2xl">
        {/* Track Background */}
        <div className="relative bg-gray-800 rounded-full h-16 border-2 border-cyan-500 overflow-hidden shadow-lg">
          {/* Target Zone */}
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-40"
            style={{
              left: `${gameInstance.targetZoneStart}%`,
              width: `${gameInstance.targetZoneWidth}%`,
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.6)'
            }}
          />

          {/* Indicator (moving element) */}
          <div
            className="absolute top-1/2 transform -translate-y-1/2 transition-none"
            style={{
              left: `${indicatorPos}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="relative">
              {/* Main indicator */}
              <div className="w-8 h-8 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/80 border-2 border-white" />

              {/* Glow effect */}
              <div
                className="absolute inset-0 w-8 h-8 rounded-full animate-pulse"
                style={{
                  background: 'radial-gradient(circle, rgba(34, 211, 238, 0.4), transparent)',
                  boxShadow: '0 0 30px rgba(34, 211, 238, 0.6)'
                }}
              />
            </div>
          </div>

          {/* Hit Feedback */}
          {lastHitAccuracy !== null && (
            <div
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none`}
            >
              <div
                className={`text-2xl font-bold ${
                  lastHitAccuracy === 'miss'
                    ? 'text-red-400'
                    : 'text-green-400'
                } animate-bounce`}
              >
                {lastHitAccuracy === 'miss' ? '✗ MISS' : `✓ ${lastHitAccuracy}%`}
              </div>
            </div>
          )}
        </div>

        {/* Zone Labels */}
        <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
          <span>0%</span>
          <span>STABILIZATION ZONE</span>
          <span>100%</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-12 text-center text-sm text-gray-400 space-y-1">
        <div>Get <span className="text-green-400 font-bold">5 hits</span> before <span className="text-red-400 font-bold">3 misses</span></div>
        <div className="text-cyan-400 font-bold text-lg">Press SPACEBAR to stabilize</div>
      </div>

      {/* Progress bars */}
      <div className="mt-8 w-full max-w-2xl space-y-3">
        {/* Hits progress */}
        <div>
          <div className="flex justify-between text-xs text-green-400 mb-1">
            <span>HITS PROGRESS</span>
            <span>{successCount} / 5</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden border border-green-500/30">
            <div
              className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all"
              style={{ width: `${(successCount / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Failures progress */}
        <div>
          <div className="flex justify-between text-xs text-red-400 mb-1">
            <span>FAILURE LIMIT</span>
            <span>{failureCount} / 3</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden border border-red-500/30">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all"
              style={{ width: `${(failureCount / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Result screen component
 */
function GameResultScreen({ result }) {
  const isSuccess = result.status === 'success';

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-8 flex flex-col items-center justify-center">
      {/* Title */}
      <div className={`text-center mb-8`}>
        <div className={`text-6xl font-bold mb-4 ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
          {isSuccess ? '✓ STABILIZED' : '✗ DESTABILIZED'}
        </div>
        <div className="text-gray-400">Quantum field {isSuccess ? 'successfully' : 'partially'} stabilized</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-6 mb-12 max-w-md">
        <div className="bg-gray-800/50 border border-cyan-500/50 rounded p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">{result.successHits}</div>
          <div className="text-xs text-gray-400 mt-1">SUCCESSFUL HITS</div>
        </div>

        <div className="bg-gray-800/50 border border-cyan-500/50 rounded p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">{result.accuracy}%</div>
          <div className="text-xs text-gray-400 mt-1">AVG ACCURACY</div>
        </div>

        <div className="bg-gray-800/50 border border-cyan-500/50 rounded p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">{result.failures}</div>
          <div className="text-xs text-gray-400 mt-1">FAILED ATTEMPTS</div>
        </div>

        <div className="bg-gray-800/50 border border-cyan-500/50 rounded p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">
            {(result.timeTaken / 1000).toFixed(1)}s
          </div>
          <div className="text-xs text-gray-400 mt-1">TIME TAKEN</div>
        </div>
      </div>

      {/* Score */}
      <div className={`text-center mb-8 p-6 rounded border-2 ${
        isSuccess ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'
      }`}>
        <div className="text-4xl font-bold text-cyan-400 mb-2">{result.score}</div>
        <div className={isSuccess ? 'text-green-400' : 'text-red-400'}>
          {isSuccess ? 'EXCELLENT STABILIZATION' : 'FIELD DESTABILIZED'}
        </div>
      </div>

      {/* Feedback */}
      <div className="text-center text-gray-400 text-sm max-w-sm">
        {isSuccess ? (
          <>
            <p className="text-green-400 font-semibold mb-2">✓ Mission successful!</p>
            <p>You successfully stabilized the quantum fluctuation with {result.accuracy}% accuracy.</p>
          </>
        ) : (
          <>
            <p className="text-red-400 font-semibold mb-2">✗ Mission failed.</p>
            <p>The quantum field became unstable. Try again with better timing.</p>
          </>
        )}
      </div>

      {/* Info */}
      <div className="mt-8 text-xs text-gray-500 text-center">
        {result.totalAttempts} total attempts • {result.successHits} / {result.failures}
      </div>
    </div>
  );
}

export default QuantumStabilizer;

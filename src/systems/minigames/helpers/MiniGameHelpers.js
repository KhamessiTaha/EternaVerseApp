/**
 * Mini-Game Helper Utilities
 *
 * Common patterns and utilities for building mini-games
 */

/**
 * Generate a random sequence
 */
export function generateRandomSequence(length, options = {}) {
  const {
    items = ['a', 'b', 'c', 'd'],
    allowDuplicates = true,
    seed = null
  } = options;

  const sequence = [];

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * items.length);
    sequence.push(items[randomIndex]);
  }

  return sequence;
}

/**
 * Shuffle an array (Fisher-Yates)
 */
export function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Calculate accuracy percentage
 */
export function calculateAccuracy(correct, total) {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Calculate score with multipliers
 */
export function calculateScore(baseScore, options = {}) {
  const {
    difficulty = 'normal',
    speedBonus = 0,
    accuracyBonus = 0,
    perfectBonus = 0
  } = options;

  const difficultyMultipliers = {
    'easy': 0.5,
    'normal': 1.0,
    'hard': 1.5,
    'extreme': 2.0
  };

  const multiplier = difficultyMultipliers[difficulty] || 1.0;

  const totalScore =
    baseScore * multiplier +
    speedBonus +
    accuracyBonus +
    (perfectBonus ? 50 : 0);

  return Math.floor(totalScore);
}

/**
 * Format time for display
 */
export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }

  return `${seconds}s`;
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Sleep utility for animations
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;

  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Ease-out cubic
 */
export function easeOutCubic(t) {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

/**
 * Ease-in-out quad
 */
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Get performance tier based on score
 */
export function getPerformanceTier(accuracy) {
  if (accuracy >= 95) return 'flawless';
  if (accuracy >= 85) return 'excellent';
  if (accuracy >= 70) return 'good';
  if (accuracy >= 50) return 'fair';
  return 'poor';
}

/**
 * Generate difficulty-scaled challenge data
 */
export function generateChallenge(difficulty) {
  const scalingFactors = {
    'easy': { speedFactor: 1.0, complexity: 1, items: 4 },
    'normal': { speedFactor: 1.2, complexity: 2, items: 6 },
    'hard': { speedFactor: 1.6, complexity: 3, items: 8 },
    'extreme': { speedFactor: 2.0, complexity: 4, items: 10 }
  };

  return scalingFactors[difficulty] || scalingFactors['normal'];
}

/**
 * Event emitter helper
 */
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this._listeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  emit(event, data) {
    const listeners = this._listeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  off(event) {
    this._listeners.delete(event);
  }

  clear() {
    this._listeners.clear();
  }
}

/**
 * Simple animation queue
 */
export class AnimationQueue {
  constructor() {
    this.queue = [];
    this.isRunning = false;
  }

  add(duration, callback) {
    this.queue.push({ duration, callback });
    this.process();
  }

  async process() {
    if (this.isRunning || this.queue.length === 0) return;

    this.isRunning = true;

    while (this.queue.length > 0) {
      const { duration, callback } = this.queue.shift();

      await new Promise(resolve => {
        setTimeout(() => {
          callback?.();
          resolve();
        }, duration);
      });
    }

    this.isRunning = false;
  }

  clear() {
    this.queue = [];
  }
}

/**
 * Validate mini-game config
 */
export function validateGameConfig(config) {
  const errors = [];

  if (config.difficulty && !['easy', 'normal', 'hard', 'extreme'].includes(config.difficulty)) {
    errors.push('Invalid difficulty');
  }

  if (config.timeLimit !== null && config.timeLimit <= 0) {
    errors.push('Time limit must be positive');
  }

  if (typeof config.allowPause !== 'boolean') {
    errors.push('allowPause must be boolean');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  generateRandomSequence,
  shuffle,
  calculateAccuracy,
  calculateScore,
  formatTime,
  formatNumber,
  sleep,
  debounce,
  throttle,
  clamp,
  lerp,
  easeOutCubic,
  easeInOutQuad,
  getPerformanceTier,
  generateChallenge,
  EventEmitter,
  AnimationQueue,
  validateGameConfig
};

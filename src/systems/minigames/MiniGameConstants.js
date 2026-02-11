/**
 * Mini-Game System Constants
 * Defines all enums, status codes, and constants for mini-games
 */

// Mini-game lifecycle states
export const MiniGameState = {
  IDLE: 'idle',                    // Not running
  INITIALIZING: 'initializing',    // Loading assets/setup
  RUNNING: 'running',              // Active and accepting input
  PAUSED: 'paused',                // Paused by user
  COMPLETING: 'completing',        // Transitioning to complete state
  COMPLETED: 'completed',          // Finished (success/fail)
  DESTROYED: 'destroyed'           // Cleaned up
};

// Difficulty levels (helps game scale challenges)
export const MiniGameDifficulty = {
  EASY: 'easy',           // Score * 0.5x multiplier
  NORMAL: 'normal',       // Score * 1.0x multiplier
  HARD: 'hard',           // Score * 1.5x multiplier
  EXTREME: 'extreme'      // Score * 2.0x multiplier
};

// Completion statuses - determines how anomaly is resolved
export const MiniGameResult = {
  SUCCESS: 'success',             // Perfect execution
  PARTIAL_SUCCESS: 'partial',     // Partial resolution
  FAILED: 'failed',               // Complete failure
  ABANDONED: 'abandoned'          // User quit
};

// Performance tiers (for UI feedback and reward scaling)
export const MiniGamePerformance = {
  FLAWLESS: 'flawless',       // 95-100% accuracy/completion
  EXCELLENT: 'excellent',     // 85-94%
  GOOD: 'good',               // 70-84%
  FAIR: 'fair',               // 50-69%
  POOR: 'poor'                // Below 50%
};

// Error codes for mini-game system
export const MiniGameError = {
  NOT_REGISTERED: 'not_registered',
  ALREADY_RUNNING: 'already_running',
  INITIALIZATION_FAILED: 'init_failed',
  INVALID_CONFIG: 'invalid_config',
  MISSING_REQUIRED_FIELD: 'missing_field',
  LIFECYCLE_ERROR: 'lifecycle_error',
  TIMEOUT: 'timeout'
};

// Default configuration
export const DEFAULT_MINIGAME_CONFIG = {
  difficulty: MiniGameDifficulty.NORMAL,
  timeLimit: null,                     // No time limit by default
  allowPause: true,
  allowAbort: true,
  showControls: true,
  skipAnimation: false,               // For testing
  debugMode: false
};

// Events that mini-games can emit
export const MiniGameEvent = {
  STARTED: 'minigame:started',
  UPDATED: 'minigame:updated',
  COMPLETED: 'minigame:completed',
  FAILED: 'minigame:failed',
  PAUSED: 'minigame:paused',
  RESUMED: 'minigame:resumed',
  PROGRESSED: 'minigame:progressed',
  STATE_CHANGED: 'minigame:state_changed'
};

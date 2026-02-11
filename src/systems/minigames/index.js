/**
 * Mini-Game System
 * Central export point for the mini-game architecture
 */

// Core classes
export { MiniGame } from './MiniGame.js';
export { MiniGameManager } from './MiniGameManager.js';

// React hook
export { useMiniGame } from './useMiniGame.js';

// Registry
export { getMiniGameManager, initializeMiniGameSystem } from './MiniGameRegistry.js';

// Constants
export {
  MiniGameState,
  MiniGameDifficulty,
  MiniGameResult,
  MiniGamePerformance,
  MiniGameError,
  MiniGameEvent,
  DEFAULT_MINIGAME_CONFIG
} from './MiniGameConstants.js';

// Games
export { QuantumStabilizer } from './games/QuantumStabilizer.jsx';

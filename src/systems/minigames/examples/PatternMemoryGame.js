/**
 * Pattern Memory Mini-Game
 *
 * A complete, production-ready example mini-game.
 *
 * Rules:
 * - The game displays a sequence of colored panels lighting up
 * - Player must repeat the sequence by clicking panels
 * - Sequence grows longer with each correct round
 * - Play until player fails or wins by reaching target length
 *
 * How to create your own:
 * 1. Copy this file
 * 2. Rename the class
 * 3. Implement initialize(), onGameComplete(), and UI component
 * 4. Register with manager
 */

import MiniGame from '../MiniGame.js';
import { MiniGameResult } from '../MiniGameConstants.js';

/**
 * Game logic class
 */
export class PatternMemoryGame extends MiniGame {
  get id() {
    return 'pattern-memory';
  }

  get name() {
    return 'Pattern Memory';
  }

  get description() {
    return 'Watch and repeat the color pattern. Each round adds a new color.';
  }

  get Component() {
    return PatternMemoryGameUI;
  }

  constructor(config = {}, context = {}) {
    super(config, context);

    // Game state
    this.sequence = [];
    this.playerSequence = [];
    this.isPlaying = false;
    this.round = 0;
    this.score = 0;
    this.targetLength = this.calculateTargetLength();
    this.colors = ['red', 'blue', 'green', 'yellow'];
    this.listeners = [];
  }

  async initialize() {
    console.log(`Pattern Memory: Starting (difficulty: ${this.config.difficulty})`);
    // No async setup needed for this game
    // In a real game: load sounds, images, etc.
  }

  update(deltaTime) {
    // Optional: could add animations or state updates here
  }

  onGameComplete(payload) {
    console.log('Pattern Memory: Complete', payload);
  }

  /**
   * Game methods (called from UI component)
   */

  startRound() {
    if (this.isPlaying) return;

    this.round++;
    this.addToSequence();
    this.playerSequence = [];
    this.isPlaying = true;
    this.playSequence();
  }

  addToSequence() {
    const randomColor = this.colors[
      Math.floor(Math.random() * this.colors.length)
    ];
    this.sequence.push(randomColor);
  }

  async playSequence() {
    this.isPlaying = true;
    this.emit('sequenceStart');

    for (let i = 0; i < this.sequence.length; i++) {
      await this.delay(500);
      this.flash(this.sequence[i]);
      await this.delay(500);
    }

    this.isPlaying = false;
    this.emit('sequenceEnd');
  }

  playerClick(color) {
    if (this.isPlaying) return;

    this.flash(color);
    this.playerSequence.push(color);

    // Check if player's move matches
    const index = this.playerSequence.length - 1;
    if (this.playerSequence[index] !== this.sequence[index]) {
      this.playerFailed();
      return;
    }

    // Check if player completed the round
    if (this.playerSequence.length === this.sequence.length) {
      this.playerCompletedRound();
    }
  }

  playerCompletedRound() {
    this.score += 10 * this.round;
    this.emit('roundComplete', { round: this.round, score: this.score });

    // Check if player won
    if (this.sequence.length >= this.targetLength) {
      this.playerWon();
    } else {
      // Start next round after delay
      setTimeout(() => this.startRound(), 1000);
    }
  }

  playerFailed() {
    this.emit('playerFailed', { round: this.round, score: this.score });

    this.complete(
      {
        score: this.score,
        rounds: this.round,
        sequenceLength: this.sequence.length,
        accuracy: (this.playerSequence.length / this.sequence.length) * 100
      },
      MiniGameResult.FAILED
    );
  }

  playerWon() {
    const finalScore = this.score + (this.targetLength * 10);

    this.emit('playerWon', {
      rounds: this.round,
      finalScore: finalScore,
      difficulty: this.config.difficulty
    });

    this.complete(
      {
        score: finalScore,
        rounds: this.round,
        sequenceLength: this.sequence.length,
        accuracy: 100,
        perfect: true
      },
      MiniGameResult.SUCCESS
    );
  }

  /**
   * Utilities
   */

  flash(color) {
    this.emit('flash', { color });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateTargetLength() {
    const targets = {
      'easy': 4,
      'normal': 6,
      'hard': 8,
      'extreme': 10
    };
    return targets[this.config.difficulty] || 6;
  }

  emit(eventType, data) {
    this.listeners.forEach(cb => {
      if (cb.type === eventType) {
        cb.handler(data);
      }
    });
  }

  on(eventType, handler) {
    this.listeners.push({ type: eventType, handler });
  }

  destroy() {
    this.listeners = [];
  }
}

/**
 * React UI Component
 *
 * Renders the game UI and handles player interactions
 */
function PatternMemoryGameUI({ gameInstance }) {
  const [sequence, setSequence] = React.useState([]);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [round, setRound] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [flashingColor, setFlashingColor] = React.useState(null);
  const [gameMessage, setGameMessage] = React.useState('Click Start to begin');

  if (!gameInstance) return <div>Loading...</div>;

  // Setup listeners
  React.useEffect(() => {
    gameInstance.on('flash', ({ color }) => {
      setFlashingColor(color);
      setTimeout(() => setFlashingColor(null), 300);
    });

    gameInstance.on('sequenceStart', () => {
      setGameMessage('Watch...');
      setIsPlaying(true);
    });

    gameInstance.on('sequenceEnd', () => {
      setGameMessage('Your turn!');
      setIsPlaying(false);
    });

    gameInstance.on('roundComplete', ({ round, score }) => {
      setRound(round);
      setScore(score);
    });

    gameInstance.on('playerFailed', ({ round, score }) => {
      setGameMessage(`Failed at round ${round}!`);
    });

    gameInstance.on('playerWon', ({ finalScore }) => {
      setGameMessage(`You won! Score: ${finalScore}`);
    });
  }, [gameInstance]);

  const handleColorClick = (color) => {
    if (!isPlaying) {
      gameInstance.playerClick(color);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 to-indigo-900 p-8">
      <h2 className="text-white text-3xl font-bold mb-2">Pattern Memory</h2>

      <div className="text-gray-300 mb-8">
        <p>Round: {round}</p>
        <p>Score: {score}</p>
      </div>

      {/* Message */}
      <div className="text-white text-xl mb-12 h-8">
        {gameMessage}
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-2 gap-6 mb-12">
        {['red', 'blue', 'green', 'yellow'].map(color => (
          <button
            key={color}
            onClick={() => handleColorClick(color)}
            disabled={isPlaying}
            className={`
              w-24 h-24 rounded-lg font-bold text-white transition-all
              ${flashingColor === color ? 'scale-110 opacity-100' : 'opacity-70'}
              ${color === 'red' && 'bg-red-500 hover:bg-red-600'}
              ${color === 'blue' && 'bg-blue-500 hover:bg-blue-600'}
              ${color === 'green' && 'bg-green-500 hover:bg-green-600'}
              ${color === 'yellow' && 'bg-yellow-500 hover:bg-yellow-600'}
              ${isPlaying && 'cursor-not-allowed'}
              ${!isPlaying && 'cursor-pointer'}
              shadow-lg
            `}
          >
            {color[0].toUpperCase()}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={() => gameInstance.startRound()}
          disabled={isPlaying}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
        >
          {round === 0 ? 'Start' : 'Next Round'}
        </button>

        <button
          onClick={() => gameInstance.playerFailed()}
          className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Give Up
        </button>
      </div>
    </div>
  );
}

export default PatternMemoryGame;

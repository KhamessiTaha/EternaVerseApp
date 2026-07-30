// src/components/game/ui/CuratorLogPanel.jsx
//
// Transmissions ([T]): the full backlog of everything the Curator has said this
// session. The lines are some of the best writing in the game and used to
// vanish after a few seconds - this makes them re-readable, and lets a player
// who flew past a line catch up. Mood-coloured, newest first.
import { useEffect, useState } from 'react';
import { onCuratorHistory } from '../narrator.js';

const MOOD_COLOR = { dry: '#57c7d4', warning: '#e0524a', grim: '#9a8fb0', awe: '#f5cf7a' };

const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
};

export const CuratorLogPanel = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState([]);
  useEffect(() => onCuratorHistory((h) => setHistory([...h])), []);

  if (!isOpen) return null;
  const lines = [...history].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-2xl max-h-[82vh] bg-void border border-line overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Transmissions</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              Everything the Curator has told you
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
          >
            CLOSE [T]
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 && (
            <p className="font-mono text-xs text-ink-faint p-5">
              The Curator has said nothing yet. Give it a moment — it always fills a silence.
            </p>
          )}
          {lines.map((l) => {
            const color = MOOD_COLOR[l.mood] || MOOD_COLOR.dry;
            return (
              <div key={l.id} className="flex items-start gap-3 px-5 py-3 border-b border-line/50">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[13.5px] leading-relaxed text-ink/90 italic">{l.text}</p>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint mt-1">{ago(l.at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

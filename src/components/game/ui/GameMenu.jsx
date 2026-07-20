// src/components/game/ui/GameMenu.jsx
//
// The ESC hub: one place that reaches every panel (each still has its own
// hotkey for direct access) plus Settings and exit. Selecting an entry
// closes the menu and opens the target.
import { useNavigate } from 'react-router-dom';
import { Key } from './primitives';

const ENTRIES = [
  { id: 'missions', label: 'Objectives', hotkey: 'O' },
  { id: 'codex', label: 'Codex', hotkey: 'C' },
  { id: 'outfitting', label: 'Outfitting', hotkey: 'U' },
  { id: 'hangar', label: 'Hangar', hotkey: 'H' },
  { id: 'chronicle', label: 'Chronicle', hotkey: 'L' },
  { id: 'achievements', label: 'Achievements', hotkey: 'P' },
  { id: 'map', label: 'Full Map', hotkey: 'M' },
  { id: 'settings', label: 'Settings', hotkey: null },
];

export const GameMenu = ({ isOpen, onClose, onOpenPanel, universeName }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[90vw] max-w-xs bg-void border border-line overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Paused</h2>
          <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase truncate">
            {universeName || 'Unknown universe'}
          </p>
        </div>

        <div className="flex flex-col p-3 gap-1">
          <button
            onClick={onClose}
            className="flex items-center justify-between font-mono text-[12px] tracking-wider px-3 py-2 border border-accent text-accent hover:bg-accent hover:text-void text-left transition-colors"
          >
            <span>RESUME</span>
            <span className="text-[9px] opacity-70">ESC</span>
          </button>

          {ENTRIES.map((e) => (
            <button
              key={e.id}
              onClick={() => { onClose(); onOpenPanel(e.id); }}
              className="flex items-center justify-between font-mono text-[12px] tracking-wider px-3 py-2 border border-line text-ink-dim hover:text-ink hover:border-line-bright text-left transition-colors"
            >
              <span>{e.label.toUpperCase()}</span>
              {e.hotkey && <Key>{e.hotkey}</Key>}
            </button>
          ))}

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-between font-mono text-[12px] tracking-wider px-3 py-2 border border-line text-ink-faint hover:text-critical hover:border-critical/50 text-left transition-colors mt-2"
          >
            <span>EXIT TO DASHBOARD</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// src/components/game/ui/NarratorOverlay.jsx
//
// Renders whatever The Curator is currently saying (see game/narrator.js) -
// lower-center of the screen, deliberately in the serif-less sans voice
// rather than the instrument monospace: this is a character speaking, not
// telemetry.
import { useEffect, useState } from 'react';
import { onNarration } from '../narrator.js';

export const NarratorOverlay = () => {
  const [line, setLine] = useState(null);

  useEffect(() => onNarration(setLine), []);

  if (!line) return null;

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-xl px-6"
      style={{ animation: 'toast-in 0.4s ease-out' }}
    >
      <div className="text-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-accent/70 mb-1.5">
          The Curator
        </div>
        <p className="font-sans text-[15px] leading-relaxed text-ink/90 italic [text-shadow:0_1px_8px_rgba(7,9,18,0.9)]">
          {line}
        </p>
      </div>
    </div>
  );
};

// src/components/game/ui/NarratorOverlay.jsx
//
// The Curator, as a PRESENCE rather than a subtitle. An animated Eye transmits
// to you: it watches, dilates, blinks, and changes colour with its mood; its
// lines TYPE OUT with a per-character voice blip so a transmission is something
// you hear arriving, not wallpaper you skim. Mood (from narrator.js) drives the
// Eye's colour + motion, the text tint, and the blip's pitch/timbre.
import { useEffect, useRef, useState } from 'react';
import { onNarration } from '../narrator.js';
import { playSfx } from '../audio.js';

const MOOD = {
  dry:     { color: '#57c7d4', label: 'The Curator', speed: 26 },
  warning: { color: '#e0524a', label: 'The Curator · alert', speed: 19 },
  grim:    { color: '#9a8fb0', label: 'The Curator', speed: 34 },
  awe:     { color: '#f5cf7a', label: 'The Curator', speed: 30 },
};

// The watchful Eye. Colour = mood; it dilates + brightens while speaking.
const CuratorEye = ({ color, speaking }) => (
  <svg viewBox="0 0 100 100" width="58" height="58" className="shrink-0" aria-hidden="true">
    {/* outer watchful ring */}
    <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="1.5"
      strokeDasharray="6 10" className="cur-spin" style={{ transformOrigin: '50px 50px' }} />
    {/* lens backing */}
    <circle cx="50" cy="50" r="40" fill="#05070d" />
    {/* iris - dilates while speaking */}
    <g className={speaking ? 'cur-pulse' : ''} style={{ transformOrigin: '50px 50px' }}>
      <circle cx="50" cy="50" r="24" fill={color} fillOpacity="0.18" stroke={color} strokeOpacity="0.8" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="24" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="6" />
    </g>
    {/* pupil - drifts to 'look around' */}
    <g className="cur-drift">
      <circle cx="50" cy="50" r="9.5" fill="#04050b" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="46" cy="46" r="2.6" fill="#ffffff" fillOpacity="0.85" />
    </g>
    {/* eyelid blink */}
    <g className="cur-blink" style={{ transformOrigin: '50px 50px' }}>
      <rect x="3" y="3" width="94" height="94" rx="6" fill="#05070d" />
    </g>
  </svg>
);

export const NarratorOverlay = () => {
  const [line, setLine] = useState(null);
  const [shown, setShown] = useState('');
  const [typing, setTyping] = useState(false);
  const blipRef = useRef(0);

  useEffect(() => onNarration(setLine), []);

  // Typewriter reveal + voice blips, restarted whenever a new line arrives.
  useEffect(() => {
    if (!line) { setShown(''); setTyping(false); return; }
    const mood = MOOD[line.mood] || MOOD.dry;
    const text = line.text;
    let i = 0;
    setShown('');
    setTyping(true);

    const tick = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      const ch = text[i - 1];
      const now = performance.now();
      if (ch && ch !== ' ' && now - blipRef.current > 42) {
        blipRef.current = now;
        playSfx('curatorBlip', { mood: line.mood, i });
      }
      if (i >= text.length) {
        clearInterval(tick);
        setTyping(false);
      }
    }, mood.speed);

    return () => clearInterval(tick);
  }, [line]);

  if (!line) return null;
  const mood = MOOD[line.mood] || MOOD.dry;

  return (
    <div
      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-[min(92vw,640px)] px-4"
      style={{ animation: 'toast-in 0.4s ease-out' }}
    >
      <style>{`
        @keyframes cur-spin { to { transform: rotate(360deg); } }
        .cur-spin { animation: cur-spin 26s linear infinite; }
        @keyframes cur-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.11); } }
        .cur-pulse { animation: cur-pulse 0.9s ease-in-out infinite; }
        @keyframes cur-drift {
          0%,100% { transform: translate(0,0); } 25% { transform: translate(4px,-3px); }
          50% { transform: translate(-3px,3px); } 75% { transform: translate(-4px,-2px); }
        }
        .cur-drift { animation: cur-drift 7s ease-in-out infinite; }
        @keyframes cur-blink {
          0%,94%,100% { transform: scaleY(0); } 96%,98% { transform: scaleY(1); }
        }
        .cur-blink { animation: cur-blink 6.5s ease-in-out infinite; }
        @keyframes cur-caret { 50% { opacity: 0; } }
        .cur-caret { animation: cur-caret 0.9s steps(1) infinite; margin-left: 1px; }
      `}</style>

      <div
        className="flex items-center gap-4 rounded-lg border bg-void/80 backdrop-blur-md px-4 py-3"
        style={{ borderColor: `${mood.color}55`, boxShadow: `0 0 24px ${mood.color}22, inset 0 0 20px rgba(7,9,18,0.6)` }}
      >
        <div style={{ filter: `drop-shadow(0 0 6px ${mood.color}88)` }}>
          <CuratorEye color={mood.color} speaking={typing} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] mb-1" style={{ color: `${mood.color}cc` }}>
            {mood.label}
          </div>
          <p className="font-sans text-[15px] leading-relaxed text-ink/95 italic">
            {shown}
            {typing && <span className="cur-caret" style={{ color: mood.color }}>▌</span>}
          </p>
        </div>
      </div>
    </div>
  );
};

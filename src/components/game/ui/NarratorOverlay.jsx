// src/components/game/ui/NarratorOverlay.jsx
//
// The Curator, as a PRESENCE that FEELS. An animated Eye transmits to you and
// physically emotes: eyelids squint / widen / droop, a brow furrows or lifts,
// the pupil dilates with wonder or narrows with irritation, it wells up when
// grim and sparkles when awed. Lines type out with a per-character voice blip
// pitched to the emotion. Everything is driven by content/curatorEmotions.js
// and morphs SMOOTHLY between feelings (CSS transitions on every pose value).
import { useEffect, useRef, useState } from 'react';
import { onNarration } from '../narrator.js';
import { emotionOf } from '../content/curatorEmotions.js';
import { playSfx } from '../audio.js';

const BG = '#05070d';

// The watchful, emotive Eye. `e` is a full emotion pose; `speaking` drives the
// iris pulse.
const CuratorEye = ({ e, speaking }) => {
  const c = e.color;
  const trans = 'transform .55s ease, opacity .55s ease, stroke .7s ease, fill .7s ease';
  return (
    <svg viewBox="0 0 100 100" width="62" height="62" className="shrink-0" aria-hidden="true">
      <defs>
        <clipPath id="cur-lens"><circle cx="50" cy="50" r="38" /></clipPath>
      </defs>

      {/* Brow: tilts DOWN at the inner ends when furrowed (concern/anger), UP
          when lifted (wonder/surprise). A huge amount of emotion for one arc. */}
      <path d="M28 23 Q50 15 72 23" fill="none" strokeWidth="3.5" strokeLinecap="round"
        style={{
          stroke: c, opacity: e.browShow ? 0.85 : 0,
          transformBox: 'fill-box', transformOrigin: 'center',
          transform: `rotate(${e.brow}deg)`, transition: trans,
        }} />

      {/* Outer watchful ring + a slow-rotating dashed ring */}
      <circle cx="50" cy="50" r="47" fill="none" strokeWidth="1.5" style={{ stroke: c, opacity: 0.3, transition: trans }} />
      <circle cx="50" cy="50" r="47" fill="none" strokeWidth="1.5" strokeDasharray="6 10"
        className="cur-spin" style={{ stroke: c, opacity: 0.5, transformOrigin: '50px 50px', transition: 'stroke .7s' }} />

      {/* Lens backing */}
      <circle cx="50" cy="50" r="38" fill={BG} />

      <g clipPath="url(#cur-lens)">
        {/* Iris - pulses while speaking */}
        <g className={speaking ? 'cur-pulse' : ''} style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDuration: `${e.pulse}s` }}>
          <circle cx="50" cy="50" r="24" fill={c} style={{ transition: trans }} fillOpacity="0.16" />
          <circle cx="50" cy="50" r="24" fill="none" strokeWidth="1.5" style={{ stroke: c, transition: trans }} strokeOpacity="0.8" />
          {/* faint clockwork spokes - an ancient, made thing */}
          {[0, 45, 90, 135].map((a) => (
            <line key={a} x1="50" y1="30" x2="50" y2="70" strokeWidth="0.75" strokeOpacity="0.25"
              style={{ stroke: c, transformBox: 'fill-box', transformOrigin: 'center', transform: `rotate(${a}deg)` }} />
          ))}
        </g>

        {/* Pupil - dilates (emotion) via scale, drifts (looks around) via keyframe */}
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${e.pupil})`, transition: trans }}>
          <g className="cur-drift" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDuration: `${e.drift}s` }}>
            <circle cx="50" cy="50" r="9.5" fill="#04050b" strokeWidth="1" style={{ stroke: c, transition: trans }} strokeOpacity="0.4" />
            <circle cx="46" cy="46" r="2.6" fill="#ffffff" fillOpacity="0.85" />
          </g>
        </g>

        {/* Tear (grief): wells at the lower lid and slides */}
        {e.shimmer === 'tear' && (
          <ellipse cx="38" cy="66" rx="3" ry="4" fill={c} fillOpacity="0.75" className="cur-tear" />
        )}
        {/* Sparkle (wonder): little twinkles across the iris */}
        {e.shimmer === 'sparkle' && [[40, 40], [62, 46], [52, 62]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.8" fill="#ffffff" className="cur-sparkle" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}

        {/* Eyelids - scaleY from top/bottom edges gives squint / droop / widen */}
        <rect x="6" y="6" width="88" height="46" rx="6" fill={BG}
          style={{ transformBox: 'fill-box', transformOrigin: 'top', transform: `scaleY(${e.lidTop})`, transition: trans }} />
        <rect x="6" y="48" width="88" height="46" rx="6" fill={BG}
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom', transform: `scaleY(${e.lidBottom})`, transition: trans }} />

        {/* Blink - a quick full close, paced by the emotion */}
        <rect x="2" y="2" width="96" height="96" rx="8" fill={BG}
          className="cur-blink" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDuration: `${e.blink}s` }} />
      </g>
    </svg>
  );
};

export const NarratorOverlay = () => {
  const [line, setLine] = useState(null);
  const [shown, setShown] = useState('');
  const [typing, setTyping] = useState(false);
  const blipRef = useRef(0);

  useEffect(() => onNarration(setLine), []);

  // Typewriter reveal + voice blips, restarted whenever a new line arrives.
  useEffect(() => {
    if (!line) { setShown(''); setTyping(false); return; }
    const e = emotionOf(line.mood);
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
        playSfx('curatorBlip', { freq: e.blip.freq, type: e.blip.type, i });
      }
      if (i >= text.length) {
        clearInterval(tick);
        setTyping(false);
      }
    }, e.typeSpeed);

    return () => clearInterval(tick);
  }, [line]);

  if (!line) return null;
  const e = emotionOf(line.mood);

  return (
    <div
      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-[min(92vw,640px)] px-4"
      style={{ animation: 'toast-in 0.4s ease-out' }}
    >
      <style>{`
        @keyframes cur-spin { to { transform: rotate(360deg); } }
        .cur-spin { animation: cur-spin 26s linear infinite; }
        @keyframes cur-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        .cur-pulse { animation-name: cur-pulse; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes cur-drift {
          0%,100% { transform: translate(0,0); } 25% { transform: translate(3px,-2px); }
          50% { transform: translate(-2px,3px); } 75% { transform: translate(-3px,-1px); }
        }
        .cur-drift { animation-name: cur-drift; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes cur-blink { 0%,94%,100% { transform: scaleY(0); } 96%,98% { transform: scaleY(1); } }
        .cur-blink { animation-name: cur-blink; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes cur-sparkle { 0%,100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 0.95; transform: scale(1); } }
        .cur-sparkle { transform-box: fill-box; transform-origin: center; animation: cur-sparkle 1.8s ease-in-out infinite; }
        @keyframes cur-tear { 0% { opacity: 0; transform: translateY(-3px); } 40% { opacity: 0.8; } 100% { opacity: 0; transform: translateY(16px); } }
        .cur-tear { transform-box: fill-box; animation: cur-tear 4.5s ease-in infinite; }
        @keyframes cur-caret { 50% { opacity: 0; } }
        .cur-caret { animation: cur-caret 0.9s steps(1) infinite; margin-left: 1px; }
      `}</style>

      <div
        className="flex items-center gap-4 rounded-lg border bg-void/80 backdrop-blur-md px-4 py-3"
        style={{ borderColor: `${e.color}55`, boxShadow: `0 0 24px ${e.color}22, inset 0 0 20px rgba(7,9,18,0.6)`, transition: 'border-color .6s, box-shadow .6s' }}
      >
        <div style={{ filter: `drop-shadow(0 0 6px ${e.color}88)`, transition: 'filter .6s' }}>
          <CuratorEye e={e} speaking={typing} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] mb-1" style={{ color: `${e.color}cc`, transition: 'color .6s' }}>
            {e.label}
          </div>
          <p className="font-sans text-[15px] leading-relaxed text-ink/95 italic">
            {shown}
            {typing && <span className="cur-caret" style={{ color: e.color }}>▌</span>}
          </p>
        </div>
      </div>
    </div>
  );
};

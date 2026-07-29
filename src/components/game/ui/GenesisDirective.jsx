// src/components/game/ui/GenesisDirective.jsx
//
// The visible face of the Genesis Directive (see game/firstSession.js). A slim
// left-edge checklist that guides a first-session warden through the core loop
// and then vanishes forever. Progressive disclosure: only the current step
// shows its full instruction, so the card never becomes a wall of text.
//
// This component owns the arc's whole lifecycle - it evaluates the universe on
// load (considerStart), keeps the state beats in sync every refresh
// (syncUniverse), and speaks the Curator's induction/closing lines - so the
// rest of the app needs no wiring. Phaser posts the motion beats via markBeat.
import { useEffect, useRef, useState } from 'react';
import {
  GENESIS_BEATS,
  onGenesis,
  considerStart,
  syncUniverse,
  dismissGenesis,
} from '../firstSession';
import { narrate, CURATOR } from '../narrator';

export const GenesisDirective = ({ universe }) => {
  const [snap, setSnap] = useState({ active: false, finished: false, done: new Set() });
  const finishedRef = useRef(false);

  // Subscribe to the arc store.
  useEffect(() => onGenesis(setSnap), []);

  // Evaluate on universe id change. The spoken opening now belongs to the
  // scripted First Light sequence (scene-side); the checklist here stays as
  // silent visual reinforcement, so the Curator doesn't welcome you twice.
  const uid = universe?._id || universe?.id;
  useEffect(() => {
    if (universe) considerStart(universe);
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (universe) syncUniverse(universe);
  }, [universe]);

  // On completion: the Curator's closing line, a beat to savor the flourish,
  // then dismiss for good.
  useEffect(() => {
    if (snap.finished && !finishedRef.current) {
      finishedRef.current = true;
      narrate(CURATOR.genesis.complete);
      const t = setTimeout(() => dismissGenesis(), 5200);
      return () => clearTimeout(t);
    }
  }, [snap.finished]);

  if (!snap.active) return null;

  const currentId = GENESIS_BEATS.find((b) => !snap.done.has(b.id))?.id ?? null;

  return (
    <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-20 w-[250px]">
      <div className="pointer-events-auto border border-line bg-void/85 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-accent">
            ◈ Genesis Directive
          </div>
          <div className="font-mono text-[9px] tabular-nums text-ink-faint">
            {snap.done.size}/{GENESIS_BEATS.length}
          </div>
        </div>

        {snap.finished ? (
          <div className="px-3.5 py-4 text-center">
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-good animate-pulse mb-1">
              ✓ The loop is yours
            </div>
            <p className="font-sans text-[12px] leading-relaxed text-ink-dim italic">
              Now the universe is only as small as you let it be. Go deep.
            </p>
          </div>
        ) : (
          <div className="py-1.5">
            {GENESIS_BEATS.map((b) => {
              const done = snap.done.has(b.id);
              const active = b.id === currentId;
              return (
                <div key={b.id} className="px-3.5 py-1.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-mono ${
                        done
                          ? 'border-good bg-good/15 text-good'
                          : active
                          ? 'border-accent text-accent animate-pulse'
                          : 'border-line text-ink-faint'
                      }`}
                    >
                      {done ? '✓' : ''}
                    </span>
                    <span
                      className={`font-mono text-[12px] tracking-wide ${
                        done
                          ? 'text-ink-faint line-through'
                          : active
                          ? 'text-ink'
                          : 'text-ink-faint'
                      }`}
                    >
                      {b.label}
                    </span>
                    {active && (
                      <span className="ml-auto font-mono text-[9px] tracking-wider uppercase text-accent border border-accent/40 px-1.5 py-0.5">
                        {b.hint}
                      </span>
                    )}
                  </div>
                  {active && (
                    <p className="mt-1.5 pl-[26px] font-sans text-[11px] leading-relaxed text-ink-dim">
                      {b.instruction}
                    </p>
                  )}
                </div>
              );
            })}
            <button
              onClick={dismissGenesis}
              className="mt-1 w-full border-t border-line px-3.5 py-1.5 text-left font-mono text-[9px] tracking-wider uppercase text-ink-faint transition-colors hover:text-ink-dim"
            >
              Skip induction
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

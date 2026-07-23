// src/components/game/ui/DevPanel.jsx
//
// Admin-only dev/test tools ([K], rendered only when the logged-in user has
// isAdmin). This gate is cosmetic - the server re-checks the admin flag
// against the database on every request, so nothing here is trusted.
import { useState } from 'react';

const ACTIONS = [
  // Small increments: a stability crisis resolves in ~15-30 steps, so 50/200
  // jumps blow past the whole drain->critical->collapse arc in one shot. These
  // let you walk it and resolve anomalies between jumps.
  { label: 'Fast-forward 3 steps', action: 'fast-forward', payload: { steps: 3 } },
  { label: 'Fast-forward 10 steps', action: 'fast-forward', payload: { steps: 10 } },
  { label: 'Fast-forward 30 steps', action: 'fast-forward', payload: { steps: 30 } },
  { label: 'Grant 500 RP', action: 'grant-research', payload: { points: 500 } },
  { label: 'Grant 5000 RP', action: 'grant-research', payload: { points: 5000 } },
  { label: 'Spawn 3 anomalies nearby', action: 'spawn-anomalies', payload: { count: 3 } },
  { label: 'Spawn 2 civilizations nearby', action: 'spawn-civilizations', payload: { count: 2 } },
  { label: 'Spawn WORSHIPPING civ (tribute, halo)', action: 'spawn-civilizations', payload: { count: 1, disposition: 'worship' } },
  { label: 'Spawn HOSTILE civ (fires missiles!)', action: 'spawn-civilizations', payload: { count: 1, disposition: 'hostile' } },
  { label: 'Rewind visit (test away-digest: fast-forward, exit, re-enter)', action: 'rewind-visit', payload: {} },
  { label: 'Start a WAR between the 2 newest civs', action: 'start-war', payload: {} },
];

// Session-local effects that never touch the server (hull is client state)
const CLIENT_ACTIONS = [
  { label: 'Damage hull -50 (test HUD / armor)', action: 'damage-hull' },
  { label: 'Destroy ship (test death cinematic)', action: 'destroy-ship' },
  { label: 'Repair hull to full', action: 'repair-hull' },
  { label: 'Next ship hull (session-only, ignores unlocks)', action: 'cycle-hull' },
];

export const DevPanel = ({ isOpen, onClose, onDevAction, onClientAction }) => {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  if (!isOpen) return null;

  // Fast-forward returns the stability trajectory so a jump's effect on the
  // reservoir is visible without opening the meter - "0.850 -> 0.494 (-0.356)".
  const formatFastForward = (data) => {
    const s = data.stability;
    const delta = s.after - s.before;
    const sign = delta >= 0 ? '+' : '';
    const trajectory = `${s.before.toFixed(3)} → ${s.after.toFixed(3)} (${sign}${delta.toFixed(3)})`;
    const crisis = `crit ${s.criticalSteps}/${s.crisisWindow}`;
    const end = data.ended ? ` · 💥 ${data.endCondition}` : '';
    return `FF ${data.steps} · stability ${trajectory} · ceiling ${s.ceiling.toFixed(2)} · anomalies ${s.activeAnomalies} · ${crisis}${end}`;
  };

  const run = async (action, payload) => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await onDevAction(action, payload);
      if (data?.ok && data.stability) {
        setLastResult(formatFastForward(data));
      } else {
        setLastResult(
          data?.ok
            ? `OK · ${action} ${JSON.stringify(payload)}`
            : `FAILED · ${data?.error || 'unknown error'}`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-md max-h-[85vh] bg-void border border-critical/50 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-critical/30 px-5 py-4 shrink-0">
          <div>
            <h2 className="font-sans text-critical font-medium text-lg tracking-wide">Dev Console</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              Admin only · not for players
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
          >
            CLOSE [K]
          </button>
        </div>

        <div className="p-5 flex flex-col gap-2 overflow-y-auto">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => run(a.action, a.payload)}
              disabled={busy}
              className="font-mono text-[11px] tracking-wider px-4 py-2 border border-line text-ink-dim hover:text-ink hover:border-line-bright text-left transition-colors disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}

          <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint mt-3 mb-1">
            Session-local (no server)
          </div>
          {CLIENT_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                const ok = onClientAction?.(a.action);
                setLastResult(ok
                  ? `OK · ${a.action} (client)`
                  : `FAILED · ${a.action} - scene not ready or stale code, reload the tab`);
              }}
              className="font-mono text-[11px] tracking-wider px-4 py-2 border border-line text-ink-dim hover:text-ink hover:border-line-bright text-left transition-colors"
            >
              {a.label}
            </button>
          ))}

          {lastResult && (
            <div className="font-mono text-[10px] text-ink-faint mt-2 break-all">{lastResult}</div>
          )}
        </div>
      </div>
    </div>
  );
};

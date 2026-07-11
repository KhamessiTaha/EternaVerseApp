// src/components/game/ui/WelcomeBackPanel.jsx
//
// "While you were away": shown once on entering a universe if enough real
// time passed since the last visit. Everything is computed client-side from
// significantEvents + the previousVisit anchors the GET route returns -
// the offline simulation's output, finally presented as a homecoming.
import { useEffect, useMemo } from 'react';
import { ANOMALY_TYPE_MAP } from '../constants';

const MIN_AWAY_MS = 10 * 60 * 1000; // don't greet people who just refreshed

const KNOWN_TYPES = new Set([
  'milestone', 'civilization', 'extinction', 'catastrophe', 'universe_end',
  'anomaly_resolved', 'discovery', 'upgrade', 'contact', 'mission', 'cosmic_event',
]);

const formatAway = (ms) => {
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} day${d > 1 ? 's' : ''}`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${Math.max(1, Math.floor(ms / 60000))} minutes`;
};

/**
 * Build the digest, or null when there's nothing worth showing (first
 * visit, short absence, or a dead-quiet universe).
 */
export const buildDigest = (universe) => {
  const prev = universe?.previousVisit;
  if (!prev?.at) return null;

  const awayMs = Date.now() - new Date(prev.at).getTime();
  if (awayMs < MIN_AWAY_MS) return null;

  const since = new Date(prev.at).getTime();
  const fresh = (universe.significantEvents || []).filter(
    (e) => new Date(e.timestamp).getTime() > since
  );

  const ageDeltaGyr = Math.max(0, ((universe.currentState?.age || 0) - (prev.age || 0)) / 1e9);

  const milestones = fresh.filter((e) => e.type === 'milestone' || e.type === 'universe_end');
  const civLines = fresh.filter((e) =>
    e.type === 'civilization' || e.type === 'extinction' || e.type === 'catastrophe'
  );
  // Unknown types are anomaly spawns (their type is the anomaly class)
  const anomalySpawns = fresh.filter(
    (e) => !KNOWN_TYPES.has(e.type) || ANOMALY_TYPE_MAP[e.type]
  ).length;

  const ended = universe.status === 'ended';
  const quiet = !ended && milestones.length === 0 && civLines.length === 0 &&
    anomalySpawns === 0 && ageDeltaGyr < 0.01;
  if (quiet) return null;

  const activeCritical = (universe.anomalies || []).filter((a) => !a.resolved).length;

  return { awayMs, ageDeltaGyr, milestones, civLines, anomalySpawns, activeCritical, ended };
};

const Section = ({ title, children }) => (
  <div className="px-5 py-3 border-b border-line/50 last:border-b-0">
    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent mb-1.5">{title}</div>
    {children}
  </div>
);

export const WelcomeBackPanel = ({ digest, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const civShown = useMemo(() => (digest?.civLines || []).slice(-5).reverse(), [digest]);

  if (!digest) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[90vw] max-w-lg max-h-[85vh] bg-void border border-line overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'toast-in 0.35s ease-out' }}
      >
        <div className="border-b border-line px-5 py-4 shrink-0">
          <h2 className="font-sans text-ink font-medium text-lg tracking-wide">While You Were Away</h2>
          <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
            Gone {formatAway(digest.awayMs)} · the universe aged {digest.ageDeltaGyr.toFixed(2)} Gyr
          </p>
        </div>

        <div className="overflow-y-auto font-mono">
          {digest.ended && (
            <Section title="Terminus">
              <p className="text-[12px] text-critical">This universe has ended.</p>
            </Section>
          )}

          {digest.milestones.length > 0 && (
            <Section title="Milestones">
              {digest.milestones.map((e, i) => (
                <p key={i} className="text-[12px] text-ink leading-relaxed">{e.description}</p>
              ))}
            </Section>
          )}

          {civShown.length > 0 && (
            <Section title={`Civilizations · ${digest.civLines.length} event${digest.civLines.length > 1 ? 's' : ''}`}>
              {civShown.map((e, i) => (
                <p key={i} className="text-[11px] text-ink-dim leading-relaxed">{e.description}</p>
              ))}
              {digest.civLines.length > 5 && (
                <p className="text-[10px] text-ink-faint mt-1">…and {digest.civLines.length - 5} more in the Chronicle [L]</p>
              )}
            </Section>
          )}

          {(digest.anomalySpawns > 0 || digest.activeCritical > 0) && (
            <Section title="Anomalies">
              <p className="text-[12px] text-ink-dim">
                {digest.anomalySpawns > 0 && <>{digest.anomalySpawns} emerged while you were gone. </>}
                {digest.activeCritical > 0 && (
                  <span className="text-warn">{digest.activeCritical} critical anomal{digest.activeCritical > 1 ? 'ies' : 'y'} active now.</span>
                )}
              </p>
            </Section>
          )}
        </div>

        <div className="px-5 py-3 border-t border-line shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider px-4 py-2 border border-accent text-accent hover:bg-accent hover:text-void transition-colors"
          >
            RESUME COMMAND
          </button>
        </div>
      </div>
    </div>
  );
};

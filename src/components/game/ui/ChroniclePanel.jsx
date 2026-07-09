// src/components/game/ui/ChroniclePanel.jsx
//
// The Chronicle ([L]): the universe's recorded history (significantEvents,
// which the backend has been logging all along - milestones, extinctions,
// anomaly spawns/resolutions, discoveries, upgrades) plus the ML predictor's
// threat forecast, fetched on open. Events arrive with the universe object;
// only the forecast needs its own request.
import { useEffect, useMemo, useState } from 'react';
import { getPredictions } from '../../../api/universeApi';
import { ANOMALY_TYPE_MAP } from '../constants';

const TYPE_STYLE = {
  milestone: { label: 'MILESTONE', cls: 'text-accent border-accent/40' },
  anomaly_resolved: { label: 'RESOLVED', cls: 'text-good border-good/40' },
  civilization: { label: 'CIVILIZATION', cls: 'text-good border-good/40' },
  extinction: { label: 'EXTINCTION', cls: 'text-critical border-critical/40' },
  catastrophe: { label: 'CATASTROPHE', cls: 'text-critical border-critical/40' },
  universe_end: { label: 'TERMINUS', cls: 'text-critical border-critical/40' },
  discovery: { label: 'DISCOVERY', cls: 'text-ink-dim border-line-bright' },
  upgrade: { label: 'OUTFITTING', cls: 'text-accent border-accent/40' },
};

// Unstyled types are raw anomaly-spawn events (their `type` is the anomaly
// class, e.g. "blackHoleMerger")
const styleFor = (type) => TYPE_STYLE[type] ?? { label: 'ANOMALY', cls: 'text-warn border-warn/40' };

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'anomalies', label: 'Anomalies' },
  { id: 'civilizations', label: 'Civilizations' },
  { id: 'player', label: 'Your Actions' },
];

const groupOf = (type) => {
  if (type === 'milestone' || type === 'universe_end') return 'milestones';
  if (type === 'anomaly_resolved' || type === 'upgrade' || type === 'discovery') return 'player';
  if (type === 'civilization' || type === 'extinction' || type === 'catastrophe') return 'civilizations';
  return 'anomalies';
};

const MAX_SHOWN = 400;

const riskColor = (risk) =>
  risk < 0.3
    ? { text: 'text-good', bar: 'bg-good' }
    : risk < 0.6
    ? { text: 'text-warn', bar: 'bg-warn' }
    : { text: 'text-critical', bar: 'bg-critical' };

const RISK_LEVEL_COLOR = {
  low: 'text-good border-good/40',
  medium: 'text-accent border-accent/40',
  high: 'text-warn border-warn/40',
  critical: 'text-critical border-critical/40',
};

const END_CONDITION_LABELS = {
  instabilityCollapse: 'Instability Collapse',
  heatDeath: 'Heat Death',
  bigRip: 'Big Rip',
  maximumEntropy: 'Maximum Entropy',
};

const RiskBar = ({ label, risk }) => {
  const c = riskColor(risk);
  return (
    <div className="mb-2.5">
      <div className="flex justify-between font-mono text-[10px] mb-1">
        <span className="text-ink-faint uppercase tracking-wider">{label}</span>
        <span className={`${c.text} tabular-nums`}>{Math.round(risk * 100)}%</span>
      </div>
      <div className="h-[3px] bg-line">
        <div className={`h-full ${c.bar}`} style={{ width: `${Math.min(100, risk * 100)}%` }} />
      </div>
    </div>
  );
};

const ThreatForecast = ({ universeId, isOpen }) => {
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen || !universeId) return;
    let cancelled = false;
    setError(false);
    getPredictions(universeId)
      .then((p) => { if (!cancelled) setForecast(p); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isOpen, universeId]);

  if (error) {
    return <p className="font-mono text-[11px] text-critical p-5">Forecast unavailable.</p>;
  }
  if (!forecast) {
    return <p className="font-mono text-[11px] text-ink-faint p-5 animate-pulse">Computing forecast…</p>;
  }

  const { predictions, overallRisk, actionPriority } = forecast;
  const stability = predictions?.stability;
  const anomalies = predictions?.anomalies;
  const endRisks = predictions?.endConditions?.risks || {};
  const levelCls = RISK_LEVEL_COLOR[overallRisk?.level] || RISK_LEVEL_COLOR.low;

  return (
    <div className="p-5 font-mono">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[9px] uppercase tracking-[0.2em] text-ink-faint">Overall Risk</span>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${levelCls}`}>
          {overallRisk?.level ?? 'unknown'} · {Math.round((overallRisk?.score ?? 0) * 100)}%
        </span>
      </div>

      {stability && (
        <div className="mb-5">
          <div className="text-[9px] uppercase tracking-[0.2em] text-accent mb-2">Stability Outlook</div>
          <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
            <span className="text-ink">{(stability.current * 100).toFixed(1)}%</span>
            <span className="text-ink-faint">→</span>
            <span className={stability.change < 0 ? 'text-warn' : 'text-good'}>
              {(stability.predicted * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {anomalies && (
        <div className="mb-5">
          <div className="text-[9px] uppercase tracking-[0.2em] text-accent mb-2">Anomaly Emergence</div>
          <RiskBar label="Probability" risk={anomalies.probability ?? 0} />
          {(anomalies.likelyTypes || []).map((t) => (
            <div key={t.type} className="flex justify-between text-[10px] text-ink-dim">
              <span>{ANOMALY_TYPE_MAP[t.type]?.label ?? t.type}</span>
              <span className="tabular-nums">{Math.round(t.probability * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5">
        <div className="text-[9px] uppercase tracking-[0.2em] text-accent mb-2">End Conditions</div>
        {Object.entries(endRisks).map(([key, data]) => (
          <RiskBar key={key} label={END_CONDITION_LABELS[key] ?? key} risk={data.risk ?? 0} />
        ))}
      </div>

      {(actionPriority || []).length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-accent mb-2">Recommended Actions</div>
          {actionPriority.map((a, i) => (
            <div key={i} className="border border-line px-3 py-2 mb-2">
              <div className="text-[10px] text-ink">{a.reason}</div>
              {a.mitigation && <div className="text-[10px] text-ink-faint mt-0.5">{a.mitigation}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ChroniclePanel = ({ isOpen, onClose, universe }) => {
  const [filter, setFilter] = useState('all');

  const events = useMemo(
    () => [...(universe?.significantEvents || [])].reverse(), // newest first
    [universe?.significantEvents]
  );

  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => groupOf(e.type) === filter)),
    [events, filter]
  );

  if (!isOpen) return null;

  const milestonesAchieved = universe?.milestones
    ? Object.values(universe.milestones).filter(Boolean).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] h-[85vh] max-w-6xl bg-void border border-line overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Chronicle</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              History of {universe?.name || 'this universe'}
            </p>
          </div>
          <div className="flex items-center gap-6 font-mono">
            <div className="text-right">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider">Events</div>
              <div className="text-ink text-sm tabular-nums">{events.length}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider">Milestones</div>
              <div className="text-accent text-sm tabular-nums">{milestonesAchieved}</div>
            </div>
            <button
              onClick={onClose}
              className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
            >
              CLOSE [L]
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Timeline */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex gap-1.5 px-5 py-3 border-b border-line">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                    filter === f.id
                      ? 'border-accent text-accent'
                      : 'border-line text-ink-faint hover:text-ink hover:border-line-bright'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="font-mono text-xs text-ink-faint p-5">
                  Nothing recorded yet. The universe is young - give it time.
                </p>
              )}
              {filtered.slice(0, MAX_SHOWN).map((event, i) => {
                const style = styleFor(event.type);
                return (
                  <div key={i} className="flex items-baseline gap-3 px-5 py-2 border-b border-line/50 font-mono">
                    <span className="text-[10px] text-ink-faint tabular-nums w-20 shrink-0 text-right">
                      {event.ageGyr ?? ((event.age || 0) / 1e9).toFixed(3)} Gyr
                    </span>
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${style.cls}`}>
                      {style.label}
                    </span>
                    <span className="text-[12px] text-ink-dim min-w-0">{event.description}</span>
                  </div>
                );
              })}
              {filtered.length > MAX_SHOWN && (
                <p className="font-mono text-[10px] text-ink-faint px-5 py-3">
                  Showing the {MAX_SHOWN} most recent of {filtered.length} events.
                </p>
              )}
            </div>
          </div>

          {/* Threat forecast */}
          <div className="w-[320px] shrink-0 border-l border-line overflow-y-auto">
            <div className="px-5 pt-4 pb-1">
              <div className="font-sans text-[15px] text-ink font-medium">Threat Forecast</div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint">Predictive model</div>
            </div>
            <ThreatForecast universeId={universe?._id} isOpen={isOpen} />
          </div>
        </div>
      </div>
    </div>
  );
};

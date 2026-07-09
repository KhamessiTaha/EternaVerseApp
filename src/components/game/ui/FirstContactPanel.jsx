// src/components/game/ui/FirstContactPanel.jsx
//
// First Contact overlay ([G] near a civilization beacon). Shows the civ's
// full simulated profile - the point is that the stats are VISIBLE and
// consequential: the aggression meter is exactly the uplift backfire risk.
// The civ is looked up fresh from the universe prop by id, so server
// responses (stat changes, spent RP) reflect immediately.
import { useState } from 'react';
import { civDesignation } from '../utils';
import { playSfx } from '../audio.js';

const TYPE_INFO = {
  Type0: { label: 'TYPE 0 · PRE-PLANETARY', color: 'text-ink-dim border-line-bright' },
  Type1: { label: 'TYPE I · PLANETARY', color: 'text-good border-good/40' },
  Type2: { label: 'TYPE II · STELLAR', color: 'text-accent border-accent/40' },
  Type3: { label: 'TYPE III · GALACTIC', color: 'text-critical border-critical/40' },
};

const OBSERVE_REWARDS = { Type0: 25, Type1: 50, Type2: 100, Type3: 200 };
const UPLIFT_BASE_COST = 60;
const PACIFY_BASE_COST = 50;
const MAX_USES = 3;

const formatPopulation = (n) => {
  if (!n) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString();
};

const StatMeter = ({ label, value, color = 'bg-accent', note }) => (
  <div className="mb-3">
    <div className="flex justify-between font-mono text-[10px] mb-1">
      <span className="text-ink-faint uppercase tracking-wider">{label}</span>
      <span className="text-ink tabular-nums">{Math.round(value * 100)}%{note ? ` · ${note}` : ''}</span>
    </div>
    <div className="h-[3px] bg-line">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  </div>
);

const OUTCOME_STYLE = {
  observed: 'text-good',
  uplifted: 'text-good',
  pacified: 'text-good',
  backfire: 'text-warn',
  error: 'text-critical',
};

export const FirstContactPanel = ({ civId, onClose, universe, onAction }) => {
  const [busy, setBusy] = useState(false);
  const [lastOutcome, setLastOutcome] = useState(null);

  if (!civId) return null;

  const civ = (universe?.civilizations || []).find((c) => c.id === civId);
  if (!civ || civ.extinct) {
    // Went extinct while the panel was open - the universe is like that
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
        <div className="bg-void border border-line p-8 text-center">
          <p className="font-mono text-sm text-critical mb-4">Signal lost. The civilization is gone.</p>
          <button onClick={onClose} className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright px-3 py-1.5">
            CLOSE
          </button>
        </div>
      </div>
    );
  }

  const points = universe?.research?.points ?? 0;
  const typeInfo = TYPE_INFO[civ.type] ?? TYPE_INFO.Type0;
  const name = civDesignation(civ.id);
  const ageMyr = ((civ.age || 0) / 1e6).toFixed(0);

  const upliftCost = UPLIFT_BASE_COST * ((civ.uplifts || 0) + 1);
  const pacifyCost = PACIFY_BASE_COST * ((civ.pacifies || 0) + 1);
  const backfirePct = Math.round((civ.warlikeness ?? 0) * 35);

  const act = async (action) => {
    if (busy) return;
    setBusy(true);
    setLastOutcome(null);
    try {
      const data = await onAction(civ.id, action);
      if (data?.ok) {
        setLastOutcome({ outcome: data.outcome, message: data.message });
        playSfx(data.outcome === 'backfire' ? 'alert' : action === 'observe' ? 'discovery' : 'install',
          action === 'observe' ? (civ.type === 'Type3' ? 'exceptional' : 'uncommon') : undefined);
      } else {
        setLastOutcome({ outcome: 'error', message: data?.error || 'Contact failed' });
        playSfx('uiDenied');
      }
    } finally {
      setBusy(false);
    }
  };

  const actionBtn = (enabled) =>
    `w-full font-mono text-[11px] tracking-wider px-4 py-2.5 border text-left transition-colors ${
      enabled ? 'border-accent text-accent hover:bg-accent hover:text-void' : 'border-line text-ink-faint cursor-not-allowed'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-2xl bg-void border border-line overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Signal · {name}</h2>
              <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
            </div>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase mt-0.5">
              First Contact Protocol
            </p>
          </div>
          <div className="flex items-center gap-6 font-mono">
            <div className="text-right">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider">Research</div>
              <div className="text-accent text-sm tabular-nums">{points} RP</div>
            </div>
            <button
              onClick={onClose}
              className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Profile */}
          <div className="flex-1 p-5 border-r border-line">
            <div className="grid grid-cols-2 gap-px bg-line border border-line mb-5 font-mono">
              <div className="bg-void-raised p-3">
                <div className="text-[9px] text-ink-faint uppercase tracking-wider mb-1">Age</div>
                <div className="text-[12px] text-ink tabular-nums">{ageMyr} My</div>
              </div>
              <div className="bg-void-raised p-3">
                <div className="text-[9px] text-ink-faint uppercase tracking-wider mb-1">Population</div>
                <div className="text-[12px] text-ink tabular-nums">{formatPopulation(civ.population)}</div>
              </div>
            </div>

            <StatMeter label="Technology" value={(civ.technology || 0) / 100} color="bg-good" />
            <StatMeter label="Stability" value={civ.stability ?? 0.5} color="bg-accent" />
            <StatMeter
              label="Aggression"
              value={civ.warlikeness ?? 0}
              color="bg-critical"
              note={`uplift backfire risk ${backfirePct}%`}
            />
            <StatMeter label="Resource Depletion" value={civ.resourceDepletion ?? 0} color="bg-warn" />
          </div>

          {/* Actions */}
          <div className="w-[280px] shrink-0 p-5 flex flex-col gap-2.5">
            <button onClick={() => act('observe')} disabled={busy || civ.observed} className={actionBtn(!civ.observed)}>
              <div>OBSERVE {civ.observed ? '· DONE' : `· +${OBSERVE_REWARDS[civ.type] ?? 25} RP`}</div>
              <div className="text-[10px] normal-case tracking-normal mt-0.5 opacity-70">
                Passive ethnographic survey
              </div>
            </button>

            <button
              onClick={() => act('uplift')}
              disabled={busy || (civ.uplifts || 0) >= MAX_USES || points < upliftCost}
              className={actionBtn((civ.uplifts || 0) < MAX_USES && points >= upliftCost)}
            >
              <div>UPLIFT {(civ.uplifts || 0) >= MAX_USES ? '· MAX' : `· ${upliftCost} RP`}</div>
              <div className="text-[10px] normal-case tracking-normal mt-0.5 opacity-70">
                Transfer technology - {backfirePct}% risk they weaponize it
              </div>
            </button>

            <button
              onClick={() => act('pacify')}
              disabled={busy || (civ.pacifies || 0) >= MAX_USES || points < pacifyCost}
              className={actionBtn((civ.pacifies || 0) < MAX_USES && points >= pacifyCost)}
            >
              <div>PACIFY {(civ.pacifies || 0) >= MAX_USES ? '· MAX' : `· ${pacifyCost} RP`}</div>
              <div className="text-[10px] normal-case tracking-normal mt-0.5 opacity-70">
                Cultural exchange - reduces aggression
              </div>
            </button>

            {lastOutcome && (
              <div className={`font-mono text-[11px] leading-relaxed mt-2 ${OUTCOME_STYLE[lastOutcome.outcome] ?? 'text-ink-dim'}`}>
                {lastOutcome.message}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 font-mono text-[10px] text-ink-faint border-t border-line">
          Surviving civilizations advance toward higher Kardashev types on their own - your interventions tilt the odds.
        </div>
      </div>
    </div>
  );
};

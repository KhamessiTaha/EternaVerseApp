// src/components/game/ui/MissionsPanel.jsx
//
// Objectives overlay ([O]): the universe's three active missions with live
// progress bars, claim buttons, and claimed history count. Progress is
// computed client-side from the same universe state the server validates
// against (metric readers mirror utils/missionSystem.js) - the server
// remains the authority on the actual claim.
import { useState } from 'react';
import { playSfx } from '../audio.js';

// Mirror of the backend's METRICS in utils/missionSystem.js - display only
const METRICS = {
  anomaliesResolved: (u) => u.metrics?.anomaliesResolved || 0,
  discoveries: (u) => u.research?.discoveryCount || 0,
  classesDiscovered: (u) => (u.research?.classesDiscovered || []).length,
  civsObserved: (u) => (u.civilizations || []).filter((c) => c.observed).length,
  uplifts: (u) => (u.civilizations || []).reduce((s, c) => s + (c.uplifts || 0), 0),
  pacifies: (u) => (u.civilizations || []).reduce((s, c) => s + (c.pacifies || 0), 0),
  researchEarned: (u) => Math.floor(u.research?.totalEarned || 0),
  rareFinds: (u) => (u.discoveries || []).filter((d) => d.rarity === "rare" || d.rarity === "exceptional").length,
  worshippers: (u) => (u.civilizations || []).filter(
    (c) => !c.extinct && (c.type === "Type0" || c.type === "Type1") && (c.relationship || 0) >= 0.45
  ).length,
  ageMyr: (u) => Math.floor((u.currentState?.age || 0) / 1e6),
};

export const progressOf = (universe, mission) => {
  const value = METRICS[mission.metric] ? METRICS[mission.metric](universe) : 0;
  const needed = mission.target - mission.baseline;
  return { done: Math.max(0, Math.min(needed, value - mission.baseline)), needed };
};

export const MissionsPanel = ({ isOpen, onClose, universe, onClaim }) => {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const missions = universe?.missions || [];
  const activeMissions = missions.filter((m) => m.status === 'active');
  const claimedCount = missions.filter((m) => m.status === 'claimed').length;

  const claim = async (missionId) => {
    if (busyId) return;
    setBusyId(missionId);
    setError(null);
    try {
      const data = await onClaim(missionId);
      if (data?.ok) {
        playSfx('minigameWin');
      } else {
        setError(data?.error || 'Claim failed');
        playSfx('uiDenied');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-xl bg-void border border-line overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Objectives</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              Mission Directives
            </p>
          </div>
          <div className="flex items-center gap-6 font-mono">
            <div className="text-right">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider">Completed</div>
              <div className="text-accent text-sm tabular-nums">{claimedCount}</div>
            </div>
            <button
              onClick={onClose}
              className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
            >
              CLOSE [O]
            </button>
          </div>
        </div>

        {error && (
          <div className="border-b border-critical/40 bg-critical/5 px-5 py-2.5 font-mono text-[11px] text-critical">
            {error}
          </div>
        )}

        <div>
          {activeMissions.length === 0 && (
            <p className="font-mono text-xs text-ink-faint p-5">
              No directives available yet - they'll be issued as the universe evolves.
            </p>
          )}
          {activeMissions.map((mission) => {
            const { done, needed } = progressOf(universe, mission);
            const complete = done >= needed;
            const busy = busyId === mission.id;

            return (
              <div key={mission.id} className="border-b border-line last:border-b-0 px-5 py-4">
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <span className="font-mono text-[13px] text-ink">{mission.title}</span>
                  <span className="font-mono text-[11px] text-accent tabular-nums shrink-0">+{mission.reward} RP</span>
                </div>
                <div className="font-mono text-[10px] text-ink-faint mb-2.5">{mission.description}</div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[3px] bg-line">
                    <div
                      className={`h-full ${complete ? 'bg-good' : 'bg-accent'}`}
                      style={{ width: `${(done / needed) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-ink-dim tabular-nums w-12 text-right">
                    {done} / {needed}
                  </span>
                  <button
                    onClick={() => claim(mission.id)}
                    disabled={!complete || busy}
                    className={`font-mono text-[10px] tracking-wider px-3 py-1.5 border transition-colors ${
                      complete
                        ? 'border-good text-good hover:bg-good hover:text-void'
                        : 'border-line text-ink-faint cursor-not-allowed'
                    } disabled:opacity-70`}
                  >
                    {busy ? '…' : 'CLAIM'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 font-mono text-[10px] text-ink-faint border-t border-line">
          Claiming an objective issues a new one. Rewards flow into your research balance.
        </div>
      </div>
    </div>
  );
};

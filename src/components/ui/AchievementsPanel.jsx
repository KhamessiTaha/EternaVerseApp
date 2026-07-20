// src/components/ui/AchievementsPanel.jsx
//
// Account-wide trophy case, opened from the Dashboard. Shows the full
// catalog with unlocked entries lit up and dated, locked ones dimmed with
// their description hidden (title still shown, so it reads as a goal).
import { useEffect, useState } from 'react';
import { getAchievements } from '../../api/userApi';
import { ACHIEVEMENT_CATALOG, TIER_STYLE } from '../game/content/achievements.js';

export const AchievementsPanel = ({ isOpen, onClose }) => {
  const [unlocked, setUnlocked] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getAchievements()
      .then((list) => { if (!cancelled) setUnlocked(list); })
      .catch(() => { if (!cancelled) setUnlocked([]); });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const unlockedMap = new Map((unlocked || []).map((a) => [a.id, a.unlockedAt]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[90vw] max-w-2xl max-h-[85vh] bg-void border border-line overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Achievements</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              {unlocked ? `${unlocked.length} / ${ACHIEVEMENT_CATALOG.length} unlocked` : 'Loading…'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
          >
            CLOSE
          </button>
        </div>

        <div className="overflow-y-auto">
          {ACHIEVEMENT_CATALOG.map((a) => {
            const isUnlocked = unlockedMap.has(a.id);
            const style = TIER_STYLE[a.tier] || TIER_STYLE.bronze;
            return (
              <div
                key={a.id}
                className={`flex items-center justify-between gap-4 px-5 py-3 border-b border-line/50 font-mono ${!isUnlocked && 'opacity-40'}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${style.border} ${style.text}`}>
                      {a.tier}
                    </span>
                    <span className="text-[13px] text-ink">{a.title}</span>
                  </div>
                  {isUnlocked && (
                    <div className="text-[10px] text-ink-faint mt-1">{a.description}</div>
                  )}
                </div>
                {isUnlocked && (
                  <span className="text-[10px] text-ink-faint shrink-0 tabular-nums">
                    {new Date(unlockedMap.get(a.id)).toLocaleDateString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

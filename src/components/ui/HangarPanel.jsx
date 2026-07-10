// src/components/ui/HangarPanel.jsx
//
// Account-wide ship loadout: pick a hull (unlocked via achievements) and an
// accent color. Reusable from the Dashboard and in-game (PhaserGame, key
// H) - in-game, selecting a hull swaps the live sprite texture immediately
// via onApply so the change is visible without leaving the universe.
import { useEffect, useState } from 'react';
import { getLoadout, updateLoadout } from '../../api/userApi';
import { HULL_CATALOG, HULL_SHAPES, HULL_STATS, COLOR_PALETTE, TIER_STYLE } from '../game/content/hullCatalog.js';
import { ABILITIES } from '../game/content/abilities.js';
import { setLoadoutLocal } from '../game/loadoutStore.js';
import { playSfx } from '../game/audio.js';

const shapeToPath = (points) =>
  points.map(([fx, fy], i) => `${i === 0 ? 'M' : 'L'}${(fx * 100).toFixed(1)},${(fy * 100).toFixed(1)}`).join(' ') + ' Z';

const HullIcon = ({ hullId, color, size = 56 }) => {
  const shape = HULL_SHAPES[hullId] || HULL_SHAPES.interceptor;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d={shapeToPath(shape.points)} fill={color} stroke="rgba(20,22,38,0.6)" strokeWidth="2.5" />
      <ellipse
        cx={shape.cockpit[0] * 100} cy={shape.cockpit[1] * 100}
        rx={shape.cockpit[2] * 100 * 0.55} ry={shape.cockpit[2] * 100}
        fill="rgba(20,22,38,0.55)"
      />
    </svg>
  );
};

export const HangarPanel = ({ isOpen, onClose, onApply }) => {
  const [loadout, setLoadout] = useState(null); // { hull, shipColor, unlockedHulls }
  const [selected, setSelected] = useState(null); // { hull, shipColor }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError(null);
    getLoadout()
      .then((data) => {
        if (cancelled) return;
        setLoadout(data);
        setSelected({ hull: data.hull, shipColor: data.shipColor });
      })
      .catch(() => { if (!cancelled) setError('Could not load hangar data'); });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const dirty = loadout && selected && (selected.hull !== loadout.hull || selected.shipColor !== loadout.shipColor);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = await updateLoadout(selected.hull, selected.shipColor);
      if (data.ok) {
        setLoadout((prev) => ({ ...prev, hull: data.hull, shipColor: data.shipColor }));
        // The module store is what the running scene polls - updating it IS
        // the live apply, no scene wiring involved
        setLoadoutLocal(data.hull, data.shipColor);
        playSfx('install');
        onApply?.(data.hull, data.shipColor);
      } else {
        setError(data.error || 'Save failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed - try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[90vw] max-w-2xl max-h-[85vh] bg-void border border-line overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4 shrink-0">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Hangar</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              Ship loadout - saved to your account
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
          >
            CLOSE
          </button>
        </div>

        {!loadout ? (
          <p className="font-mono text-xs text-ink-faint p-5">{error || 'Loading…'}</p>
        ) : (
          <div className="overflow-y-auto">
            <div className="flex items-center gap-5 px-5 py-5 border-b border-line">
              <div className="w-16 h-16 flex items-center justify-center bg-void-raised border border-line shrink-0">
                <HullIcon hullId={selected.hull} color={selected.shipColor} />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-sm text-ink">{HULL_CATALOG.find((h) => h.id === selected.hull)?.label}</div>
                <div className="font-mono text-[11px] text-ink-faint mt-1">
                  {HULL_CATALOG.find((h) => h.id === selected.hull)?.description}
                </div>
                {ABILITIES[selected.hull] && (
                  <div className="font-mono text-[10px] mt-1.5">
                    <span className="text-accent">[SPACE] {ABILITIES[selected.hull].label}</span>
                    <span className="text-ink-faint"> - {ABILITIES[selected.hull].description}</span>
                  </div>
                )}
                <div className="flex gap-3 mt-2 font-mono text-[10px] tabular-nums">
                  {(() => {
                    const s = HULL_STATS[selected.hull] || {};
                    const stat = (label, v, invert = false) => {
                      const good = invert ? v < 1 : v > 1;
                      const cls = v === 1 ? 'text-ink-faint' : good ? 'text-good' : 'text-critical';
                      return (
                        <span key={label} className={cls}>
                          {label} ×{(v ?? 1).toFixed(2)}
                        </span>
                      );
                    };
                    return [
                      stat('SPD', s.maxSpeed ?? 1),
                      stat('THR', s.thrust ?? 1),
                      stat('TRN', s.turn ?? 1),
                      stat('DMG', s.damageTaken ?? 1, true),
                    ];
                  })()}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-b border-line">
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-3">Hull</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {HULL_CATALOG.map((h) => {
                  const unlocked = loadout.unlockedHulls.includes(h.id);
                  const isSelected = selected.hull === h.id;
                  const style = TIER_STYLE[h.tier] || TIER_STYLE.starter;
                  return (
                    <button
                      key={h.id}
                      disabled={!unlocked}
                      onClick={() => setSelected((s) => ({ ...s, hull: h.id }))}
                      className={`flex items-center gap-2.5 p-2.5 border text-left transition-colors ${
                        isSelected ? 'border-accent bg-accent/5' : 'border-line hover:border-line-bright'
                      } ${!unlocked && 'opacity-35 cursor-not-allowed'}`}
                    >
                      <HullIcon hullId={h.id} color={unlocked ? selected.shipColor : '#565a72'} size={34} />
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-ink truncate">{h.label}</div>
                        <div className={`font-mono text-[8px] uppercase tracking-wider ${style.text}`}>
                          {unlocked ? h.tier : 'locked'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-3">Accent Color</div>
              <div className="flex gap-2.5 flex-wrap">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelected((s) => ({ ...s, shipColor: c }))}
                    style={{ backgroundColor: c }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      selected.shipColor === c ? 'border-ink scale-110' : 'border-line-bright'
                    }`}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-line shrink-0">
          <span className="font-mono text-[10px] text-critical">{error}</span>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={`font-mono text-[11px] tracking-wider px-4 py-2 border transition-colors ${
              dirty ? 'border-good text-good hover:bg-good hover:text-void' : 'border-line text-ink-faint cursor-not-allowed'
            }`}
          >
            {saving ? 'SAVING…' : 'SAVE LOADOUT'}
          </button>
        </div>
      </div>
    </div>
  );
};

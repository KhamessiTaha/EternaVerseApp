// src/components/game/ui/CodexPanel.jsx
import { useMemo, useState } from 'react';
import { KNOWN_CLASS_COUNT, getClassInfo } from '../world/researchValues.js';
import { ANOMALY_TYPE_MAP } from '../constants';
import { getCodexEntry } from '../content/codexEntries.js';

const RARITY_COLOR = {
  common: 'text-ink-dim border-line',
  uncommon: 'text-good border-good/40',
  rare: 'text-accent border-accent/40',
  exceptional: 'text-warn border-warn/40',
};

const GROUPS = [
  { id: 'galaxy', label: 'Galaxies', match: (d) => d.category === 'galaxy' },
  { id: 'phenomenon', label: 'Phenomena', match: (d) => d.category === 'phenomenon' || d.category === 'nebula' },
  { id: 'anomaly', label: 'Anomalies', match: (d) => d.category === 'anomaly' },
];

export const CodexPanel = ({ isOpen, onClose, universe }) => {
  const [selectedId, setSelectedId] = useState(null);
  const discoveries = useMemo(
    () => [...(universe?.discoveries || [])].reverse(), // newest first
    [universe?.discoveries]
  );

  const classesCataloged = useMemo(
    () => new Set(discoveries.map((d) => d.objectClass)).size,
    [discoveries]
  );

  if (!isOpen) return null;

  const selected = discoveries.find((d) => d.id === selectedId) || discoveries[0];

  const labelFor = (d) =>
    getClassInfo(d.objectClass)?.label ?? ANOMALY_TYPE_MAP[d.objectClass]?.label ?? d.objectClass;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] h-[85vh] max-w-6xl bg-void border border-line overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Codex</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              Deep Field Catalog
            </p>
          </div>
          <div className="flex items-center gap-6 font-mono">
            <div className="text-right">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider">Research</div>
              <div className="text-accent text-sm tabular-nums">{universe?.research?.points ?? 0} RP</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider">Classes</div>
              <div className="text-ink text-sm tabular-nums">{classesCataloged} / {KNOWN_CLASS_COUNT}</div>
            </div>
            <button
              onClick={onClose}
              className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
            >
              CLOSE [C]
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="w-[340px] border-r border-line overflow-y-auto">
            {discoveries.length === 0 && (
              <p className="text-ink-faint font-mono text-xs p-5">
                No entries yet. Approach a galaxy, nebula or anomaly and press V to scan it.
              </p>
            )}
            {GROUPS.map((group) => {
              const entries = discoveries.filter(group.match);
              if (entries.length === 0) return null;
              return (
                <div key={group.id}>
                  <div className="px-4 pt-4 pb-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-accent">
                    {group.label} · {entries.length}
                  </div>
                  {entries.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className={`w-full text-left px-4 py-2 font-mono border-l-2 transition-colors ${
                        selected?.id === d.id
                          ? 'border-accent bg-void-raised text-ink'
                          : 'border-transparent text-ink-dim hover:text-ink hover:bg-void-raised/50'
                      }`}
                    >
                      <div className="text-[12px]">{d.name}</div>
                      <div className="text-[10px] text-ink-faint">{labelFor(d)}</div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-6 font-mono">
            {selected && (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-sans text-2xl text-ink font-semibold">{selected.name}</h3>
                  <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 border ${RARITY_COLOR[selected.rarity] || RARITY_COLOR.common}`}>
                    {selected.rarity}
                  </span>
                </div>
                <div className="text-ink-faint text-[11px] uppercase tracking-wider mb-6">
                  {labelFor(selected)}
                </div>

                <div className="grid grid-cols-3 gap-px bg-line border border-line mb-6 max-w-md">
                  {[
                    ['Coordinates', `${Math.round(selected.location?.x ?? 0)}, ${Math.round(selected.location?.y ?? 0)}`],
                    ['Research', `+${selected.researchValue ?? selected.research ?? 0} RP`],
                    ['Cataloged', selected.discoveredAt ? new Date(selected.discoveredAt).toLocaleDateString() : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-void-raised p-3">
                      <div className="text-[9px] text-ink-faint uppercase tracking-wider mb-1">{label}</div>
                      <div className="text-[12px] text-ink tabular-nums">{value}</div>
                    </div>
                  ))}
                </div>

                <p className="text-ink-dim text-[13px] leading-relaxed max-w-xl">
                  {getCodexEntry(selected.objectClass)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

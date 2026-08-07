// src/components/game/ui/SelfPanel.jsx
//
// The Self: who the presence in the vessel is becoming. Shows Recollection, the
// Memories recovered so far (readable), a NUMBERLESS sense of the two pulls
// (understanding vs mastery), and the selves realized so far - the collection.
// Semi-visible: no explicit "trending toward X" until a self is actually realized.
import { useEffect, useState } from 'react';
import { getSelf, onSelfProgress } from '../wardenProgress';
import { memoryById } from '../content/memories';
import { REVELATIONS, AUTHORED_SELVES } from '../content/revelations';
import { RECOLLECTION_BANDS, SUMMIT } from '../self/selfModel';

export const SelfPanel = ({ isOpen, onClose }) => {
  const [self, setSelf] = useState(getSelf());
  useEffect(() => onSelfProgress(setSelf), []);

  if (!isOpen) return null;

  const nextBand = RECOLLECTION_BANDS.find((b) => b > self.recollection) || SUMMIT;
  const prevBand = [...RECOLLECTION_BANDS].reverse().find((b) => b <= self.recollection) || 0;
  const bandPct = Math.min(100, ((self.recollection - prevBand) / Math.max(1, nextBand - prevBand)) * 100);

  // Numberless "two pulls": a marker leaning between understanding and mastery.
  const und = self.affinity.observer + self.affinity.wanderer;
  const mas = self.affinity.gardener;
  const leanPct = und + mas === 0 ? 50 : (und / (und + mas)) * 100;

  const recovered = self.memoriesRecovered.map(memoryById).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] h-[85vh] max-w-4xl bg-void border border-line overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">The Self</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">Who wears the vessel</p>
          </div>
          <button onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors">
            CLOSE [J]
          </button>
        </div>

        <div className="px-6 py-4 border-b border-line">
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
            <span>Recollection</span>
            <span>{self.recollection >= SUMMIT ? 'Summit' : `${Math.round(bandPct)}% to next memory`}</span>
          </div>
          <div className="h-[3px] bg-line overflow-hidden mb-4">
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${bandPct}%` }} />
          </div>

          <div className="flex justify-between text-[9px] font-mono uppercase tracking-wider text-ink-faint mb-1">
            <span>Understanding</span><span>Mastery</span>
          </div>
          <div className="relative h-[3px] bg-line">
            <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-ink -ml-1 transition-all duration-500"
              style={{ left: `${leanPct}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 font-mono">
          <div className="text-[9px] uppercase tracking-[0.2em] text-accent mb-3">Recovered Memories · {recovered.length}</div>
          {recovered.length === 0 && (
            <p className="text-ink-faint text-xs">You remember nothing yet. Understand the cosmos, or shape it — and pieces of yourself return.</p>
          )}
          {recovered.map((m) => (
            <div key={m.id} className="mb-4 border-l-2 border-line pl-3">
              <p className="text-ink-dim text-[13px] leading-relaxed">{m.text}</p>
              <p className="text-ink-faint text-[11px] italic mt-1">{m.science}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-6 py-3 font-mono">
          <div className="text-[9px] uppercase tracking-[0.2em] text-accent mb-2">Selves Realized</div>
          <div className="flex gap-3 flex-wrap">
            {AUTHORED_SELVES.map((id) => {
              const done = self.realized.includes(id);
              return (
                <span key={id} className={`text-[11px] px-2 py-1 border ${done ? 'border-accent text-accent' : 'border-line text-ink-faint'}`}>
                  {done ? REVELATIONS[id].title : '??????'}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
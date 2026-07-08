// src/components/game/ui/DiscoveryToast.jsx
import { useEffect, useState } from 'react';

const RARITY_COLOR = {
  common: 'text-ink-dim',
  uncommon: 'text-good',
  rare: 'text-accent',
  exceptional: 'text-warn',
};

// Bottom-left transient toast for scan completions. Keyed remount per toast
// restarts the animation; auto-hides after 4s.
export const DiscoveryToast = ({ toast }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast || !visible) return null;
  const { discovery } = toast;

  return (
    <div key={toast.key} className="absolute bottom-5 left-5 z-20 pointer-events-none">
      <div className="bg-void-raised/85 backdrop-blur-sm border border-line px-4 py-3 font-mono">
        <div className="text-[9px] tracking-[0.2em] uppercase text-accent mb-1">New Discovery</div>
        <div className="text-[13px] text-ink">{discovery.name}</div>
        <div className="text-[11px] mt-0.5">
          <span className={RARITY_COLOR[discovery.rarity] || 'text-ink-dim'}>
            {discovery.objectClass}
          </span>
          <span className="text-ink-faint"> · +{discovery.research} RP</span>
        </div>
      </div>
    </div>
  );
};

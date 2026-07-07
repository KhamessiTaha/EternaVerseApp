const METER_COLOR = {
  accent: 'bg-accent',
  good: 'bg-good',
  warn: 'bg-warn',
  critical: 'bg-critical',
};

const PILL_COLOR = {
  accent: { dot: 'bg-accent', text: 'text-accent', border: 'border-accent' },
  good: { dot: 'bg-good', text: 'text-good', border: 'border-good' },
  warn: { dot: 'bg-warn', text: 'text-warn', border: 'border-warn' },
  critical: { dot: 'bg-critical', text: 'text-critical', border: 'border-critical' },
};

export const StatLine = ({ label, value, valueClass = '' }) => (
  <div className="flex justify-between items-center text-[11px] py-[2px] gap-3">
    <span className="text-ink-faint">{label}</span>
    <span className={`font-mono tabular-nums text-ink text-right ${valueClass}`}>{value}</span>
  </div>
);

export const Meter = ({ label, value, color = 'accent' }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2.5 mb-1 last:mb-0">
      <span className="text-[9px] tracking-wider uppercase text-ink-faint w-16 shrink-0">{label}</span>
      <div className="flex-1 h-[3px] bg-line relative">
        <div className={`absolute inset-0 ${METER_COLOR[color] || METER_COLOR.accent}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-ink-dim tabular-nums w-11 text-right shrink-0">{pct.toFixed(1)}%</span>
    </div>
  );
};

export const StatusPill = ({ label, color = 'good' }) => {
  const c = PILL_COLOR[color] || PILL_COLOR.good;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 border rounded-sm ${c.text} ${c.border}`}>
      <span className={`w-[5px] h-[5px] rounded-full ${c.dot}`} />
      {label}
    </span>
  );
};

export const SectionTitle = ({ icon, children }) => (
  <div className="flex items-center gap-1.5 text-[9px] tracking-wider uppercase text-accent mb-2">
    {icon}
    {children}
  </div>
);

export const Key = ({ children }) => (
  <span className="inline-block bg-void-raised border border-line-bright rounded-sm px-1.5 py-0.5 text-ink-dim text-[9px] font-mono mr-1.5 align-middle">
    {children}
  </span>
);

const iconProps = { viewBox: '0 0 16 16', className: 'w-[11px] h-[11px] stroke-accent fill-none shrink-0', strokeWidth: 1.3 };

export const icons = {
  structures: (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  ),
  vitals: (
    <svg {...iconProps}>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  ),
  life: (
    <svg {...iconProps}>
      <path d="M8 2c-3 3-3 9 0 12 3-3 3-9 0-12z" />
    </svg>
  ),
  mission: (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 2" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 16 16" className="w-3 h-3 stroke-current fill-none" strokeWidth="1.3">
      <path d="M2 4l4-1.5 4 1.5 4-1.5v9.5l-4 1.5-4-1.5-4 1.5V4z" />
      <path d="M6 2.5v9.5M10 4v9.5" />
    </svg>
  ),
};

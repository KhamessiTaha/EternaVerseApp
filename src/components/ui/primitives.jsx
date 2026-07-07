// Shared UI primitives for the "outer app" (marketing/auth/dashboard) pages -
// same observatory design tokens as the in-game HUD (src/components/game/ui),
// adapted for a webpage context instead of a canvas overlay.

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-void hover:bg-accent/90 font-semibold',
  secondary: 'border border-line-bright text-ink hover:border-accent hover:text-accent',
  ghost: 'text-ink-dim hover:text-ink',
  danger: 'border border-critical/40 text-critical hover:bg-critical/10',
};

export const Button = ({ variant = 'primary', className = '', children, ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 px-6 py-3 font-mono text-[13px] tracking-wide uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Panel = ({ children, className = '' }) => (
  <div className={`bg-void-raised border border-line ${className}`}>{children}</div>
);

export const Field = ({ label, icon: Icon, ...props }) => (
  <div>
    <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-2">
      {label}
    </label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />}
      <input
        className={`w-full ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-2.5 bg-void border border-line focus:outline-none focus:border-accent transition-colors text-ink placeholder-ink-faint text-sm`}
        {...props}
      />
    </div>
  </div>
);

export const Eyebrow = ({ children, className = '' }) => (
  <div className={`font-mono text-[11px] uppercase tracking-[0.18em] text-accent ${className}`}>
    {children}
  </div>
);

export const Alert = ({ variant = 'critical', children }) => {
  const colorClass = variant === 'critical' ? 'border-critical/40 text-critical' : 'border-accent/40 text-accent';
  return (
    <div className={`border ${colorClass} bg-void px-4 py-3 text-sm flex items-start gap-2.5`}>
      {children}
    </div>
  );
};

export const StatusDot = ({ color = 'good', pulse = false }) => {
  const colorClass = { good: 'bg-good', warn: 'bg-warn', critical: 'bg-critical', faint: 'bg-ink-faint' }[color];
  return <span className={`w-[6px] h-[6px] rounded-full ${colorClass} ${pulse ? 'animate-pulse' : ''}`} />;
};

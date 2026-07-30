// src/components/game/ui/LegacyPanel.jsx
//
// The culmination of the Chosen Species arc: shown once, when a people the
// player has shepherded reaches Type III and ascends. It honors the whole
// journey - first fire to a galaxy-spanning power - and, crucially, hands the
// mantle back: the ascended become a benefactor, and the player is invited to
// choose again. It is the game's emotional payoff AND its second-wind hook.
//
// Renders from an immortal `legacy` record (models/Universe.js LegacySchema),
// not a live civ - the civ may ascend, drift, even later fall, but the legacy
// is permanent.
const formatAge = (years) =>
  years >= 1e9 ? `${(years / 1e9).toFixed(1)} billion years` : `${Math.max(1, Math.round(years / 1e6))} million years`;

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const LegacyPanel = ({ legacy, onClose }) => {
  if (!legacy) return null;
  const name = legacy.designation || 'Your people';
  const nth = legacy.legacyNumber || 1;
  const stats = [
    ['Shepherded for', formatAge(legacy.shepherdedFor || 0)],
    ['Upliftings given', legacy.uplifts || 0],
    ['Worlds rescued', legacy.rescues || 0],
    ['Aggression tempered', legacy.pacifies || 0],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void/95 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-xl text-center px-8 py-10">
        <div className="text-accent text-[11px] font-mono tracking-[0.35em] uppercase mb-4 animate-pulse">
          ★ &nbsp; {nth > 1 ? `A ${ordinal(nth)} Legacy` : 'A Legacy Complete'} &nbsp; ★
        </div>
        <h1 className="font-sans text-3xl text-ink font-semibold mb-5 leading-tight">
          {name} has reached the heavens
        </h1>
        <p className="text-ink-dim text-[15px] leading-relaxed mb-8 font-sans italic max-w-lg mx-auto">
          The people you chose — that you met as primitives clinging to a single fragile world — now
          command the energy of an entire galaxy. You held their light open through every dark age.
          They ascend beyond your keeping now, and they do not forget who raised them.
        </p>

        <div className="grid grid-cols-2 gap-px bg-line border border-line mb-4 font-mono max-w-md mx-auto">
          {stats.map(([label, value]) => (
            <div key={label} className="bg-void-raised p-3.5">
              <div className="text-[9px] text-ink-faint uppercase tracking-wider mb-1">{label}</div>
              <div className="text-[14px] text-accent tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] font-mono tracking-wider text-ink-faint uppercase mb-6">
          Type 0 &nbsp;→&nbsp; Type I &nbsp;→&nbsp; Type II &nbsp;→&nbsp; Type III &nbsp;·&nbsp; Ascended
        </div>

        {/* The main goal, achieved - and the eternal Warden rank it earns. */}
        {legacy.warden && (
          <div className="mb-8 border border-accent/40 bg-accent/5 py-3 px-4 max-w-md mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent mb-1">
              ✦ The Ascension · complete
            </div>
            <div className="font-sans text-[15px] text-ink">
              You are now <span className="text-accent">{legacy.warden.title}</span>
            </div>
            <div className="font-mono text-[10px] text-ink-faint mt-1">
              {legacy.warden.ascensions} {legacy.warden.ascensions === 1 ? 'people' : 'peoples'} raised to the heavens
              {legacy.warden.next ? ` · ${legacy.warden.next.at - legacy.warden.ascensions} more to ${legacy.warden.next.title}` : ''}
            </div>
          </div>
        )}

        <p className="text-ink-dim text-[13px] leading-relaxed mb-6 font-sans max-w-md mx-auto">
          The mantle is yours again. Somewhere below, another people are taking their first
          uncertain steps. You could choose them next.
        </p>

        <button
          onClick={onClose}
          className="font-mono text-[12px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-6 py-2.5 transition-colors"
        >
          Choose again
        </button>
      </div>
    </div>
  );
};

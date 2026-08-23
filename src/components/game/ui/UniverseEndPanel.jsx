// src/components/game/ui/UniverseEndPanel.jsx
//
// The epitaph card: what this universe was, once it stopped being one.
//
// Lifted out of GameplayPage's render (where it was an inline early-return)
// so the ended state can be a SEQUENCE - cinematic, then this - instead of a
// hard cut from gameplay to a stats table. It resolves out of the colour the
// cinematic faded to, so the handoff reads as one continuous moment.
//
// It reads the server-written `chronicle` (utils/chronicle.js), frozen at the
// moment the universe died. Falls back to reading the live document for
// universes that ended before chronicles existed - those are missing the parts
// that get culled as a simulation runs, which is exactly why chronicles exist.
import { motion } from 'framer-motion';
import { Button, Eyebrow } from '../../ui/primitives';
import { sceneFor } from '../content/universeEnds';

const Row = ({ label, value, tone = 'text-ink' }) => (
  <div className="flex justify-between gap-6">
    <span className="text-ink-faint shrink-0">{label}</span>
    <span className={`${tone} tabular-nums text-right`}>{value}</span>
  </div>
);

const Group = ({ title, children }) => (
  <div className="space-y-2 py-3 first:pt-0 last:pb-0 border-b border-line/40 last:border-0">
    <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-faint/70">
      {title}
    </div>
    {children}
  </div>
);

/** Read the frozen chronicle, or reconstruct what we can from the document. */
function summarise(universe) {
  if (universe?.chronicle) return universe.chronicle;

  const cs = universe?.currentState || {};
  const civs = universe?.civilizations || [];
  const met = civs.filter((c) => c.observed || (c.relationship || 0) !== 0);
  return {
    finalAgeGyr: Number(((cs.age || 0) / 1e9).toFixed(2)),
    galaxies: cs.galaxyCount || 0,
    stars: cs.starCount || 0,
    civilizationsMet: met.length,
    civilizationsLost: met.filter((c) => c.extinct).length,
    civilizationsRescued: civs.filter((c) => (c.rescues || 0) > 0).length,
    ascended: (universe?.legacies || []).map((l) => ({
      civId: l.civId, designation: l.designation,
    })),
    anomaliesResolved: (universe?.anomalies || []).filter((a) => a.resolved).length,
    interventions: universe?.metrics?.playerInterventions || 0,
    researchEarned: universe?.research?.totalEarned || 0,
    discoveries: universe?.research?.discoveryCount || 0,
  };
}

const big = (n) => {
  if (!n) return '0';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} trillion`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} million`;
  return Math.round(n).toLocaleString();
};

export const UniverseEndPanel = ({ universe, onReturn }) => {
  const scene = sceneFor(universe?.endCondition);
  const c = summarise(universe);

  return (
    <div className="w-full h-full bg-void flex items-center justify-center overflow-y-auto py-10">
      <motion.div
        className="text-center max-w-md px-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        <Eyebrow className="justify-center flex mb-3 text-critical">Universe Ended</Eyebrow>

        {/* The cinematic's title, so the card names the same death the player
            just watched rather than echoing a kebab-case enum at them. */}
        <h2 className="font-sans text-2xl text-ink font-light tracking-wide mb-2">
          {scene.title}
        </h2>
        <p className="text-ink-dim mb-8 font-mono text-xs leading-relaxed">
          {universe?.endReason || universe?.endCondition?.replace(/-/g, ' ') || 'Unknown end condition'}
        </p>

        {/* What ascended comes FIRST and by name. It's the only thing that was
            ever meant to outlast the universe it happened in - burying it under
            galaxy counts was telling the player it mattered least. */}
        {c.ascended?.length > 0 && (
          <div className="mb-6 border border-accent/40 bg-accent/5 p-5 text-left">
            <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-accent/80 mb-2.5">
              {c.ascended.length === 1 ? 'A people outlived it' : 'Peoples outlived it'}
            </div>
            {c.ascended.map((a) => (
              <div key={a.civId} className="font-sans text-[15px] text-ink leading-snug">
                {a.designation || a.civId}
              </div>
            ))}
            <p className="font-mono text-[10px] text-ink-faint mt-2.5 leading-relaxed">
              They reached the stars while you were keeping this place. That
              does not unhappen.
            </p>
          </div>
        )}

        <div className="mb-8 font-mono text-sm text-left border border-line bg-void-raised px-5 py-2">
          <Group title="The cosmos">
            <Row label="Final age" value={`${c.finalAgeGyr} Gyr`} />
            <Row label="Galaxies" value={big(c.galaxies)} />
            <Row label="Stars" value={big(c.stars)} />
          </Group>

          <Group title="The living">
            <Row label="Peoples met" value={c.civilizationsMet ?? 0} />
            <Row
              label="Lost on your watch"
              value={c.civilizationsLost ?? 0}
              tone={c.civilizationsLost ? 'text-critical' : 'text-ink'}
            />
            <Row
              label="Saved by your hand"
              value={c.civilizationsRescued ?? 0}
              tone={c.civilizationsRescued ? 'text-good' : 'text-ink'}
            />
          </Group>

          <Group title="Your work">
            <Row label="Anomalies contained" value={c.anomaliesResolved ?? 0} tone="text-accent" />
            <Row label="Interventions" value={c.interventions ?? 0} tone="text-good" />
            <Row label="Discoveries" value={c.discoveries ?? 0} />
            <Row label="Research earned" value={(c.researchEarned ?? 0).toLocaleString()} />
          </Group>
        </div>

        <Button onClick={onReturn}>Return to Dashboard</Button>
      </motion.div>
    </div>
  );
};

export default UniverseEndPanel;

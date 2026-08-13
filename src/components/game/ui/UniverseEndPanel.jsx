// src/components/game/ui/UniverseEndPanel.jsx
//
// The epitaph card: what this universe was, once it stopped being one.
//
// Lifted out of GameplayPage's render (where it was an inline early-return)
// so the ended state can be a SEQUENCE - cinematic, then this - instead of a
// hard cut from gameplay to a stats table. It resolves out of the colour the
// cinematic faded to, so the handoff reads as one continuous moment.
import { motion } from 'framer-motion';
import { Button, Eyebrow } from '../../ui/primitives';
import { sceneFor } from '../content/universeEnds';

const Row = ({ label, value, tone = 'text-ink' }) => (
  <div className="flex justify-between">
    <span className="text-ink-faint">{label}</span>
    <span className={`${tone} tabular-nums`}>{value}</span>
  </div>
);

export const UniverseEndPanel = ({ universe, onReturn }) => {
  const cs = universe?.currentState || {};
  const scene = sceneFor(universe?.endCondition);
  const stars = cs.starCount ? `${(cs.starCount / 1e9).toFixed(2)} Billion` : '0';
  const resolved = universe?.anomalies?.filter((a) => a.resolved).length || 0;

  return (
    <div className="w-full h-full bg-void flex items-center justify-center">
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

        <div className="space-y-2.5 mb-8 font-mono text-sm text-left border border-line bg-void-raised p-5">
          <Row label="Final Age" value={`${((cs.age || 0) / 1e9).toFixed(2)} Gyr`} />
          <Row label="Galaxies" value={(cs.galaxyCount || 0).toLocaleString()} />
          <Row label="Stars" value={stars} />
          <Row label="Civilizations" value={(universe?.civilizations || []).length} />
          <Row
            label="Player Interventions"
            value={universe?.metrics?.playerInterventions || 0}
            tone="text-good"
          />
          <Row label="Anomalies Resolved" value={resolved} tone="text-accent" />
        </div>

        <Button onClick={onReturn}>Return to Dashboard</Button>
      </motion.div>
    </div>
  );
};

export default UniverseEndPanel;

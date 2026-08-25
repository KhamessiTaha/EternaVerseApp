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
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Eyebrow } from '../../ui/primitives';
import { sceneFor } from '../content/universeEnds';
import { downloadDeathCard } from './deathCard';
import { getSeedLeaderboard } from '../../../api/universeApi';

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
  if (universe?.chronicle) {
    // Heal one field. Chronicles written before the fix counted contained
    // anomalies by filtering universe.anomalies, which is pruned as the sim
    // runs and never held minor anomalies at all - so they froze a 0 for
    // players who had contained dozens. metrics.anomaliesResolved is monotonic
    // and still on the document, so an already-ended universe can be repaired
    // at read time instead of needing a migration.
    const counted = universe.metrics?.anomaliesResolved || 0;
    return {
      ...universe.chronicle,
      anomaliesResolved: Math.max(universe.chronicle.anomaliesResolved || 0, counted),
    };
  }

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
    // metrics, not a filter over universe.anomalies: resolved anomalies get
    // pruned as the sim runs, and minor anomalies never enter that array at
    // all. Filtering it reported 0 to players who had contained dozens.
    anomaliesResolved: universe?.metrics?.anomaliesResolved || 0,
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

/** "3rd" - the word the player actually reads. */
const ordinal = (n) => {
  if (!Number.isFinite(n) || n < 1) return null;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const UniverseEndPanel = ({ universe, onReturn }) => {
  const [copied, setCopied] = useState(false);
  const [board, setBoard] = useState([]);
  const scene = sceneFor(universe?.endCondition);
  const c = summarise(universe);

  // The board for this seed. Fetched rather than passed in, because the run
  // this universe just contributed is written server-side as it ends.
  const code = c.shareCode;
  useEffect(() => {
    if (!code || c.shareCodeReproducible === false) return;
    let live = true;
    getSeedLeaderboard(code).then((rows) => { if (live) setBoard(rows || []); });
    return () => { live = false; };
  }, [code, c.shareCodeReproducible]);

  const myPlace = board.find((r) => r.isYou)?.place ?? null;

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

        {/* Same cosmos, different wardens. Only rendered when someone else has
            actually played this seed - a board of one is just your own row,
            and showing it would make the feature feel empty rather than new. */}
        {board.length > 1 && (
          <div className="mb-6 border border-line bg-void-raised text-left">
            <div className="px-4 py-2.5 border-b border-line">
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-faint">
                Wardens of {c.shareCode}
              </div>
              {myPlace && (
                <div className="font-mono text-[11px] text-accent mt-0.5">
                  You placed {ordinal(myPlace)} of {board.length}
                </div>
              )}
            </div>
            {board.slice(0, 5).map((r) => (
              <div
                key={r.universeId}
                className={`flex items-center gap-3 px-4 py-2 border-b border-line/40 last:border-0 font-mono text-[11px] ${
                  r.isYou ? 'bg-accent/10' : ''
                }`}
              >
                <span className="w-6 text-ink-faint tabular-nums">{r.place}</span>
                <span className={`flex-1 truncate ${r.isYou ? 'text-accent' : 'text-ink'}`}>
                  {r.username}
                </span>
                <span className="text-ink-dim tabular-nums shrink-0">
                  {r.ascensions > 0 && <span className="text-good">{r.ascensions}↑ </span>}
                  {r.rescued > 0 && <span className="text-good">{r.rescued} saved · </span>}
                  {r.finalAgeGyr} Gyr
                </span>
              </div>
            ))}
            <div className="px-4 py-2 font-mono text-[9px] text-ink-faint leading-relaxed">
              Ranked by species raised to Type III, then worlds saved, then how
              long you held it together.
            </div>
          </div>
        )}

        {/* The invitation. A universe nobody can replay is a story that ends
            with you; a code turns it into something you can hand over. */}
        {c.shareCode && (
          <div className="mb-6 border border-accent/40 bg-accent/5 p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-accent/80 mb-1.5">
              This universe
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-2xl text-accent tracking-[0.15em]">
                {c.shareCode}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(c.shareCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="font-mono text-[10px] uppercase tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-2.5 py-1 transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="font-mono text-[10px] text-ink-faint mt-2 leading-relaxed">
              {c.shareCodeReproducible === false
                ? 'This universe predates share codes — the code identifies it, but will not rebuild it.'
                : 'Anyone who starts a universe with this code gets the same cosmos you did.'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <Button onClick={onReturn}>Return to Dashboard</Button>
          <button
            onClick={() => downloadDeathCard(universe)}
            className="font-mono text-[11px] tracking-wider uppercase text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-4 py-2 transition-colors"
          >
            Save death card
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default UniverseEndPanel;

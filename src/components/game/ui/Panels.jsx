import { formatNumber } from '../utils';
import { getStabilityColorKey, getCosmicPhaseLabel, formatTrend } from './statusHelpers';
import { StatLine, Meter, StatusPill, SectionTitle, Key, icons } from './primitives';

const STATUS_COLOR = { running: 'good', paused: 'warn', ended: 'critical' };

export const PrimaryInstrument = ({ universe }) => {
  const cs = universe?.currentState;
  if (!cs) return null;

  const status = universe?.status || 'running';
  const ageGyr = ((cs.age || 0) / 1e9).toFixed(3);
  const stability = (cs.stabilityIndex ?? 1) * 100;
  const cosmicHealth = (universe?.metrics?.cosmicHealth ?? 0) * 100;

  return (
    <div className="w-64 font-mono pointer-events-auto">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-sans text-[13px] font-medium text-ink tracking-wide truncate">
          {universe?.name || 'UNKNOWN'}
        </span>
        <StatusPill label={status} color={STATUS_COLOR[status] || 'good'} />
      </div>
      <div className="text-[10px] text-ink-faint uppercase tracking-wider mb-3.5">
        {getCosmicPhaseLabel(cs.cosmicPhase)} · {universe?.difficulty || ''}
      </div>

      <div className="mb-3">
        <div className="text-[34px] font-medium leading-none tabular-nums text-ink">
          {ageGyr}
          <span className="text-[15px] text-ink-faint ml-1.5">Gyr</span>
        </div>
        <div className="text-[9px] tracking-wider uppercase text-ink-faint mt-1.5">Universe Age</div>
      </div>

      <Meter label="Stability" value={stability} color={getStabilityColorKey(universe)} />
      <Meter label="Cosmic Hlth" value={cosmicHealth} color="good" />
    </div>
  );
};

const ConsoleSection = ({ icon, title, children }) => (
  <div className="border-b border-line last:border-b-0 px-3.5 py-3">
    <SectionTitle icon={icon}>{title}</SectionTitle>
    <div>{children}</div>
  </div>
);

export const Console = ({ universe, stats }) => {
  const cs = universe?.currentState;
  if (!cs) return null;

  const civs = universe?.civilizations || [];
  const activeCivs = civs.filter((c) => !c.extinct).length;
  const advancedCivs = civs.filter((c) => !c.extinct && c.type !== 'Type0').length;
  const civsCreated = cs.civilizationsCreated || 0;
  const civsExtinct = cs.civilizationsExtinct || 0;
  const activeBackendAnomalies = universe?.anomalies?.filter((a) => !a.resolved).length || 0;

  return (
    <div className="w-60 bg-void-raised/70 backdrop-blur-sm border border-line pointer-events-auto">
      <ConsoleSection icon={icons.structures} title="Structures">
        <StatLine label="Galaxies" value={formatNumber(cs.galaxyCount)} />
        <StatLine label="Stars" value={formatNumber(cs.starCount)} />
        <StatLine label="Black Holes" value={formatNumber(cs.blackHoleCount)} />
        <StatLine label="Metallicity" value={`${((cs.metallicity ?? 0) * 100).toFixed(1)}%`} />
      </ConsoleSection>

      <ConsoleSection icon={icons.vitals} title="Cosmic Vitals">
        <StatLine label="Expansion" value={`${(cs.expansionRate ?? 0).toFixed(2)} km/s/Mpc`} />
        <StatLine label="Entropy" value={formatNumber(cs.entropy)} />
        <StatLine label="Energy" value={`${((cs.energyBudget ?? 1) * 100).toFixed(1)}%`} />
        <StatLine
          label="Trend"
          value={formatTrend(universe?.metrics?.stabilityTrend)}
          valueClass="text-ink-dim text-[10px]"
        />
      </ConsoleSection>

      {(cs.lifeBearingPlanetsCount > 0 || activeCivs > 0 || civsCreated > 0) && (
        <ConsoleSection icon={icons.life} title="Life & Civilization">
          <StatLine label="Habitable" value={formatNumber(cs.habitableSystemsCount)} />
          <StatLine label="Life-Bearing" value={formatNumber(cs.lifeBearingPlanetsCount)} />
          {activeCivs > 0 && (
            <StatLine
              label="Civilizations"
              value={advancedCivs > 0 ? `${activeCivs} active · ${advancedCivs} adv.` : `${activeCivs} active`}
            />
          )}
          {civsCreated > 0 && (
            <StatLine
              label="Lifetime"
              value={`${civsCreated} risen · ${civsExtinct} extinct`}
              valueClass="text-ink-dim text-[10px]"
            />
          )}
        </ConsoleSection>
      )}

      {stats && (stats.discovered > 0 || activeBackendAnomalies > 0 || (universe?.research?.points ?? 0) > 0) && (
        <ConsoleSection icon={icons.mission} title="Mission">
          <StatLine label="Research" value={`${universe?.research?.points ?? 0} RP`} valueClass="text-accent" />
          <StatLine label="Discovered" value={stats.discovered} />
          <StatLine label="Resolved" value={stats.resolved} />
          <StatLine label="Backend Active" value={activeBackendAnomalies} valueClass="text-warn" />
        </ConsoleSection>
      )}
    </div>
  );
};

export const ControlsHint = () => (
  <div className="text-[10px] text-ink-faint text-right leading-loose font-mono pointer-events-auto select-none">
    <div><Key>F</Key>resolve anomaly</div>
    <div><Key>V</Key>scan object</div>
    <div><Key>C</Key>codex</div>
    <div><Key>U</Key>outfitting</div>
    <div><Key>L</Key>chronicle</div>
    <div><Key>M</Key>full map</div>
    <div><Key>SHIFT</Key>boost</div>
    <div><Key>ESC</Key>settings</div>
  </div>
);

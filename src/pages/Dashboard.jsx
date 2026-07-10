import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getUserUniverses, deleteUniverse } from "../api/universeApi";
import {
  AlertCircle, Plus, Loader2, Trash2, RefreshCw,
  Clock, Globe, Star, Activity, Users, Trophy
} from "lucide-react";
import { Button, Panel, Eyebrow } from "../components/ui/primitives";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/ToastProvider";
import { AchievementsPanel } from "../components/ui/AchievementsPanel";

const DIFFICULTY_COLOR = {
  Beginner: 'text-good border-good/30',
  Intermediate: 'text-warn border-warn/30',
  Advanced: 'text-critical border-critical/30',
};

const STATUS_CONFIG = {
  running: { dot: 'bg-good', pulse: true, text: 'Active' },
  paused: { dot: 'bg-warn', pulse: false, text: 'Paused' },
  ended: { dot: 'bg-ink-faint', pulse: false, text: 'Ended' },
  default: { dot: 'bg-ink-faint', pulse: false, text: 'Unknown' },
};

const STAT_CARDS = [
  { icon: Globe, label: "Active Universes", key: 'activeUniverses' },
  { icon: Star, label: "Total Galaxies", key: 'totalGalaxies' },
  { icon: Users, label: "Civilizations", key: 'totalCivs' },
  { icon: Activity, label: "Avg Stability", key: 'avgStability' },
];

const formatNumber = (num) => {
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
};

const getStabilityColor = (stability) => {
  if (stability > 70) return { text: 'text-good', bar: 'bg-good' };
  if (stability > 40) return { text: 'text-warn', bar: 'bg-warn' };
  return { text: 'text-critical', bar: 'bg-critical' };
};

const ErrorAlert = React.memo(({ children }) => (
  <div className="border border-critical/40 bg-void px-4 py-3 text-sm text-critical flex items-center gap-2.5">
    <AlertCircle className="h-4 w-4 flex-shrink-0" />
    <div>{children}</div>
  </div>
));
ErrorAlert.displayName = 'ErrorAlert';

const StatsOverview = React.memo(({ universes }) => {
  const stats = useMemo(() => {
    const totalGalaxies = universes.reduce((sum, u) => sum + (u.currentState?.galaxyCount || 0), 0);
    const totalCivs = universes.reduce((sum, u) => sum + (u.currentState?.civilizationCount || 0), 0);
    const activeUniverses = universes.filter(u => u.status === 'running').length;
    const avgStability = universes.length > 0
      ? universes.reduce((sum, u) => sum + (u.currentState?.stabilityIndex || 0), 0) / universes.length
      : 0;

    return {
      totalGalaxies: formatNumber(totalGalaxies),
      totalCivs,
      activeUniverses,
      avgStability: `${(avgStability * 100).toFixed(1)}%`
    };
  }, [universes]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line mb-8">
      {STAT_CARDS.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.key} className="bg-void-raised p-4 flex items-center gap-3">
            <Icon size={18} className="text-accent flex-shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-ink-faint text-[10px] font-mono uppercase tracking-wider">{stat.label}</p>
              <p className="text-ink text-lg font-mono font-semibold tabular-nums">{stats[stat.key]}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
});
StatsOverview.displayName = 'StatsOverview';

const StatLine = React.memo(({ icon: Icon, label, value }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={11} className="text-ink-faint" strokeWidth={1.5} />
      <span className="text-[10px] text-ink-faint font-mono uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-ink font-mono text-sm tabular-nums">{value}</p>
  </div>
));
StatLine.displayName = 'StatLine';

const UniverseCard = React.memo(({ universe, onRequestDelete, onView, isDeleting }) => {
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    onRequestDelete(universe);
  }, [universe, onRequestDelete]);

  const statusConfig = STATUS_CONFIG[universe.status?.toLowerCase()] || STATUS_CONFIG.default;
  const stability = (universe.currentState?.stabilityIndex || 0) * 100;
  const age = (universe.currentState?.age || 0) / 1e9;
  const galaxyCount = universe.currentState?.galaxyCount || 0;
  const starCount = universe.currentState?.starCount || 0;
  const civCount = universe.currentState?.civilizationCount || 0;
  const stabilityColor = getStabilityColor(stability);

  return (
    <Panel className="p-6 hover:border-line-bright transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-lg font-semibold text-ink mb-2 truncate">{universe.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border ${
              DIFFICULTY_COLOR[universe.difficulty] || 'text-ink-faint border-line'
            }`}>
              {universe.difficulty || 'N/A'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`w-[6px] h-[6px] rounded-full ${statusConfig.dot} ${statusConfig.pulse ? 'animate-pulse' : ''}`} />
              <span className="text-[11px] text-ink-faint font-mono">{statusConfig.text}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex justify-between text-[11px] font-mono mb-1.5">
          <span className="text-ink-faint uppercase tracking-wider">Stability</span>
          <span className={stabilityColor.text}>{stability.toFixed(1)}%</span>
        </div>
        <div className="h-[3px] bg-line overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${stabilityColor.bar}`}
            style={{ width: `${stability}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatLine icon={Clock} label="Age" value={`${age.toFixed(2)} Gyr`} />
        <StatLine icon={Globe} label="Galaxies" value={formatNumber(galaxyCount)} />
        <StatLine icon={Star} label="Stars" value={starCount ? `${(starCount / 1e9).toFixed(1)}B` : '0'} />
        <StatLine icon={Users} label="Civilizations" value={civCount} />
      </div>

      <div className="flex gap-2">
        <Button onClick={onView} className="flex-1">
          Enter Universe
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3"
          title="Delete universe"
          aria-label="Delete universe"
        >
          {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        </Button>
      </div>
    </Panel>
  );
});
UniverseCard.displayName = 'UniverseCard';

const LoadingState = () => (
  <div className="min-h-screen bg-void text-ink flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Loader2 size={32} className="animate-spin text-accent" />
      <span className="text-ink-dim font-mono text-sm">Loading your universes...</span>
    </div>
  </div>
);

const EmptyState = React.memo(({ hasFilters, onCreateClick }) => (
  <div className="col-span-full text-center py-20 border border-dashed border-line">
    <div className="flex flex-col items-center gap-6">
      <Plus size={32} className="text-ink-faint" strokeWidth={1.5} />
      <div>
        <p className="text-ink text-lg font-sans font-semibold mb-1.5">
          {hasFilters ? 'No universes match your filters' : 'No universes found'}
        </p>
        <p className="text-ink-faint text-sm">
          {hasFilters
            ? 'Try adjusting your filters'
            : 'Start your cosmic journey by creating your first universe'}
        </p>
      </div>
      {!hasFilters && (
        <Button onClick={onCreateClick}>
          Create Your First Universe
        </Button>
      )}
    </div>
  </div>
));
EmptyState.displayName = 'EmptyState';

const selectClass = "bg-void border border-line px-4 py-2.5 focus:outline-none focus:border-accent transition-colors text-sm text-ink font-mono";

const Dashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [universes, setUniverses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // universe awaiting confirmation
  const [deletingId, setDeletingId] = useState(null);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);

  const fetchUniverses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUserUniverses();
      setUniverses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch universes:", err);
      setError(err.response?.data?.message || "Failed to fetch universes. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUniverses();
  }, [fetchUniverses]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchUniverses();
    setIsRefreshing(false);
  }, [fetchUniverses]);

  const confirmDelete = useCallback(async () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    setDeletingId(target._id);
    try {
      await deleteUniverse(target._id);
      setUniverses(prev => prev.filter((u) => u._id !== target._id));
      setError(null);
      toast(`Universe "${target.name}" deleted`, 'success');
    } catch (err) {
      console.error("Failed to delete universe:", err);
      toast(err.response?.data?.message || "Failed to delete universe - try again", 'error');
    } finally {
      setDeletingId(null);
    }
  }, [pendingDelete, toast]);

  const handleViewUniverse = useCallback((id) => {
    navigate(`/gameplay/${id}`);
  }, [navigate]);

  const handleCreateUniverse = useCallback(() => {
    navigate("/universe-creation");
  }, [navigate]);

  const sortedAndFilteredUniverses = useMemo(() => {
    let filtered = universes;

    if (filterDifficulty !== 'all') {
      filtered = filtered.filter(u => u.difficulty === filterDifficulty);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => u.status === filterStatus);
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'age':
          return (b.currentState?.age || 0) - (a.currentState?.age || 0);
        case 'galaxies':
          return (b.currentState?.galaxyCount || 0) - (a.currentState?.galaxyCount || 0);
        case 'civilizations':
          return (b.currentState?.civilizationCount || 0) - (a.currentState?.civilizationCount || 0);
        case 'stability':
          return (b.currentState?.stabilityIndex || 0) - (a.currentState?.stabilityIndex || 0);
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [universes, sortBy, filterDifficulty, filterStatus]);

  const hasActiveFilters = filterDifficulty !== 'all' || filterStatus !== 'all';

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-void text-ink p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <Eyebrow className="mb-2">Mission Control</Eyebrow>
            <h2 className="font-sans text-3xl sm:text-4xl font-semibold text-ink mb-1.5">
              Your Universes
            </h2>
            <p className="text-ink-faint text-sm font-mono">
              {universes.length} {universes.length === 1 ? 'universe' : 'universes'} created
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsAchievementsOpen(true)}
              title="Achievements"
              aria-label="Achievements"
            >
              <Trophy size={16} />
              <span className="hidden sm:inline">Achievements</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh universes"
              aria-label="Refresh universes"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={handleCreateUniverse}>
              <Plus size={16} />
              <span>Create Universe</span>
            </Button>
          </div>
        </div>

        <AchievementsPanel isOpen={isAchievementsOpen} onClose={() => setIsAchievementsOpen(false)} />

        {universes.length > 0 && <StatsOverview universes={universes} />}

        {error && (
          <div className="mb-6">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}

        {universes.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectClass} aria-label="Sort universes">
              <option value="name">Sort by Name</option>
              <option value="age">Sort by Age</option>
              <option value="galaxies">Sort by Galaxies</option>
              <option value="civilizations">Sort by Civilizations</option>
              <option value="stability">Sort by Stability</option>
              <option value="status">Sort by Status</option>
            </select>

            <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)} className={selectClass} aria-label="Filter by difficulty">
              <option value="all">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass} aria-label="Filter by status">
              <option value="all">All Statuses</option>
              <option value="running">Active</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAndFilteredUniverses.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} onCreateClick={handleCreateUniverse} />
          ) : (
            sortedAndFilteredUniverses.map((universe) => (
              <UniverseCard
                key={universe._id}
                universe={universe}
                onRequestDelete={setPendingDelete}
                onView={() => handleViewUniverse(universe._id)}
                isDeleting={deletingId === universe._id}
              />
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        danger
        title={`Delete "${pendingDelete?.name}"?`}
        message="The universe, its history, discoveries, and civilizations will be erased. This action cannot be undone."
        confirmLabel="Delete Universe"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default Dashboard;

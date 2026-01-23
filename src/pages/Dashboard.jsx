import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getUserUniverses, deleteUniverse } from "../api/universeApi";
import { 
  AlertCircle, Plus, Loader2, Trash2, Rocket, RefreshCw, 
  Sparkles, Clock, Globe, Star, Activity, Users, Award
} from "lucide-react";
import NavHeader from "../components/NavHeader";

// Constants
const DIFFICULTY_COLORS = {
  Beginner: 'text-green-400 bg-green-500/10 border-green-500/30',
  Intermediate: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  Advanced: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const STATUS_CONFIGS = {
  running: { color: 'bg-green-500', glow: 'shadow-green-500/50', text: 'Active', pulse: true },
  paused: { color: 'bg-yellow-500', glow: 'shadow-yellow-500/50', text: 'Paused', pulse: false },
  ended: { color: 'bg-red-500', glow: 'shadow-red-500/50', text: 'Ended', pulse: false },
  default: { color: 'bg-gray-500', glow: 'shadow-gray-500/50', text: 'Unknown', pulse: false },
};

const STAT_CARDS = [
  { 
    icon: Globe, 
    label: "Active Universes", 
    key: 'activeUniverses',
    color: "from-cyan-500 to-blue-500",
    bgGlow: "shadow-cyan-500/20"
  },
  { 
    icon: Sparkles, 
    label: "Total Galaxies", 
    key: 'totalGalaxies',
    color: "from-purple-500 to-pink-500",
    bgGlow: "shadow-purple-500/20"
  },
  { 
    icon: Users, 
    label: "Civilizations", 
    key: 'totalCivs',
    color: "from-green-500 to-emerald-500",
    bgGlow: "shadow-green-500/20"
  },
  { 
    icon: Activity, 
    label: "Avg Stability", 
    key: 'avgStability',
    color: "from-orange-500 to-red-500",
    bgGlow: "shadow-orange-500/20"
  },
];

// Utility functions
const formatNumber = (num) => {
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
};

const getStabilityColor = (stability) => {
  if (stability > 70) return 'text-green-400 bg-gradient-to-r from-green-500 to-emerald-500';
  if (stability > 40) return 'text-yellow-400 bg-gradient-to-r from-yellow-500 to-orange-500';
  return 'text-red-400 bg-gradient-to-r from-red-500 to-pink-500';
};

// Alert Component
const Alert = React.memo(({ children, variant = "error" }) => {
  const styles = variant === "error" 
    ? "bg-red-500/10 border-red-500/50 text-red-500"
    : "bg-blue-500/10 border-blue-500/50 text-blue-500";
  
  return (
    <div className={`${styles} border rounded-lg p-4 flex items-center gap-2 animate-in fade-in duration-300`}>
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
});

Alert.displayName = 'Alert';

// Stats Overview Component
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {STAT_CARDS.map((stat) => {
        const Icon = stat.icon;
        return (
          <div 
            key={stat.key} 
            className={`bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:scale-105 transition-all duration-300 shadow-lg ${stat.bgGlow}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg bg-gradient-to-br ${stat.color}`}>
                <Icon size={20} className="text-white" />
              </div>
              <div>
                <p className="text-gray-400 text-xs font-medium">{stat.label}</p>
                <p className="text-white text-lg font-bold">{stats[stat.key]}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

StatsOverview.displayName = 'StatsOverview';

// Universe Card Component
const UniverseCard = React.memo(({ universe, onDelete, onView }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = useCallback(async (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${universe.name}"? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await onDelete(universe._id);
      } catch (error) {
        console.error("Delete failed:", error);
        setIsDeleting(false);
      }
    }
  }, [universe._id, universe.name, onDelete]);

  const statusConfig = STATUS_CONFIGS[universe.status?.toLowerCase()] || STATUS_CONFIGS.default;
  const stability = (universe.currentState?.stabilityIndex || 0) * 100;
  const age = (universe.currentState?.age || 0) / 1e9;
  const milestones = universe.milestones ? Object.values(universe.milestones).filter(Boolean).length : 0;
  const galaxyCount = universe.currentState?.galaxyCount || 0;
  const starCount = universe.currentState?.starCount || 0;
  const civCount = universe.currentState?.civilizationCount || 0;

  const stabilityColors = getStabilityColor(stability);

  return (
    <div 
      className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 transition-all duration-300 border-2 ${
        isHovered ? 'border-indigo-500 shadow-2xl shadow-indigo-500/30 scale-105' : 'border-gray-700'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white mb-2 truncate">{universe.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
              DIFFICULTY_COLORS[universe.difficulty] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'
            }`}>
              {universe.difficulty || 'N/A'}
            </span>
            <div className="flex items-center gap-1.5">
              <div className={`${statusConfig.color} w-2 h-2 rounded-full ${
                statusConfig.pulse ? 'animate-pulse' : ''
              } shadow-lg ${statusConfig.glow}`} />
              <span className="text-xs text-gray-400">{statusConfig.text}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stability Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">Stability</span>
          <span className={`font-semibold ${stabilityColors.split(' ')[0]}`}>
            {stability.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${stabilityColors.split(' ').slice(1).join(' ')}`}
            style={{ width: `${stability}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatItem icon={Clock} label="Age" value={`${age.toFixed(2)} Gyr`} color="text-cyan-400" />
        <StatItem icon={Globe} label="Galaxies" value={formatNumber(galaxyCount)} color="text-purple-400" />
        <StatItem 
          icon={Star} 
          label="Stars" 
          value={starCount ? `${(starCount / 1e9).toFixed(1)}B` : '0'} 
          color="text-yellow-400" 
        />
        <StatItem icon={Users} label="Civilizations" value={civCount} color="text-green-400" />
      </div>

      {/* Milestones */}
      {milestones > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-2">
          <Award size={16} className="text-yellow-400" />
          <span className="text-xs text-yellow-300 font-medium">
            {milestones} Milestone{milestones !== 1 ? 's' : ''} Achieved
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg font-semibold text-sm tracking-wide transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/30"
        >
          <Rocket size={16} />
          Enter Universe
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/80 hover:bg-red-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          title="Delete universe"
          aria-label="Delete universe"
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      </div>
    </div>
  );
});

UniverseCard.displayName = 'UniverseCard';

// Stat Item Component
const StatItem = React.memo(({ icon: Icon, label, value, color }) => (
  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={14} className={color} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
    <p className="text-white font-semibold text-sm">{value}</p>
  </div>
));

StatItem.displayName = 'StatItem';

// Loading State Component
const LoadingState = () => (
  <>
    <NavHeader />
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white p-8 pt-20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 size={48} className="animate-spin text-indigo-500" />
          <div className="absolute inset-0 blur-xl bg-indigo-500/30 animate-pulse" />
        </div>
        <span className="text-lg text-gray-300">Loading your universes...</span>
      </div>
    </div>
  </>
);

// Empty State Component
const EmptyState = React.memo(({ hasFilters, onCreateClick }) => (
  <div className="col-span-full text-center py-20 bg-gray-800/30 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-700">
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center opacity-20">
          <Plus size={40} />
        </div>
        <div className="absolute inset-0 blur-2xl bg-indigo-500/20 animate-pulse" />
      </div>
      <div>
        <p className="text-gray-300 text-xl font-semibold mb-2">
          {hasFilters ? 'No universes match your filters' : 'No universes found'}
        </p>
        <p className="text-gray-500 text-sm">
          {hasFilters 
            ? 'Try adjusting your filters' 
            : 'Start your cosmic journey by creating your first universe'}
        </p>
      </div>
      {!hasFilters && (
        <button
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-500/30 font-semibold"
        >
          <Sparkles size={20} />
          Create Your First Universe
        </button>
      )}
    </div>
  </div>
));

EmptyState.displayName = 'EmptyState';

// Main Dashboard Component
const Dashboard = () => {
  const navigate = useNavigate();
  const [universes, setUniverses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteUniverse(id);
      setUniverses(prev => prev.filter((u) => u._id !== id));
      setError(null);
    } catch (err) {
      console.error("Failed to delete universe:", err);
      setError(err.response?.data?.message || "Failed to delete universe. Please try again.");
    }
  }, []);

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
    <>
      <NavHeader />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white p-6 sm:p-8 pt-20">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Your Universes
              </h2>
              <p className="text-gray-400 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" />
                {universes.length} {universes.length === 1 ? 'universe' : 'universes'} created
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all border border-gray-700 disabled:opacity-50 hover:scale-105 active:scale-95"
                title="Refresh universes"
                aria-label="Refresh universes"
              >
                <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={handleCreateUniverse}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-500/30"
              >
                <Plus size={20} />
                <span className="font-semibold">Create Universe</span>
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          {universes.length > 0 && <StatsOverview universes={universes} />}

          {/* Error Alert */}
          {error && <Alert variant="error">{error}</Alert>}

          {/* Filters */}
          {universes.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                aria-label="Sort universes"
              >
                <option value="name">Sort by Name</option>
                <option value="age">Sort by Age</option>
                <option value="galaxies">Sort by Galaxies</option>
                <option value="civilizations">Sort by Civilizations</option>
                <option value="stability">Sort by Stability</option>
                <option value="status">Sort by Status</option>
              </select>

              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                aria-label="Filter by difficulty"
              >
                <option value="all">All Difficulties</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="running">Active</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
              </select>
            </div>
          )}

          {/* Universe Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedAndFilteredUniverses.length === 0 ? (
              <EmptyState hasFilters={hasActiveFilters} onCreateClick={handleCreateUniverse} />
            ) : (
              sortedAndFilteredUniverses.map((universe) => (
                <UniverseCard
                  key={universe._id}
                  universe={universe}
                  onDelete={handleDelete}
                  onView={() => handleViewUniverse(universe._id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
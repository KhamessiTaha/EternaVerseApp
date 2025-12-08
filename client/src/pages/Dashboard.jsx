import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getUserUniverses, deleteUniverse } from "../api/universeApi";
import { AlertCircle, Plus, Loader2, Trash2, Rocket, RefreshCw } from "lucide-react";

// Alert Component
const Alert = ({ children, variant = "error" }) => {
  const bgColor = variant === "error" ? "bg-red-500/10" : "bg-blue-500/10";
  const borderColor = variant === "error" ? "border-red-500/50" : "border-blue-500/50";
  const textColor = variant === "error" ? "text-red-500" : "text-blue-500";
  
  return (
    <div className={`${bgColor} ${borderColor} ${textColor} border rounded-lg p-4 flex items-center gap-2`}>
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
};

// Universe Card Component
const UniverseCard = ({ universe, onDelete, onView }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${universe.name}"? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await onDelete(universe._id);
      } catch (error) {
        console.error("Delete failed:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'ended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/10 border border-gray-700 hover:border-gray-600">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-white pr-2">{universe.name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{getStatusText(universe.status)}</span>
          <div className={`${getStatusColor(universe.status)} w-3 h-3 rounded-full`} title={getStatusText(universe.status)} />
        </div>
      </div>
      
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Difficulty:</span>
          <span className="text-gray-200 font-medium">{universe.difficulty || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Age:</span>
          <span className="text-gray-200">{(universe.currentState?.age || 0).toLocaleString()} years</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Galaxies:</span>
          <span className="text-gray-200">{(universe.currentState?.galaxyCount || 0).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Civilizations:</span>
          <span className="text-gray-200">{universe.currentState?.civilizationCount || 0}</span>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-md font-semibold tracking-wide transition-all hover:scale-105 active:scale-95"
        >
          <Rocket size={18} />
          Enter Universe
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          title="Delete universe"
        >
          {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
        </button>
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const navigate = useNavigate();
  const [universes, setUniverses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchUniverses();
  }, []);

  const fetchUniverses = async () => {
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
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUniverses();
    setIsRefreshing(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteUniverse(id);
      setUniverses(prev => prev.filter((u) => u._id !== id));
      setError(null);
    } catch (err) {
      console.error("Failed to delete universe:", err);
      setError(err.response?.data?.message || "Failed to delete universe. Please try again.");
    }
  };

  const sortedAndFilteredUniverses = useMemo(() => {
    let filtered = filterDifficulty === 'all' 
      ? universes 
      : universes.filter(u => u.difficulty === filterDifficulty);

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'age':
          return (b.currentState?.age || 0) - (a.currentState?.age || 0);
        case 'galaxies':
          return (b.currentState?.galaxyCount || 0) - (a.currentState?.galaxyCount || 0);
        case 'civilizations':
          return (b.currentState?.civilizationCount || 0) - (a.currentState?.civilizationCount || 0);
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [universes, sortBy, filterDifficulty]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8 pt-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="animate-spin text-indigo-500" />
          <span className="text-lg text-gray-300">Loading your universes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8 pt-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Your Universes
            </h2>
            <p className="text-gray-400 mt-2">
              {universes.length} {universes.length === 1 ? 'universe' : 'universes'} created
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
              title="Refresh universes"
            >
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => navigate("/universe-creation")}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20"
            >
              <Plus size={20} />
              Create Universe
            </button>
          </div>
        </div>

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="name">Sort by Name</option>
            <option value="age">Sort by Age</option>
            <option value="galaxies">Sort by Galaxy Count</option>
            <option value="civilizations">Sort by Civilizations</option>
            <option value="status">Sort by Status</option>
          </select>

          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="all">All Difficulties</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAndFilteredUniverses.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                  <Plus size={32} className="text-gray-500" />
                </div>
                <p className="text-gray-400 text-lg">
                  {filterDifficulty !== 'all' 
                    ? `No ${filterDifficulty.toLowerCase()} universes found` 
                    : 'No universes found'}
                </p>
                <button
                  onClick={() => navigate("/universe-creation")}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  <Plus size={20} />
                  Create Your First Universe
                </button>
              </div>
            </div>
          ) : (
            sortedAndFilteredUniverses.map((universe) => (
              <UniverseCard
                key={universe._id}
                universe={universe}
                onDelete={handleDelete}
                onView={() => navigate(`/gameplay/${universe._id}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
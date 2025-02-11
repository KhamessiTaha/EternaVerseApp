import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserUniverses, deleteUniverse } from "../api/universeApi";
import { AlertCircle, Plus, Loader2, Trash2, Eye } from "lucide-react";



// Simple Alert Component
const Alert = ({ children, variant = "error" }) => {
  const bgColor = variant === "error" ? "bg-red-500/10" : "bg-blue-500/10";
  const borderColor = variant === "error" ? "border-red-500/50" : "border-blue-500/50";
  const textColor = variant === "error" ? "text-red-500" : "text-blue-500";
  
  return (
    <div className={`${bgColor} ${borderColor} ${textColor} border rounded-lg p-4 flex items-center gap-2`}>
      <AlertCircle className="h-4 w-4" />
      <div>{children}</div>
    </div>
  );
};

const UniverseCard = ({ universe, onDelete, onView }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this universe?")) {
      setIsDeleting(true);
      await onDelete();
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'ended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 transition-all duration-200 hover:shadow-lg border border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold">{universe.name}</h3>
        <div className={`${getStatusColor(universe.status)} w-3 h-3 rounded-full`} />
      </div>
      
      <div className="space-y-2 mb-4">
        <p className="text-gray-400">Difficulty: {universe.difficulty}</p>
        <p className="text-gray-400">Age: {universe.currentState?.age?.toLocaleString() || 0} years</p>
        <p className="text-gray-400">Galaxies: {universe.currentState?.galaxyCount?.toLocaleString() || 0}</p>
        <p className="text-gray-400">Civilizations: {universe.currentState?.civilizationCount || 0}</p>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
        >
          <Eye size={18} />
          View
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50"
        >
          {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [universes, setUniverses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [filterDifficulty, setFilterDifficulty] = useState('all');

  useEffect(() => {
    fetchUniverses();
  }, []);

  const fetchUniverses = async () => {
    try {
      setLoading(true);
      const data = await getUserUniverses();
      setUniverses(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch universes. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUniverse(id);
      setUniverses(universes.filter((u) => u._id !== id));
    } catch (error) {
      setError("Failed to delete universe. Please try again.");
    }
  };

  const sortedAndFilteredUniverses = React.useMemo(() => {
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
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [universes, sortBy, filterDifficulty]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 pt-20 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin" />
          <span>Loading your universes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 pt-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-4xl font-bold">Your Universes</h2>
          <button
            onClick={() => navigate("/universe-creation")}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
          >
            <Plus size={20} />
            Create Universe
          </button>
        </div>

        {error && (
          <Alert className="mb-6">
            {error}
          </Alert>
        )}

        <div className="flex gap-4 mb-6">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            <option value="name">Sort by Name</option>
            <option value="age">Sort by Age</option>
            <option value="galaxies">Sort by Galaxy Count</option>
            <option value="civilizations">Sort by Civilizations</option>
          </select>

          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            <option value="all">All Difficulties</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAndFilteredUniverses.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-gray-800 rounded-lg">
              <p className="text-gray-400 text-lg mb-4">No universes found</p>
              <button
                onClick={() => navigate("/universe-creation")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              >
                <Plus size={20} />
                Create Your First Universe
              </button>
            </div>
          ) : (
            sortedAndFilteredUniverses.map((universe) => (
              <UniverseCard
                key={universe._id}
                universe={universe}
                onDelete={() => handleDelete(universe._id)}
                onView={() => navigate(`/simulation-dashboard/${universe._id}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
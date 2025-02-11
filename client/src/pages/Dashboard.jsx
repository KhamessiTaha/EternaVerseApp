import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserUniverses, deleteUniverse } from "../api/universeApi";

const Dashboard = () => {
  const navigate = useNavigate();
  const [universes, setUniverses] = useState([]);

  useEffect(() => {
    const fetchUniverses = async () => {
      try {
        const data = await getUserUniverses();
        setUniverses(data);
      } catch (error) {
        console.error("Error fetching universes:", error);
      }
    };
    fetchUniverses();
  }, []);

  const handleDelete = async (id) => {
    try {
      await deleteUniverse(id);
      setUniverses(universes.filter((u) => u._id !== id));
    } catch (error) {
      console.error("Failed to delete universe:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 pt-20">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl font-bold mb-2">Your Universes</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {universes.length === 0 ? (
            <p className="text-gray-400">No universes created yet.</p>
          ) : (
            universes.map((universe) => (
              <div key={universe._id} className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-xl font-semibold">{universe.name}</h3>
                <p className="text-gray-400">Difficulty: {universe.difficulty}</p>
                <p className="text-gray-400">Age: {universe.currentState?.age || 0} years</p>
                
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => navigate(`/simulation-dashboard/${universe._id}`)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(universe._id)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

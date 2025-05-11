import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const GameplayPage = () => {
  const { universeId } = useParams();
  const [universe, setUniverse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUniverse = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        
        if (!token) {
          setError("Authentication token not found. Please log in again.");
          // Redirect to login page if no token exists
          navigate("/login");
          return;
        }

        const res = await axios.get(
          `http://localhost:5000/api/universe/${universeId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
          }
        );
        
        setUniverse(res.data);
        setError(null);
      } catch (err) {
        console.error("Failed to load universe:", err);
        
        if (err.response) {
          // Server responded with an error
          if (err.response.status === 401) {
            setError("Session expired. Please log in again.");
            localStorage.removeItem("token"); // Clear invalid token
            navigate("/login");
          } else if (err.response.status === 400) {
            setError("Invalid request. Check your authentication.");
          } else if (err.response.status === 404) {
            setError("Universe not found.");
          } else {
            setError(`Error: ${err.response.data.message || "Something went wrong"}`);
          }
        } else if (err.request) {
          // Request made but no response received
          setError("Server not responding. Please try again later.");
        } else {
          // Error setting up the request
          setError(`Error: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUniverse();
  }, [universeId, navigate]);

  if (loading) return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl">Loading universe...</div>
    </div>
  );

  if (error) return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <div className="bg-red-900 bg-opacity-80 p-6 rounded text-white max-w-md">
        <h2 className="text-xl font-bold mb-4">Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => navigate("/")}
          className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  if (!universe) return null;

  return (
    <div className="w-screen h-screen bg-black text-white relative overflow-hidden">
      {/* HUD / Info Panel */}
      <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-80 p-4 rounded">
        <h2 className="text-xl font-bold">{universe.name}</h2>
        <p>Difficulty: {universe.difficulty}</p>
        <p>Age: {universe.currentState.age.toLocaleString()} years</p>
        <p>Galaxies: {Math.round(universe.currentState.galaxyCount).toLocaleString()}</p>
        <p>Civilizations: {Math.round(universe.currentState.civilizationCount)}</p>
        <p>Entropy: {universe.currentState.entropy.toFixed(4)}</p>
        <p>Stability Index: {universe.currentState.stabilityIndex.toFixed(3)}</p>
      </div>

      {/* Controls Panel */}
      <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-80 p-4 rounded">
        <button 
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-2"
          onClick={() => console.log("Progress simulation")}
        >
          Progress
        </button>
        <button 
          className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
          onClick={() => navigate("/")}
        >
          Exit
        </button>
      </div>

      {/* Placeholder for the simulation map */}
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        <p>🌀 Simulation canvas will go here...</p>
      </div>
    </div>
  );
};

export default GameplayPage;
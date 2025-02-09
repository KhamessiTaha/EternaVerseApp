import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const UniverseCreation = () => {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState("Beginner");
  const [params, setParams] = useState({
    gravity: 9.8,
    darkEnergy: 0.7,
    matterRatio: 50,
  });

  const handleChange = (e) => {
    setParams({ ...params, [e.target.name]: e.target.value });
  };

  const handleStartSimulation = () => {
    console.log("Starting simulation with:", { difficulty, params });
    navigate("/simulation-dashboard", { state: { difficulty, params } });
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <motion.div
        className="p-8 bg-gray-800 rounded-lg shadow-lg w-full max-w-lg"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <h2 className="text-3xl font-bold text-center mb-6">Create Your Universe</h2>

        {/* Difficulty Selection */}
        <label className="block mb-4">
          <span className="text-gray-300">Select Difficulty</span>
          <select
            name="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </label>

        {/* Universal Constants Inputs */}
        <div className="space-y-4">
          <label className="block">
            <span className="text-gray-300">Gravity Strength</span>
            <input
              type="number"
              name="gravity"
              value={params.gravity}
              onChange={handleChange}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-gray-300">Dark Energy Percentage</span>
            <input
              type="number"
              name="darkEnergy"
              value={params.darkEnergy}
              onChange={handleChange}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-gray-300">Matter-Antimatter Ratio (%)</span>
            <input
              type="number"
              name="matterRatio"
              value={params.matterRatio}
              onChange={handleChange}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>

        <button
          onClick={handleStartSimulation}
          className="w-full mt-6 py-3 text-lg font-semibold bg-blue-500 rounded-lg hover:bg-blue-600 transition-all"
        >
          Start Simulation
        </button>
      </motion.div>
    </div>
  );
};

export default UniverseCreation;

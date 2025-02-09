import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const SimulationDashboard = () => {
  const location = useLocation();
  const { difficulty, params } = location.state || { difficulty: "Beginner", params: {} };

  const [universeStats, setUniverseStats] = useState({
    age: 0,
    expansionRate: 1.0,
    entropy: 0.1,
    lifeProbability: 0.0,
  });

  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setUniverseStats((prevStats) => ({
        age: prevStats.age + 1,
        expansionRate: prevStats.expansionRate * 1.01,
        entropy: prevStats.entropy + 0.01,
        lifeProbability: Math.min(prevStats.lifeProbability + 0.005, 1.0),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <motion.h1 className="text-4xl font-bold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
        Universe Simulation - {difficulty} Mode
      </motion.h1>

      <div className="mt-8 grid grid-cols-2 gap-6 text-lg bg-gray-800 p-6 rounded-lg shadow-lg">
        <div><span className="text-gray-400">Age:</span> {universeStats.age} years</div>
        <div><span className="text-gray-400">Expansion Rate:</span> {universeStats.expansionRate.toFixed(2)}x</div>
        <div><span className="text-gray-400">Entropy:</span> {universeStats.entropy.toFixed(2)}</div>
        <div><span className="text-gray-400">Life Probability:</span> {(universeStats.lifeProbability * 100).toFixed(1)}%</div>
      </div>

      <div className="mt-6">
        <button
          onClick={() => setRunning(!running)}
          className={`px-6 py-3 text-lg font-semibold rounded-lg ${running ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
        >
          {running ? "Pause Simulation" : "Resume Simulation"}
        </button>
      </div>
    </div>
  );
};

export default SimulationDashboard;

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";

const SimulationDashboard = () => {
  const { id } = useParams();
  const [universe, setUniverse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(true);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [error, setError] = useState("");
  const [preBigBangConfig, setPreBigBangConfig] = useState({
    matterAntimatterRatio: 1.0000001,
    quantumFluctuations: 1e-5,
    cosmicInflationRate: 1.0,
    initialTemperature: 1e32,
    initialDensity: 1e97,
  });

  useEffect(() => {
    const fetchUniverse = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`http://localhost:5000/api/universe/${id}`, {
          headers: { Authorization: token },
        });
        setUniverse(response.data);
        setPreBigBangConfig(response.data.initialConditions);
      } catch (error) {
        console.error("Error fetching universe:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUniverse();
  }, [id]);

  const validateConditions = () => {
    if (preBigBangConfig.initialTemperature < 1e30 || preBigBangConfig.initialTemperature > 1e34) {
      return "Initial Temperature must be between 1e30 and 1e34 K to trigger a Big Bang.";
    }
    if (preBigBangConfig.initialDensity < 1e95 || preBigBangConfig.initialDensity > 1e99) {
      return "Initial Density must be between 1e95 and 1e99 kg/m³ to allow universe formation.";
    }
    if (preBigBangConfig.matterAntimatterRatio < 1.00000001 || preBigBangConfig.matterAntimatterRatio > 1.000001) {
      return "Matter-Antimatter Ratio must be within a small asymmetry range (1.00000001 - 1.000001).";
    }
    if (preBigBangConfig.quantumFluctuations < 1e-6 || preBigBangConfig.quantumFluctuations > 1e-4) {
      return "Quantum Fluctuations should be between 1e-6 and 1e-4 to allow structure formation.";
    }
    if (preBigBangConfig.cosmicInflationRate < 0.1 || preBigBangConfig.cosmicInflationRate > 10.0) {
      return "Cosmic Inflation Rate must be within 0.1 - 10.0 for a stable inflationary period.";
    }
    return "";
  };

  const handleStartSimulation = async () => {
    const validationError = validateConditions();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.put(`http://localhost:5000/api/universe/${id}`, 
        { initialConditions: preBigBangConfig }, 
        { headers: { Authorization: token } }
      );
      setSimulationStarted(true);
      setError("");
    } catch (error) {
      console.error("Error updating universe:", error);
    }
  };

  const progressUniverse = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `http://localhost:5000/api/universe/${id}/progress`,
        { timeStep: 10 }, // Progress by 10 million years per update
        { headers: { Authorization: token } }
      );
      setUniverse(response.data.universe);
    } catch (error) {
      console.error("Error progressing universe:", error);
    }
  };

  useEffect(() => {
    if (!running || !simulationStarted) return;
    const interval = setInterval(progressUniverse, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [running, simulationStarted]);

  const handleInputChange = (e) => {
    setPreBigBangConfig({ ...preBigBangConfig, [e.target.name]: parseFloat(e.target.value) });
  };

  const formatNumber = (num) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  if (loading) return <p className="text-white text-center">Loading universe data...</p>;
  if (!universe) return <p className="text-white text-center">Universe not found.</p>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
      <motion.h1 
        className="text-4xl font-bold" 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ duration: 1 }}
      >
        {universe.name} - {simulationStarted ? "Simulation Running" : `${universe.difficulty} Mode`}
      </motion.h1>

      {!simulationStarted ? (
        <div className="mt-6 bg-gray-800 p-6 rounded-lg shadow-lg text-white">
          <h2 className="text-2xl font-semibold mb-4">Set Pre-Big Bang Conditions</h2>
          {error && <p className="text-red-500 mb-4">{error}</p>}

          {Object.keys(preBigBangConfig).map((key) => (
            <label key={key} className="block mb-2">
              <span className="text-gray-300">{key.replace(/([A-Z])/g, " $1").trim()}</span>
              <input
                type="number"
                name={key}
                value={preBigBangConfig[key]}
                onChange={handleInputChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"
              />
            </label>
          ))}

          <button 
            onClick={handleStartSimulation} 
            className="w-full py-3 text-lg font-semibold bg-green-500 rounded-lg hover:bg-green-600"
          >
            Start Big Bang
          </button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-3 gap-6 text-lg bg-gray-800 p-6 rounded-lg shadow-lg max-w-6xl w-full">
            {/* Time and Physics */}
            <div className="col-span-3 bg-gray-700 p-4 rounded-lg mb-4">
              <h3 className="text-xl font-semibold mb-3 text-blue-300">Universal Constants</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><span className="text-gray-400">Age:</span> {formatNumber(universe.currentState.age)} MY</div>
                <div><span className="text-gray-400">Time Dilation:</span> {universe.currentState.timeDialation.toFixed(2)}x</div>
                <div><span className="text-gray-400">Stability Index:</span> {universe.currentState.stabilityIndex.toFixed(2)}</div>
              </div>
            </div>

            {/* Physical Properties */}
            <div className="col-span-3 bg-gray-700 p-4 rounded-lg mb-4">
              <h3 className="text-xl font-semibold mb-3 text-green-300">Physical Properties</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><span className="text-gray-400">Temperature:</span> {formatNumber(universe.currentState.temperature)}K</div>
                <div><span className="text-gray-400">Expansion Rate:</span> {universe.currentState.expansionRate.toFixed(2)}c</div>
                <div><span className="text-gray-400">Entropy:</span> {formatNumber(universe.currentState.entropy)}</div>
              </div>
            </div>

            {/* Cosmic Structure */}
            <div className="col-span-3 bg-gray-700 p-4 rounded-lg mb-4">
              <h3 className="text-xl font-semibold mb-3 text-purple-300">Cosmic Structure</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><span className="text-gray-400">Galaxies:</span> {formatNumber(universe.currentState.galaxyCount)}</div>
                <div><span className="text-gray-400">Stars:</span> {formatNumber(universe.currentState.starCount)}</div>
                <div><span className="text-gray-400">Black Holes:</span> {formatNumber(universe.currentState.blackHoleCount)}</div>
              </div>
            </div>

            {/* Life and Civilization */}
            <div className="col-span-3 bg-gray-700 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-3 text-yellow-300">Life Development</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><span className="text-gray-400">Habitable Systems:</span> {formatNumber(universe.currentState.habitableSystemsCount)}</div>
                <div><span className="text-gray-400">Life-Bearing Planets:</span> {formatNumber(universe.currentState.lifeBearingPlanetsCount)}</div>
                <div><span className="text-gray-400">Civilizations:</span> {formatNumber(universe.currentState.civilizationCount)}</div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => setRunning(!running)}
              className={`px-6 py-3 text-lg font-semibold rounded-lg ${running ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
            >
              {running ? "Pause Simulation" : "Resume Simulation"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SimulationDashboard;
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";

const SimulationDashboard = () => {
  const { id } = useParams();
  const [universe, setUniverse] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const handleInputChange = (e) => {
    setPreBigBangConfig({ ...preBigBangConfig, [e.target.name]: parseFloat(e.target.value) });
  };

  if (loading) return <p className="text-white text-center">Loading universe data...</p>;
  if (!universe) return <p className="text-white text-center">Universe not found.</p>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
      <motion.h1 className="text-4xl font-bold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
        {universe.name} - {universe.difficulty} Mode
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

          <button onClick={handleStartSimulation} className="w-full py-3 text-lg font-semibold bg-green-500 rounded-lg hover:bg-green-600">
            Start Big Bang
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-6 text-lg bg-gray-800 p-6 rounded-lg shadow-lg">
          <div><span className="text-gray-400">Age:</span> {universe.currentState?.age || 0} years</div>
          <div><span className="text-gray-400">Expansion Rate:</span> {universe.currentState?.expansionRate.toFixed(2)}x</div>
          <div><span className="text-gray-400">Entropy:</span> {universe.currentState?.entropy.toFixed(2)}</div>
          <div><span className="text-gray-400">Life Probability:</span> {(universe.currentState?.lifeProbability * 100).toFixed(1)}%</div>
        </div>
      )}
    </div>
  );
};

export default SimulationDashboard;
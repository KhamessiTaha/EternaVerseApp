import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUniverse } from "../api/universeApi";

const UniverseCreation = () => {
  const navigate = useNavigate();
  const [universeData, setUniverseData] = useState({
    name: "",
    seed: Math.random().toString(36).substring(2, 15), // Generate a random seed
    difficulty: "Beginner",
    constants: { gravitationalConstant: 6.67430e-11 },
    initialConditions: { matterAntimatterRatio: 1.0000001 },
  });

  const handleChange = (e) => {
    setUniverseData({ ...universeData, [e.target.name]: e.target.value });
  };

  const handleCreateUniverse = async () => {
    try {
      await createUniverse(universeData);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to create universe:", error);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="p-8 bg-gray-800 rounded-lg shadow-lg w-full max-w-lg">
        <h2 className="text-3xl font-bold text-center mb-6">Create Your Universe</h2>

        <input
          type="text"
          name="name"
          placeholder="Universe Name"
          value={universeData.name}
          onChange={handleChange}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"
        />

        <label className="block my-4">
          <span className="text-gray-300">Select Difficulty</span>
          <select
            name="difficulty"
            value={universeData.difficulty}
            onChange={handleChange}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </label>

        <button
          onClick={handleCreateUniverse}
          className="w-full py-3 mt-6 text-lg font-semibold bg-blue-500 rounded-lg hover:bg-blue-600"
        >
          Create Universe
        </button>
      </div>
    </div>
  );
};

export default UniverseCreation;

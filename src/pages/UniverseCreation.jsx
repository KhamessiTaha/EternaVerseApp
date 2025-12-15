import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createUniverse } from "../api/universeApi";
import { 
  Sparkles, Atom, Zap, Activity, Info, Loader2, 
  ArrowLeft, Rocket, Shuffle 
} from "lucide-react";

const UniverseCreation = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [universeData, setUniverseData] = useState({
    name: "",
    seed: Math.random().toString(36).substring(2, 15),
    difficulty: "Beginner",
    constants: { gravitationalConstant: 6.67430e-11 },
    initialConditions: { matterAntimatterRatio: 1.0000001 },
  });

  const difficulties = [
    {
      value: "Beginner",
      label: "Beginner",
      description: "Stable universe with forgiving parameters",
      color: "from-green-500 to-emerald-500",
      icon: Sparkles
    },
    {
      value: "Intermediate",
      label: "Intermediate",
      description: "Balanced complexity and challenge",
      color: "from-yellow-500 to-orange-500",
      icon: Activity
    },
    {
      value: "Advanced",
      label: "Advanced",
      description: "Chaotic conditions, expert tuning required",
      color: "from-red-500 to-pink-500",
      icon: Zap
    }
  ];

  const handleChange = (e) => {
    setUniverseData({ ...universeData, [e.target.name]: e.target.value });
  };

  const randomizeSeed = () => {
    setUniverseData({
      ...universeData,
      seed: Math.random().toString(36).substring(2, 15)
    });
  };

  const handleCreateUniverse = async () => {
    if (!universeData.name.trim()) {
      setError("Please give your universe a name");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await createUniverse(universeData);
      navigate("/dashboard");
    } catch (error) {
      setError(error.response?.data?.message || "Failed to create universe. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-2xl"
        >
          {/* Back Button */}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          {/* Card */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-2xl mb-4"
              >
                <Atom className="w-10 h-10 animate-spin" style={{ animationDuration: '3s' }} />
              </motion.div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                Create Your Universe
              </h2>
              <p className="text-gray-400">
                Set the cosmic stage and watch reality unfold
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2"
              >
                <Info className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </motion.div>
            )}

            {/* Form */}
            <div className="space-y-6">
              {/* Universe Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Universe Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter a name for your universe..."
                  value={universeData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white placeholder-gray-500"
                />
              </div>

              {/* Seed */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cosmic Seed
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="seed"
                    value={universeData.seed}
                    onChange={handleChange}
                    className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white font-mono text-sm"
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={randomizeSeed}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-all flex items-center gap-2"
                    title="Generate new seed"
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This seed determines your universes quantum randomness
                </p>
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Select Difficulty
                </label>
                <div className="grid gap-3">
                  {difficulties.map((diff) => (
                    <motion.button
                      key={diff.value}
                      type="button"
                      onClick={() => setUniverseData({ ...universeData, difficulty: diff.value })}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        universeData.difficulty === diff.value
                          ? `border-transparent bg-gradient-to-r ${diff.color} shadow-lg`
                          : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${
                          universeData.difficulty === diff.value
                            ? 'bg-white/20'
                            : 'bg-gray-700/50'
                        }`}>
                          <diff.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-semibold mb-1">{diff.label}</div>
                          <div className={`text-sm ${
                            universeData.difficulty === diff.value
                              ? 'text-white/90'
                              : 'text-gray-400'
                          }`}>
                            {diff.description}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings Info */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-300">
                    <p className="font-medium mb-1">Advanced Parameters</p>
                    <p className="text-blue-400/80">
                      Gravitational constant and matter-antimatter ratio are pre-configured based on your difficulty level. 
                      Fine-tune these in the simulation interface.
                    </p>
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <button
                onClick={handleCreateUniverse}
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-xl font-semibold text-lg hover:from-purple-700 hover:via-blue-700 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-xl shadow-blue-500/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Initializing Universe...
                  </>
                ) : (
                  <>
                    <Rocket className="w-6 h-6" />
                    Create Universe
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-gray-500 text-sm"
          >
            <p>Once created, your universe will begin its evolutionary journey</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default UniverseCreation;
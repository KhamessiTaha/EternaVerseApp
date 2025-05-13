import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useContext } from "react"; // Add this
import { AuthContext } from "../context/AuthContext"; // Add this

const Home = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext); // Add this

  const handleGetStarted = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/login", { state: { from: "/dashboard" } });
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center max-w-2xl">
        <motion.h1
          className="text-5xl font-bold"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Welcome to <span className="text-blue-400">EternaVerse</span>
        </motion.h1>

        <motion.p
          className="mt-4 text-lg text-gray-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          Explore, create, and shape your own universe. Set the initial conditions and witness the evolution of the cosmos.
        </motion.p>

        <motion.div
          className="mt-6 flex justify-center space-x-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 1 }}
        >
          <button
            onClick={handleGetStarted}
            className="px-6 py-3 text-lg font-semibold text-black bg-blue-400 rounded-lg hover:bg-blue-500 transition-all"
          >
            Get Started
          </button>
          <button
            className="px-6 py-3 text-lg font-semibold text-white border border-white rounded-lg hover:bg-white hover:text-black transition-all"
          >
            Learn More
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
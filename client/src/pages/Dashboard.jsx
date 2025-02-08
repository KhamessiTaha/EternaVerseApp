import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Clock, Orbit, History, Award, Users, Settings } from "lucide-react";

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const stats = [
    { value: "3", label: "Active Universes" },
    { value: "147", label: "Civilizations Emerged" },
    { value: "2.3B", label: "Years Simulated" },
    { value: "89%", label: "Stability Rating" },
  ];

  const menuItems = [
    {
      title: "Create New Universe",
      icon: <Orbit className="w-6 h-6" />,
      description: "Start a new universe simulation with custom parameters",
      action: () => navigate("/universe-creation"),
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      title: "Active Simulations",
      icon: <Clock className="w-6 h-6" />,
      description: "View and manage your running universe simulations",
      action: () => navigate("/simulation-dashboard"),
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      title: "Simulation History",
      icon: <History className="w-6 h-6" />,
      description: "Browse through your past universe simulations",
      action: () => console.log("History clicked"),
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      title: "Achievements",
      icon: <Award className="w-6 h-6" />,
      description: "View your cosmic achievements and rewards",
      action: () => console.log("Achievements clicked"),
      color: "bg-yellow-500 hover:bg-yellow-600",
    },
    {
      title: "Multiplayer Hub",
      icon: <Users className="w-6 h-6" />,
      description: "Collaborate with other universe creators",
      action: () => console.log("Multiplayer clicked"),
      color: "bg-pink-500 hover:bg-pink-600",
    },
    {
      title: "Settings",
      icon: <Settings className="w-6 h-6" />,
      description: "Configure your simulation preferences",
      action: () => console.log("Settings clicked"),
      color: "bg-gray-500 hover:bg-gray-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 pt-20">
      {/* Welcome Section */}
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl font-bold mb-2">Welcome back, {user.username}!</h2>
        <p className="text-gray-400 mb-8">Continue your journey as a universe creator</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{stat.value}</div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Main Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className={`${item.color} rounded-lg p-6 text-left transition-all transform hover:scale-105`}
            >
              <div className="flex items-center gap-4 mb-2">
                {item.icon}
                <h3 className="text-xl font-semibold">{item.title}</h3>
              </div>
              <p className="text-gray-200 text-sm">{item.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
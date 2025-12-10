import { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { LogOut, Home, LayoutDashboard, User, Sparkles } from "lucide-react";

const NavHeader = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Home, showAlways: true },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, showWhenLoggedIn: true },
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const handleLogin = () => {
    navigate("/login");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md shadow-lg border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-purple-400" />
            <span 
              onClick={() => navigate("/")}
              className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
            >
              EternaVerse
            </span>
          </div>

          {/* Center: Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              if (!item.showAlways && !user) return null;
              if (item.showWhenLoggedIn && !user) return null;
              
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    active
                      ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: User Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* User Profile */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <User size={14} className="text-white" />
                  </div>
                  <div className="text-sm">
                    <p className="text-gray-400 text-xs">Connected as</p>
                    <p className="text-white font-medium">{user.username}</p>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                {/* Register Button */}
                <button
                  onClick={() => navigate("/register")}
                  className="hidden sm:block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-all"
                >
                  Register
                </button>
                
                {/* Login Button */}
                <button
                  onClick={handleLogin}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Login
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex gap-2 pb-3">
          {navItems.map((item) => {
            if (!item.showAlways && !user) return null;
            if (item.showWhenLoggedIn && !user) return null;
            
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                  active
                    ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30"
                    : "text-gray-300 hover:text-white bg-white/5 hover:bg-white/10"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
          
          {!user && (
            <button
              onClick={() => navigate("/register")}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all text-sm"
            >
              <User size={16} />
              <span>Register</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NavHeader;
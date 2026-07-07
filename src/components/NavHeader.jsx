import { useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { LogOut, Home, LayoutDashboard, User } from "lucide-react";
import { Button } from "./ui/primitives";

const NavHeader = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleTokenExpired = () => {
      navigate("/login");
    };

    window.addEventListener("tokenExpired", handleTokenExpired);
    return () => window.removeEventListener("tokenExpired", handleTokenExpired);
  }, [navigate]);

  const navItems = [
    { path: "/", label: "Home", icon: Home, showAlways: true },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, showWhenLoggedIn: true },
  ];

  const isActive = (path) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path));

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="bg-void-raised/90 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <span className="w-2 h-2 bg-accent group-hover:bg-ink transition-colors" />
            <span className="font-mono text-[15px] tracking-[0.08em] text-ink font-medium">
              ETERNAVERSE
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              if (!item.showAlways && !user) return null;
              if (item.showWhenLoggedIn && !user) return null;

              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 font-mono text-[13px] tracking-wide border-b-2 transition-colors ${
                    active
                      ? "text-accent border-accent"
                      : "text-ink-dim border-transparent hover:text-ink"
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 border border-line">
                  <User size={14} className="text-ink-faint" />
                  <div className="text-xs font-mono">
                    <span className="text-ink-faint">connected as </span>
                    <span className="text-ink">{user.username}</span>
                  </div>
                </div>

                <Button variant="danger" onClick={handleLogout} className="px-4 py-2">
                  <LogOut size={15} />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="hidden sm:inline-flex px-4 py-2" onClick={() => navigate("/register")}>
                  Register
                </Button>
                <Button className="px-5 py-2" onClick={() => navigate("/login")}>
                  Login
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="md:hidden flex gap-2 pb-3">
          {navItems.map((item) => {
            if (!item.showAlways && !user) return null;
            if (item.showWhenLoggedIn && !user) return null;

            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 font-mono text-xs border transition-colors ${
                  active ? "text-accent border-accent/40" : "text-ink-dim border-line"
                }`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {!user && (
            <button
              onClick={() => navigate("/register")}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-ink-dim border border-line font-mono text-xs"
            >
              <User size={15} />
              <span>Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default NavHeader;

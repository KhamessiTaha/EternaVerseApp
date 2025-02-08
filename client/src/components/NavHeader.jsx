import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const NavHeader = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="fixed top-0 right-0 p-4 flex items-center gap-4">
      {user ? (
        <>
          <span className="text-white">Logged in as {user.username}</span>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
          >
            Logout
          </button>
        </>
      ) : (
        <button
          onClick={() => navigate("/login")}
          className="px-4 py-2 text-sm font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
        >
          Login
        </button>
      )}
    </div>
  );
};

export default NavHeader;
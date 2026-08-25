import { createContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { startSelfSync, flushSelfSync, _resetSelfSync } from "../components/game/selfSync";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Logout function (defined first so it can be used in useEffect)
  const logout = useCallback(() => {
    // Get this session's progress onto the account before the token goes -
    // afterwards there is nothing to authenticate the push with. The cached
    // Self stays on disk under its per-user key either way.
    flushSelfSync();
    _resetSelfSync();
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  // Setup axios interceptor to handle token expiration. Only 401/403 mean
  // "session over" - the backend uses 400 for ordinary validation errors
  // (e.g. resolving an already-resolved anomaly), which must never log the
  // player out mid-game. Invalid tokens now come back as 401 from the API.
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          // Token is expired or invalid - automatically logout
          logout();
          // Redirect to login by dispatching a custom event
          window.dispatchEvent(new CustomEvent("tokenExpired"));
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [logout]);

  // Initialize user from localStorage and validate token
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
        // The warden's identity lives on the account now. Pull it (and push
        // whatever this browser has been holding) as soon as we know who this
        // is - including the pre-account local blob, which is why this must
        // run before any gameplay can write to it.
        startSelfSync();
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        logout();
      }
    }
  }, [logout]);

  const login = (userData, token) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);
    setUser(userData);
    startSelfSync();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

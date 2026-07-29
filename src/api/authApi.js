import axios from "axios";
import { createUniverse } from "./universeApi";

const API_URL = `${import.meta.env.VITE_API_URL}/auth`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: token ? `Bearer ${token}` : "" } };
};

// Start an anonymous demo session - a full-featured throwaway account.
export const guestSession = async () => {
  const res = await axios.post(`${API_URL}/guest`);
  return res.data;
};

// Upgrade the current guest account into a real one, keeping its universes.
export const claimAccount = async ({ username, email, password }) => {
  const res = await axios.post(`${API_URL}/claim`, { username, email, password }, authHeaders());
  return res.data;
};

// One-click demo: open a guest session, seed the auth context (so the token is
// stored before the next request), and create a fresh Beginner universe.
// Returns the universe; the caller navigates to the Big Bang. `login` is the
// AuthContext login(userData, token) callback.
export const startGuestDemo = async (login) => {
  const data = await guestSession();
  login(data, data.token);
  return createUniverse({
    name: "Demo Universe",
    seed: Math.random().toString(36).slice(2, 15),
    difficulty: "Beginner",
    constants: { gravitationalConstant: 6.67430e-11 },
    initialConditions: { matterAntimatterRatio: 1.0000001 },
  });
};

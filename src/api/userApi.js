import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL}/user`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: token ? `Bearer ${token}` : "" } };
};

// Account-wide unlocked achievements (see backend utils/achievements.js)
export const getAchievements = async () => {
  try {
    const res = await axios.get(`${API_URL}/achievements`, getAuthHeaders());
    return res.data.achievements;
  } catch (error) {
    console.error("Error fetching achievements:", error.response?.data || error.message);
    throw error;
  }
};

// Account-wide ship loadout (see backend utils/hullCatalog.js) - hull +
// color, plus which hulls are currently unlocked (derived from achievements).
export const getLoadout = async () => {
  try {
    const res = await axios.get(`${API_URL}/loadout`, getAuthHeaders());
    return res.data;
  } catch (error) {
    console.error("Error fetching loadout:", error.response?.data || error.message);
    throw error;
  }
};

export const updateLoadout = async (hull, shipColor) => {
  try {
    const res = await axios.put(`${API_URL}/loadout`, { hull, shipColor }, getAuthHeaders());
    return res.data;
  } catch (error) {
    console.error("Error updating loadout:", error.response?.data || error.message);
    throw error;
  }
};

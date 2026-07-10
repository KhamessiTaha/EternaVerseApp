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

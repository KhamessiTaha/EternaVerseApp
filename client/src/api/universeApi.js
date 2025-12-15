import axios from "axios";
import dotenv from "dotenv";

const API_URL = dotenv.process.env.API+"/universe";

// Get the auth token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: token } };
};

// Create a new universe (backend uses POST "/")
export const createUniverse = async (universeData) => {
  try {
    const res = await axios.post(`${API_URL}/`, universeData, getAuthHeaders());
    return res.data.universe; // return created universe
  } catch (error) {
    console.error("Error creating universe:", error.response?.data || error.message);
    throw error;
  }
};

// Get all universes
export const getUserUniverses = async () => {
  try {
    const res = await axios.get(`${API_URL}/`, getAuthHeaders());
    return res.data.universes || []; // always return array
  } catch (error) {
    console.error("Error fetching universes:", error.response?.data || error.message);
    throw error;
  }
};

// Delete universe by ID
export const deleteUniverse = async (universeId) => {
  try {
    const res = await axios.delete(`${API_URL}/${universeId}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    console.error("Error deleting universe:", error.response?.data || error.message);
    throw error;
  }
};

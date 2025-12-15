import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL}/universe`;

// Get the auth token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : ""
    }
  };
};

// Create a new universe
export const createUniverse = async (universeData) => {
  try {
    const res = await axios.post(API_URL, universeData, getAuthHeaders());
    return res.data.universe;
  } catch (error) {
    console.error(
      "Error creating universe:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Get all universes
export const getUserUniverses = async () => {
  try {
    const res = await axios.get(API_URL, getAuthHeaders());
    return res.data.universes || [];
  } catch (error) {
    console.error(
      "Error fetching universes:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Delete universe by ID
export const deleteUniverse = async (universeId) => {
  try {
    const res = await axios.delete(`${API_URL}/${universeId}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    console.error(
      "Error deleting universe:",
      error.response?.data || error.message
    );
    throw error;
  }
};

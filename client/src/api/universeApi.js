import axios from "axios";

const API_URL = "http://localhost:5000/api/universe"; 

// Get the auth token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: token } };
};

// Create a new universe
export const createUniverse = async (universeData) => {
  try {
    const response = await axios.post(`${API_URL}/create`, universeData, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error("Error creating universe:", error.response?.data || error.message);
    throw error;
  }
};

// Get all universes for the logged-in user
export const getUserUniverses = async () => {
  try {
    const response = await axios.get(API_URL, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error("Error fetching universes:", error.response?.data || error.message);
    throw error;
  }
};

// Delete a universe
export const deleteUniverse = async (universeId) => {
  try {
    const response = await axios.delete(`${API_URL}/${universeId}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error("Error deleting universe:", error.response?.data || error.message);
    throw error;
  }
};

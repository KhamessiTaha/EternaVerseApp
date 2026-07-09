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

// Get a single universe by id
export const getUniverse = async (universeId) => {
  try {
    const res = await axios.get(`${API_URL}/${universeId}`, getAuthHeaders());
    return res.data.universe;
  } catch (error) {
    console.error(
      "Error fetching universe:",
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

// Advance the server simulation (universe ages by wall-clock time since the
// last call). playerPosition drives where new anomalies spawn.
export const simulateUniverse = async (universeId, playerPosition) => {
  try {
    const res = await axios.post(
      `${API_URL}/${universeId}/simulate`,
      { playerPosition },
      getAuthHeaders()
    );
    return res.data;
  } catch (error) {
    console.error(
      "Error simulating universe:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Resolve a backend anomaly; accuracy (0-100) is the minigame performance
// grade that scales the reward server-side.
export const resolveAnomaly = async (universeId, anomalyId, accuracy) => {
  try {
    const res = await axios.post(
      `${API_URL}/${universeId}/resolve-anomaly`,
      { anomalyId, accuracy },
      getAuthHeaders()
    );
    return res.data;
  } catch (error) {
    console.error(
      "Error resolving anomaly:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Record scan discoveries (batch). Server dedups and computes research
// value; duplicates in the response are normal after retries.
export const submitDiscoveries = async (universeId, discoveries) => {
  try {
    const res = await axios.post(
      `${API_URL}/${universeId}/discoveries`,
      { discoveries },
      getAuthHeaders()
    );
    return res.data;
  } catch (error) {
    console.error(
      "Error submitting discoveries:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// First Contact action (observe / uplift / pacify). Costs, rewards, and the
// uplift backfire roll are all server-side; the response carries the updated
// universe plus an outcome message for the panel.
export const contactCivilization = async (universeId, civId, action) => {
  try {
    const res = await axios.post(
      `${API_URL}/${universeId}/contact-civilization`,
      { civId, action },
      getAuthHeaders()
    );
    return res.data;
  } catch (error) {
    console.error(
      "Error contacting civilization:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Get the ML predictor's risk forecast (stability, anomaly emergence,
// end-condition risks, action priorities) for the Chronicle's threat panel.
export const getPredictions = async (universeId) => {
  try {
    const res = await axios.get(`${API_URL}/${universeId}/predictions`, getAuthHeaders());
    return res.data.predictions;
  } catch (error) {
    console.error(
      "Error fetching predictions:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Purchase a ship upgrade with research points. The server validates cost,
// level cap, and balance - the client only names the track.
export const purchaseUpgrade = async (universeId, track) => {
  try {
    const res = await axios.post(
      `${API_URL}/${universeId}/upgrade`,
      { track },
      getAuthHeaders()
    );
    return res.data;
  } catch (error) {
    console.error(
      "Error purchasing upgrade:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Prune old resolved anomalies from the universe document
export const cleanupAnomalies = async (universeId, keepRecentMinutes = 60) => {
  try {
    const res = await axios.post(
      `${API_URL}/${universeId}/cleanup-anomalies`,
      { keepRecentMinutes },
      getAuthHeaders()
    );
    return res.data;
  } catch (error) {
    console.error(
      "Error cleaning up anomalies:",
      error.response?.data || error.message
    );
    throw error;
  }
};

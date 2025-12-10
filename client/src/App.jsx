import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import UniverseCreation from "./pages/UniverseCreation";
import SimulationDashboard from "./pages/SimulationDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import BigBangPage from "./pages/BigBangPage";
import GameplayPage from "./pages/GameplayPage";
import './index.css'; 
import './App.css'; 

function App() {
  const { user } = useContext(AuthContext);

  return (
    <Router>
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/login" />} />
        <Route path="/big-bang" element={<BigBangPage />} />

        {/* Protected Routes */}
        <Route
          path="/gameplay/:id"
          element={
            <ProtectedRoute>
              <GameplayPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/universe-creation"
          element={
            <ProtectedRoute>
              <UniverseCreation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/simulation-dashboard/:id"
          element={
            <ProtectedRoute>
              <SimulationDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

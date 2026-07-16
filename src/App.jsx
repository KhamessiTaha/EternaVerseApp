import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useContext, lazy, Suspense } from "react";
import { AuthContext } from "./context/AuthContext";
import NavHeader from "./components/NavHeader";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import UniverseCreation from "./pages/UniverseCreation";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastProvider } from "./components/ui/ToastProvider";
import './index.css';
import './App.css';

// Code-split the engine-heavy pages: Three.js (Big Bang cinematic) and
// Phaser (gameplay) together dwarf the rest of the app - splitting them
// keeps the landing/login/dashboard first paint fast.
const BigBangPage = lazy(() => import("./pages/BigBangPage"));
const GameplayPage = lazy(() => import("./pages/GameplayPage"));

const EngineLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[60vh]">
    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-faint animate-pulse">
      Preparing the universe…
    </p>
  </div>
);

function App() {
  const { user } = useContext(AuthContext);

  return (
    <ToastProvider>
    <Router>
      <div className="flex flex-col min-h-screen bg-void">
        {/* Global Navbar - Fixed height, doesn't flex */}
        <NavHeader />

        {/* Main Content Area - Takes remaining space */}
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<EngineLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/login" />} />
            <Route
              path="/big-bang/:id"
              element={
                <ProtectedRoute>
                  <BigBangPage />
                </ProtectedRoute>
              }
            />

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
          </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
    </ToastProvider>
  );
}

export default App;

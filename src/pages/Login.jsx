import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, AlertCircle, Loader2 } from "lucide-react";
import { Button, Panel, Field, Eyebrow, Alert } from "../components/ui/primitives";

const API_BASE = import.meta.env.VITE_API_URL;

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
      login(res.data, res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void text-ink flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <Panel className="p-8">
          <div className="mb-8">
            <Eyebrow>Access</Eyebrow>
            <h2 className="font-sans text-2xl font-semibold text-ink mt-2">Welcome back</h2>
            <p className="text-ink-dim text-sm mt-1">Sign in to resume your universes</p>
          </div>

          {error && (
            <div className="mb-6">
              <Alert variant="critical">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </Alert>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <Field
              label="Email Address"
              icon={Mail}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Field
              label="Password"
              icon={Lock}
              type="password"
              placeholder="········"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-void-raised text-ink-faint text-xs font-mono uppercase tracking-wider">
                New to EternaVerse?
              </span>
            </div>
          </div>

          <Button variant="secondary" className="w-full" onClick={() => navigate("/register")}>
            Create Account
          </Button>
        </Panel>

        <p className="text-center text-ink-faint text-xs font-mono mt-6">
          By signing in, you agree to shape the cosmos responsibly
        </p>
      </div>
    </div>
  );
};

export default Login;

import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { User, Mail, Lock, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { Button, Panel, Field, Eyebrow, Alert } from "../components/ui/primitives";

const API_BASE = import.meta.env.VITE_API_URL;

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const passwordStrength = () => {
    const length = password.length;
    if (length === 0) return { strength: 0, label: "", color: "bg-line" };
    if (length < 6) return { strength: 33, label: "Weak", color: "bg-critical", textColor: "text-critical" };
    if (length < 10) return { strength: 66, label: "Medium", color: "bg-warn", textColor: "text-warn" };
    return { strength: 100, label: "Strong", color: "bg-good", textColor: "text-good" };
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await axios.post(`${API_BASE}/auth/register`, { username, email, password });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const strength = passwordStrength();

  return (
    <div className="min-h-screen bg-void text-ink flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <Panel className="p-8">
          <div className="mb-8">
            <Eyebrow>Registration</Eyebrow>
            <h2 className="font-sans text-2xl font-semibold text-ink mt-2">Create account</h2>
            <p className="text-ink-dim text-sm mt-1">Begin your journey as a cosmic architect</p>
          </div>

          {error && (
            <div className="mb-6">
              <Alert variant="critical">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </Alert>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <Field
              label="Username"
              icon={User}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <Field
              label="Email Address"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <Field
                label="Password"
                icon={Lock}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {password && (
                <div className="mt-2.5">
                  <div className="flex justify-between text-[11px] font-mono mb-1.5">
                    <span className="text-ink-faint uppercase tracking-wider">Password Strength</span>
                    <span className={strength.textColor}>{strength.label}</span>
                  </div>
                  <div className="h-[3px] bg-line overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${strength.strength}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <Button variant="secondary" className="w-full mt-6" onClick={() => navigate("/login")}>
            Sign In
          </Button>
        </Panel>
      </div>
    </div>
  );
};

export default Register;

import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createUniverse } from "../api/universeApi";
import { Sparkles, Activity, Zap, Info, Loader2, ArrowLeft, Shuffle } from "lucide-react";
import { Button, Panel, Field, Eyebrow, Alert } from "../components/ui/primitives";
import { useToast } from "../components/ui/ToastProvider";

const DIFFICULTIES = [
  {
    value: "Beginner",
    description: "Stable universe with forgiving parameters",
    icon: Sparkles,
    color: "border-good/50 bg-good/5",
    iconColor: "text-good",
  },
  {
    value: "Intermediate",
    description: "Balanced complexity and challenge",
    icon: Activity,
    color: "border-warn/50 bg-warn/5",
    iconColor: "text-warn",
  },
  {
    value: "Advanced",
    description: "Chaotic conditions, expert tuning required",
    icon: Zap,
    color: "border-critical/50 bg-critical/5",
    iconColor: "text-critical",
  },
];

const UniverseCreation = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [universeData, setUniverseData] = useState({
    name: "",
    seed: Math.random().toString(36).substring(2, 15),
    difficulty: "Beginner",
    constants: { gravitationalConstant: 6.67430e-11 },
    initialConditions: { matterAntimatterRatio: 1.0000001 },
  });

  const handleChange = (e) => {
    setUniverseData({ ...universeData, [e.target.name]: e.target.value });
  };

  const randomizeSeed = () => {
    setUniverseData({ ...universeData, seed: Math.random().toString(36).substring(2, 15) });
  };

  const handleCreateUniverse = async () => {
    if (!universeData.name.trim()) {
      setError("Please give your universe a name");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const universe = await createUniverse(universeData);
      toast(`Universe "${universe.name}" created - initiating genesis`, 'success');
      navigate(`/big-bang/${universe._id}`, { state: { universe } });
    } catch (error) {
      setError(error.response?.data?.message || "Failed to create universe. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void text-ink">
      <div className="min-h-screen flex items-center justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-xl"
        >
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-ink-faint hover:text-ink transition-colors mb-6 font-mono text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <Panel className="p-8">
            <div className="mb-8">
              <Eyebrow>New Simulation</Eyebrow>
              <h2 className="font-sans text-2xl font-semibold text-ink mt-2">Create your universe</h2>
              <p className="text-ink-dim text-sm mt-1">Set the cosmic stage and watch reality unfold</p>
            </div>

            {error && (
              <div className="mb-6">
                <Alert variant="critical">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </Alert>
              </div>
            )}

            <div className="space-y-6">
              <Field
                label="Universe Name"
                type="text"
                name="name"
                placeholder="Enter a name for your universe..."
                value={universeData.name}
                onChange={handleChange}
              />

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-2">
                  Cosmic Seed
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="seed"
                    value={universeData.seed}
                    readOnly
                    className="flex-1 px-3 py-2.5 bg-void border border-line text-ink font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={randomizeSeed}
                    title="Generate new seed"
                    className="px-3.5 border border-line hover:border-accent text-ink-dim hover:text-accent transition-colors"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-ink-faint mt-1.5">
                  This seed determines your universe's quantum randomness
                </p>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-2.5">
                  Select Difficulty
                </label>
                <div className="grid gap-2.5">
                  {DIFFICULTIES.map((diff) => {
                    const selected = universeData.difficulty === diff.value;
                    return (
                      <button
                        key={diff.value}
                        type="button"
                        onClick={() => setUniverseData({ ...universeData, difficulty: diff.value })}
                        className={`p-4 border text-left transition-colors ${
                          selected ? diff.color : 'border-line hover:border-line-bright'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <diff.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selected ? diff.iconColor : 'text-ink-faint'}`} strokeWidth={1.5} />
                          <div>
                            <div className={`font-mono text-sm mb-0.5 ${selected ? 'text-ink' : 'text-ink-dim'}`}>{diff.value}</div>
                            <div className="text-xs text-ink-faint">{diff.description}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-xs text-ink-dim leading-relaxed">
                  <p className="text-accent font-mono uppercase tracking-wider text-[10px] mb-1.5">Advanced Parameters</p>
                  Gravitational constant and matter-antimatter ratio are pre-configured based on your difficulty level.
                  Fine-tune these in the simulation interface.
                </div>
              </div>

              <Button onClick={handleCreateUniverse} disabled={isLoading} className="w-full py-4">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initializing Universe...
                  </>
                ) : (
                  "Create Universe"
                )}
              </Button>
            </div>
          </Panel>

          <p className="text-center text-ink-faint text-xs font-mono mt-6">
            Once created, your universe will begin its evolutionary journey
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default UniverseCreation;

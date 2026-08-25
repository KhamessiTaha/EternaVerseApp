import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createUniverse } from "../api/universeApi";
import { Sparkles, Activity, Zap, Info, Loader2, ArrowLeft } from "lucide-react";
import { Button, Panel, Field, Eyebrow, Alert } from "../components/ui/primitives";
import { useToast } from "../components/ui/ToastProvider";
import { normalizeCode } from "../components/game/world/seedCode";

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
  // Optional: play the universe someone handed you. The code IS the seed, so
  // an identical cosmos is generated with no shared lookup anywhere.
  const [shareCode, setShareCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [universeData, setUniverseData] = useState({
    // No seed sent on purpose: the server generates a SHARE CODE and uses it
    // as the seed, so every new universe is reproducible from seven readable
    // characters. Sending a random string here would defeat that.
    name: "",
    difficulty: "Beginner",
    constants: { gravitationalConstant: 6.67430e-11 },
    initialConditions: { matterAntimatterRatio: 1.0000001 },
  });

  const handleChange = (e) => {
    setUniverseData({ ...universeData, [e.target.name]: e.target.value });
  };

  const handleCreateUniverse = async () => {
    if (!universeData.name.trim()) {
      setError("Please give your universe a name");
      return;
    }

    setError("");
    setIsLoading(true);

    // Validate the code before spending a round trip, so a typo is corrected
    // here rather than becoming a universe that isn't the one they wanted.
    let normalized = null;
    if (shareCode.trim()) {
      normalized = normalizeCode(shareCode);
      if (!normalized) {
        setCodeError("That doesn't look like a universe code. They read like KX7-2291.");
        setIsLoading(false);
        return;
      }
    }

    try {
      const universe = await createUniverse(
        normalized ? { ...universeData, shareCode: normalized } : universeData
      );
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

              {/* A universe you can be handed. Leave it blank for a fresh
                  cosmos; type a friend's code to get the identical one. */}
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-2">
                  Universe Code · optional
                </label>
                <input
                  type="text"
                  value={shareCode}
                  onChange={(e) => {
                    setShareCode(e.target.value.toUpperCase());
                    setCodeError("");
                  }}
                  placeholder="KX7-2291"
                  maxLength={9}
                  className={`w-full px-3 py-2.5 bg-void border text-ink font-mono text-lg tracking-[0.15em] ${
                    codeError ? 'border-critical' : 'border-line focus:border-accent'
                  } outline-none transition-colors`}
                />
                <p className={`text-xs mt-1.5 ${codeError ? 'text-critical' : 'text-ink-faint'}`}>
                  {codeError || "Someone shared a universe with you? Enter its code to play the same cosmos. Leave empty for a new one."}
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

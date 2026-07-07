import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { Globe, Zap, Star, ArrowRight, Play, X } from "lucide-react";
import { Button, Eyebrow, Panel } from "../components/ui/primitives";
import { Starfield } from "../components/ui/Starfield";

const STATS = [
  { value: "10B+", label: "Galaxies Simulated" },
  { value: "500K+", label: "Universes Created" },
  { value: "99.9%", label: "Physics Accuracy" },
];

const FEATURES = [
  {
    icon: Globe,
    title: "Create Universes",
    description: "Set a seed, a difficulty, and let deterministic physics do the rest - every universe evolves from the quantum foam up.",
  },
  {
    icon: Zap,
    title: "Set Initial Conditions",
    description: "Tune the constants that actually govern expansion, entropy, and stability, and watch reality respond in real time.",
  },
  {
    icon: Star,
    title: "Witness Evolution",
    description: "Galaxies form, stars ignite, civilizations rise and go extinct - a living universe that keeps running whether you're watching or not.",
  },
];

const Home = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const handleGetStarted = () => {
    if (user) navigate("/dashboard");
    else navigate("/login", { state: { from: "/dashboard" } });
  };

  return (
    <div className="relative min-h-screen bg-void text-ink overflow-hidden">
      {/* Hero */}
      <div className="relative flex items-center justify-center min-h-screen px-4">
        <div className="absolute inset-0">
          <Starfield />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative text-center max-w-4xl mx-auto"
        >
          <Eyebrow className="justify-center flex mb-6">The Universe Simulation Platform</Eyebrow>

          <h1 className="font-sans text-5xl md:text-7xl font-semibold mb-6 leading-[1.05] text-balance">
            Welcome to <span className="text-accent">EternaVerse</span>
          </h1>

          <p className="text-lg md:text-xl text-ink-dim mb-12 max-w-2xl mx-auto leading-relaxed">
            Shape the fabric of reality. Set initial conditions and witness the birth, evolution,
            and fate of entire universes in your hands.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-20">
            <Button onClick={handleGetStarted} className="px-8 py-3.5">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="secondary" onClick={() => setIsVideoOpen(true)} className="px-8 py-3.5">
              <Play className="w-4 h-4" />
              Watch Demo
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto font-mono">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-semibold text-ink tabular-nums">{stat.value}</div>
                <div className="text-[11px] text-ink-faint uppercase tracking-wider mt-1.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Features */}
      <div className="relative py-28 px-4 border-t border-line">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Eyebrow className="justify-center flex mb-3">Infinite Possibilities</Eyebrow>
            <h2 className="font-sans text-3xl md:text-4xl font-semibold text-ink">Every choice shapes reality</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-px bg-line border border-line">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-void p-8"
              >
                <feature.icon className="w-6 h-6 text-accent mb-5" strokeWidth={1.5} />
                <h3 className="font-sans text-lg font-semibold text-ink mb-2.5">{feature.title}</h3>
                <p className="text-ink-dim text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative py-28 px-4 border-t border-line">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Panel className="max-w-3xl mx-auto text-center p-12">
            <h2 className="font-sans text-3xl md:text-4xl font-semibold text-ink mb-4">
              Ready to create your universe?
            </h2>
            <p className="text-ink-dim mb-8">Join the cosmic architects shaping reality, one seed at a time.</p>
            <Button onClick={handleGetStarted} className="px-10 py-4">
              Begin Your Journey
            </Button>
          </Panel>
        </motion.div>
      </div>

      {/* Video Modal */}
      {isVideoOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setIsVideoOpen(false)}
          className="fixed inset-0 bg-void/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full"
          >
            <Panel className="overflow-hidden">
              <div className="aspect-video flex items-center justify-center">
                <p className="text-ink-faint font-mono text-sm">Demo video placeholder</p>
              </div>
            </Panel>
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-void-raised border border-line-bright text-ink-dim hover:text-ink hover:border-accent transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Home;

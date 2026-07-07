import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { getUniverse } from "../api/universeApi";
import BigBangSimulation from "../components/BigBangSimulation";

const BigBangPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [universe, setUniverse] = useState(location.state?.universe || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Universe creation passes the freshly-created universe via nav state so
    // we don't need a round trip - but on a hard refresh (state lost), fetch it.
    if (universe || !id) return;

    getUniverse(id)
      .then(setUniverse)
      .catch(() => setError("Could not load this universe."));
  }, [id, universe]);

  // Straight into gameplay - no dashboard detour. GameplayPage uses the
  // fromBigBang flag to fade in from the same flash color BigBangSimulation
  // fades out to, so the scene handoff reads as one continuous cut.
  const handleEnterGameplay = () => navigate(`/gameplay/${id}`, { state: { fromBigBang: true } });

  if (error) {
    return (
      <div className="h-full w-full bg-void flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <p className="text-critical font-mono text-sm mb-4">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="font-mono text-sm text-ink-dim hover:text-ink border border-line-bright px-4 py-2 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="h-full w-full bg-void flex items-center justify-center overflow-hidden">
        <p className="text-accent font-mono text-sm tracking-wide animate-pulse">LOADING</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-void flex items-center justify-center overflow-hidden">
      <BigBangSimulation universe={universe} onSkip={handleEnterGameplay} onComplete={handleEnterGameplay} />
    </div>
  );
};

export default BigBangPage;

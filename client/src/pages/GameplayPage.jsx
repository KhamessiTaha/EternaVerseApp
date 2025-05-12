import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import seedrandom from "seedrandom";
import { Stage, Layer, Circle, Text, Arrow } from "react-konva";

const GameplayPage = () => {
  const { id } = useParams();
  const [universe, setUniverse] = useState(null);
  const [rng, setRng] = useState(() => () => Math.random());
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const stageRef = useRef();

  useEffect(() => {
    const fetchUniverse = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`http://localhost:5000/api/universe/${id}`, {
          headers: { Authorization: token },
        });
        setUniverse(response.data);
        setRng(() => seedrandom(response.data.seed));
      } catch (err) {
        console.error("Failed to load universe:", err);
      }
    };
    fetchUniverse();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const moveAmount = 25;
      if (e.key === "ArrowUp" || e.key === "w") setPosition((p) => ({ ...p, y: p.y + moveAmount }));
      if (e.key === "ArrowDown" || e.key === "s") setPosition((p) => ({ ...p, y: p.y - moveAmount }));
      if (e.key === "ArrowLeft" || e.key === "a") setPosition((p) => ({ ...p, x: p.x + moveAmount }));
      if (e.key === "ArrowRight" || e.key === "d") setPosition((p) => ({ ...p, x: p.x - moveAmount }));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!universe) return <div className="text-white p-8">Loading universe...</div>;

  const galaxies = Array.from({ length: 200 }, () => ({
    x: rng() * 5000 - 2500,
    y: rng() * 5000 - 2500,
    radius: rng() * 4 + 1,
    color: `hsl(${rng() * 360}, 80%, 70%)`,
  }));

  return (
    <div className="w-screen h-screen bg-black text-white relative">
      <div className="absolute top-2 left-2 bg-black bg-opacity-70 p-2 rounded z-10">
        <div><strong>{universe.name}</strong> - {universe.difficulty}</div>
        <div>Age: {Math.round(universe.currentState.age / 1e9)}B yrs</div>
        <div>Galaxies: {Math.round(universe.currentState.galaxyCount).toLocaleString()}</div>
        <div>Temp: {universe.currentState.temperature.toFixed(2)} K</div>
        <div>Entropy: {universe.currentState.entropy.toFixed(3)}</div>
      </div>

      <Stage width={window.innerWidth} height={window.innerHeight} ref={stageRef}>
        <Layer>
          {galaxies.map((g, i) => (
            <Circle
              key={i}
              x={g.x + position.x + window.innerWidth / 2}
              y={g.y + position.y + window.innerHeight / 2}
              radius={g.radius}
              fill={g.color}
              shadowBlur={5}
            />
          ))}

          {/* Optional: Draw Anomalies as arrows pointing to direction */}
          {universe.anomalies?.slice(0, 5).map((a, i) => {
            const targetX = a.location?.x ?? rng() * 1000;
            const targetY = a.location?.y ?? rng() * 1000;
            return (
              <Arrow
                key={i}
                points={[
                  window.innerWidth / 2,
                  window.innerHeight / 2,
                  targetX + position.x,
                  targetY + position.y,
                ]}
                pointerLength={10}
                pointerWidth={10}
                stroke="red"
                strokeWidth={2}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};

export default GameplayPage;

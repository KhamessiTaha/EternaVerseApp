import { useEffect, useRef } from "react";

const BigBangSimulation = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const width = canvas.width = window.innerWidth;
    const height = canvas.height = window.innerHeight;

    const centerX = width / 2;
    const centerY = height / 2;

    const particles = [];

    // Create particles
    const createParticles = () => {
      for (let i = 0; i < 300; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const speed = Math.random() * 3 + 1;
        particles.push({
          x: centerX,
          y: centerY,
          radius: Math.random() * 2 + 1,
          color: `hsl(${Math.random() * 360}, 100%, 70%)`,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
        });
      }
    };

    // Animate particles
    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(0, 0, width, height);

      for (let p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        p.x += p.dx;
        p.y += p.dy;
      }

      requestAnimationFrame(animate);
    };

    // Flash first, then explode
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fill();

    setTimeout(() => {
      createParticles();
      animate();
    }, 1000); // Delay to simulate "flash then boom"

  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default BigBangSimulation;

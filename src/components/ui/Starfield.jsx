import { useEffect, useRef } from "react";

// Lightweight full-bleed twinkling starfield - replaces the gradient-blob
// backgrounds used across the marketing pages with something that actually
// fits a universe-simulation product.
export const Starfield = ({ density = 140 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let stars = [];
    let raf = null;

    const size = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      stars = Array.from({ length: density }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.1 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.7,
      }));
    };
    size();
    window.addEventListener("resize", size);

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => {
        const tw = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(s.phase + t * 0.0008 * s.speed);
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(233, 231, 242, ${0.12 + tw * 0.45})`;
        ctx.fill();
      });
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw(0);

    return () => {
      window.removeEventListener("resize", size);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export default Starfield;

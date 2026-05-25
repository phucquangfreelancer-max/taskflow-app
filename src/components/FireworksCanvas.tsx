import React, { useEffect, useRef } from 'react';

export default function FireworksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      alpha: number;
      decay: number;
      size: number;
      gravity: number;
    }

    interface Firework {
      x: number;
      y: number;
      tx: number;
      ty: number;
      vx: number;
      vy: number;
      color: string;
      exploded: boolean;
      particles: Particle[];
      trail: { x: number; y: number }[];
    }

    const fireworks: Firework[] = [];
    const colors = [
      '#818cf8', // Indigo
      '#a78bfa', // Purple
      '#f43f5e', // Rose
      '#34d399', // Emerald
      '#38bdf8', // Sky
      '#fbbf24', // Amber
      '#f472b6'  // Pink
    ];

    const createExplosion = (x: number, y: number, color: string) => {
      const count = 50 + Math.floor(Math.random() * 30);
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.5 + 0.6; // Reduced speed from Math.random() * 4 + 1.5
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          alpha: 1,
          decay: Math.random() * 0.007 + 0.005, // Slower decay from Math.random() * 0.015 + 0.012
          size: Math.random() * 1.8 + 1,
          gravity: 0.018 // Reduced gravity from 0.05 for slow fall
        });
      }
      return particles;
    };

    const spawnFirework = () => {
      const startX = Math.random() * width;
      const startY = height;
      const targetX = Math.random() * (width * 0.6) + width * 0.2;
      const targetY = Math.random() * (height * 0.4) + height * 0.15;
      const color = colors[Math.floor(Math.random() * colors.length)];

      const angle = Math.atan2(targetY - startY, targetX - startX);
      const speed = Math.random() * 2 + 3.5; // Reduced rising speed from Math.random() * 4 + 8

      fireworks.push({
        x: startX,
        y: startY,
        tx: targetX,
        ty: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        exploded: false,
        particles: [],
        trail: []
      });
    };

    // Initial batch
    for (let i = 0; i < 2; i++) {
      setTimeout(() => {
        if (canvasRef.current) spawnFirework();
      }, i * 800); // Spaced further apart
    }

    let frame = 0;
    const loop = () => {
      if (!ctx || !canvas) return;
      
      // Subtly clear with trailing logic
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.clearRect(0, 0, width, height);

      frame++;
      if (frame % 100 === 0) { // Spawn less frequently, changed from 35 to 100
        spawnFirework();
      }

      for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];

        if (!fw.exploded) {
          fw.x += fw.vx;
          fw.y += fw.vy;

          fw.trail.push({ x: fw.x, y: fw.y });
          if (fw.trail.length > 5) fw.trail.shift();

          // Check if firework height peak met
          if (fw.vy >= 0 || fw.y <= fw.ty) {
            fw.exploded = true;
            fw.particles = createExplosion(fw.x, fw.y, fw.color);
          } else {
            ctx.beginPath();
            ctx.strokeStyle = fw.color;
            ctx.lineWidth = 1.5;
            ctx.moveTo(fw.trail[0]?.x || fw.x, fw.trail[0]?.y || fw.y);
            ctx.lineTo(fw.x, fw.y);
            ctx.stroke();
          }
        } else {
          let alive = false;
          fw.particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.alpha -= p.decay;

            if (p.alpha > 0) {
              alive = true;
              ctx.save();
              ctx.globalAlpha = p.alpha;
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          });

          if (!alive) {
            fireworks.splice(i, 1);
          }
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

type Tone = "win" | "cash" | "loss" | "liquidation";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
}

export function burstConfetti(tone: Tone): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const palette =
    tone === "loss" || tone === "liquidation"
      ? ["#F6465D", "#a52a36", "#5b121a", "#EAECEF"]
      : tone === "cash"
        ? ["#F0B90B", "#0ECB81", "#EAECEF", "#8d6d06"]
        : ["#0ECB81", "#F0B90B", "#EAECEF", "#14f1a0"];

  const count = tone === "liquidation" ? 130 : 90;
  const particles: Particle[] = Array.from({ length: count }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 240,
    y: tone === "liquidation" ? 90 + Math.random() * 120 : window.innerHeight * 0.38,
    vx: (Math.random() - 0.5) * (tone === "liquidation" ? 18 : 12),
    vy: (Math.random() - 0.75) * (tone === "liquidation" ? 12 : 16),
    size: 3 + Math.random() * 8,
    life: 0.85 + Math.random() * 0.7,
    color: palette[Math.floor(Math.random() * palette.length)],
  }));

  let last = performance.now();
  const animate = (now: number) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles.forEach((particle) => {
      particle.life -= dt;
      particle.vy += 22 * dt;
      particle.x += particle.vx;
      particle.y += particle.vy;
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size * 0.55);
    });
    if (particles.some((particle) => particle.life > 0)) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(animate);
}

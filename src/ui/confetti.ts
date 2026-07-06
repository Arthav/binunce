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

interface BurstProfile {
  count: number;
  originX: number;
  originY: number;
  spreadX: number;
  spreadY: number;
  velocityX: number;
  velocityY: number;
  sizeBase: number;
  sizeRange: number;
  lifeBase: number;
  lifeRange: number;
  gravity: number;
}

export function clearConfetti(): void {
  document.querySelectorAll(".confetti-canvas").forEach((canvas) => canvas.remove());
}

export function burstConfetti(tone: Tone): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const profile = getBurstProfile(tone, isMobile);
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.dataset.tone = tone;
  canvas.setAttribute("aria-hidden", "true");
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

  const particles: Particle[] = Array.from({ length: profile.count }, () => ({
    x: profile.originX + (Math.random() - 0.5) * profile.spreadX,
    y: profile.originY + (Math.random() - 0.5) * profile.spreadY,
    vx: (Math.random() - 0.5) * profile.velocityX,
    vy: (Math.random() - 0.75) * profile.velocityY,
    size: profile.sizeBase + Math.random() * profile.sizeRange,
    life: profile.lifeBase + Math.random() * profile.lifeRange,
    color: palette[Math.floor(Math.random() * palette.length)],
  }));

  let last = performance.now();
  const animate = (now: number) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles.forEach((particle) => {
      particle.life -= dt;
      particle.vy += profile.gravity * dt;
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

function getBurstProfile(tone: Tone, isMobile: boolean): BurstProfile {
  if (tone === "liquidation") {
    return {
      count: 130,
      originX: window.innerWidth / 2,
      originY: 150,
      spreadX: 240,
      spreadY: 120,
      velocityX: 18,
      velocityY: 12,
      sizeBase: 3,
      sizeRange: 8,
      lifeBase: 0.85,
      lifeRange: 0.7,
      gravity: 22,
    };
  }

  if (isMobile && tone === "cash") {
    return {
      count: 28,
      originX: 143,
      originY: 90,
      spreadX: 170,
      spreadY: 72,
      velocityX: 5,
      velocityY: 6,
      sizeBase: 2,
      sizeRange: 4,
      lifeBase: 0.24,
      lifeRange: 0.18,
      gravity: 16,
    };
  }

  if (isMobile) {
    return {
      count: 36,
      originX: window.innerWidth / 2,
      originY: 82,
      spreadX: Math.min(180, window.innerWidth * 0.48),
      spreadY: 44,
      velocityX: 5.5,
      velocityY: 6.5,
      sizeBase: 2,
      sizeRange: 4,
      lifeBase: 0.3,
      lifeRange: 0.22,
      gravity: 15,
    };
  }

  return {
    count: 90,
    originX: window.innerWidth / 2,
    originY: window.innerHeight * 0.38,
    spreadX: 240,
    spreadY: 0,
    velocityX: 12,
    velocityY: 16,
    sizeBase: 3,
    sizeRange: 8,
    lifeBase: 0.85,
    lifeRange: 0.7,
    gravity: 22,
  };
}

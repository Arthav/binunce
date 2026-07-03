export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(random: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function parseMoneyInput(raw: string): number {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

export function formatInputMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

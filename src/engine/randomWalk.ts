import type { AssetDefinition, AssetPriceState, Candle, Side, VolatilityMode } from "../types";
import { clamp, gaussian, mulberry32 } from "../util/math";

type Regime = AssetPriceState["regime"];

interface WalkerState {
  random: () => number;
  drift: number;
  regime: Regime;
  ticksUntilRegimeFlip: number;
  impulse: number;
}

const walkerStates = new Map<string, WalkerState>();

export function resetWalkers(): void {
  walkerStates.clear();
}

export function buildInitialCandles(asset: AssetDefinition, count = 500): Candle[] {
  const random = mulberry32(asset.seed);
  let price = asset.startPrice;
  const now = Math.floor(Date.now() / 1000);
  const start = now - count;
  const candles: Candle[] = [];
  let dayHigh = price;
  let dayLow = price;

  for (let index = 0; index < count; index += 1) {
    const open = price;
    const shock = gaussian(random) * asset.vol * 0.85;
    const trend = Math.sin((index + asset.seed) / 34) * asset.vol * 0.28;
    price = Math.max(asset.startPrice * 0.18, price * Math.exp(shock + trend));
    const wick = Math.abs(gaussian(random)) * asset.vol * 0.9;
    const high = Math.max(open, price) * (1 + wick);
    const low = Math.max(asset.startPrice * 0.1, Math.min(open, price) * (1 - wick));
    dayHigh = Math.max(dayHigh, high);
    dayLow = Math.min(dayLow, low);
    candles.push({
      time: start + index,
      open,
      high,
      low,
      close: price,
      volume: Math.max(1, price * (0.8 + random() * 4) * 1000),
    });
  }

  return candles;
}

export function initialAssetState(asset: AssetDefinition): AssetPriceState {
  const candles = buildInitialCandles(asset);
  const first = candles[0];
  const last = candles[candles.length - 1];
  return {
    symbol: asset.symbol,
    price: last.close,
    previousPrice: candles[candles.length - 2]?.close ?? last.close,
    direction: last.close >= (candles[candles.length - 2]?.close ?? last.close) ? 1 : -1,
    dayOpen: first.open,
    dayHigh: Math.max(...candles.map((candle) => candle.high)),
    dayLow: Math.min(...candles.map((candle) => candle.low)),
    volume24h: candles.reduce((sum, candle) => sum + candle.volume, 0),
    candles,
    regime: "chop",
  };
}

export function nextSyntheticPrice(
  asset: AssetDefinition,
  state: AssetPriceState,
  volatilityMode: VolatilityMode,
  dt: number,
  exposure?: Side,
): { price: number; regime: Regime } {
  const walker = walkerFor(asset);
  walker.ticksUntilRegimeFlip -= 1;
  if (walker.ticksUntilRegimeFlip <= 0) {
    walker.regime = pickRegime(walker.random);
    walker.drift = driftFor(walker.regime, asset.vol, walker.random);
    walker.ticksUntilRegimeFlip = 20 + Math.floor(walker.random() * 100);
  }

  const modeMultiplier = volatilityMode === "insane" ? 2.5 : 1;
  const vol = asset.vol * modeMultiplier;
  const eventChance = (volatilityMode === "insane" ? 0.052 : 0.022) + asset.vol * 0.35;
  let eventImpulse = walker.impulse;

  if (walker.random() < eventChance) {
    const againstUser = exposure ? walker.random() < 0.56 : false;
    const direction = againstUser ? (exposure === "long" ? -1 : 1) : walker.random() > 0.5 ? 1 : -1;
    const magnitude = 0.015 + walker.random() * (volatilityMode === "insane" ? 0.075 : 0.048);
    eventImpulse += direction * magnitude;
  }

  const meanReversion = clamp((asset.startPrice - state.price) / asset.startPrice, -0.04, 0.04) * 0.02;
  const shock = vol * Math.sqrt(dt) * gaussian(walker.random);
  const drift = (walker.drift + meanReversion - 0.5 * vol * vol) * dt;
  const impulse = eventImpulse * 0.42;
  walker.impulse = eventImpulse * 0.58;

  const next = state.price * Math.exp(drift + shock + impulse);
  const floor = asset.startPrice * 0.02;
  const ceiling = asset.startPrice * 80;
  return {
    price: clamp(next, floor, ceiling),
    regime: walker.regime,
  };
}

function walkerFor(asset: AssetDefinition): WalkerState {
  const existing = walkerStates.get(asset.symbol);
  if (existing) return existing;
  const random = mulberry32(asset.seed + 9001);
  const regime = pickRegime(random);
  const walker: WalkerState = {
    random,
    regime,
    drift: driftFor(regime, asset.vol, random),
    ticksUntilRegimeFlip: 20 + Math.floor(random() * 100),
    impulse: 0,
  };
  walkerStates.set(asset.symbol, walker);
  return walker;
}

function pickRegime(random: () => number): Regime {
  const roll = random();
  if (roll < 0.38) return "bear";
  if (roll < 0.76) return "bull";
  return "chop";
}

function driftFor(regime: Regime, vol: number, random: () => number): number {
  if (regime === "bull") return vol * (0.45 + random() * 0.8);
  if (regime === "bear") return -vol * (0.45 + random() * 0.8);
  return (random() - 0.5) * vol * 0.35;
}

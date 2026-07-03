import type { AssetPriceState, Candle, Position, Side, Timeframe, VolatilityMode } from "../types";
import { ASSETS, DEFAULT_SYMBOL, getAsset } from "./assets";
import { initialAssetState, nextSyntheticPrice, resetWalkers } from "./randomWalk";

type PriceListener = (prices: Record<string, AssetPriceState>, activeSymbol: string) => void;

const MAX_CANDLES = 1500;

export class PriceEngine {
  private prices: Record<string, AssetPriceState>;
  private activeSymbol = DEFAULT_SYMBOL;
  private volatilityMode: VolatilityMode;
  private exposures = new Map<string, Side>();
  private listeners = new Set<PriceListener>();
  private fullTimer = 0;
  private microTimer = 0;
  private lastFullTick = performance.now();

  constructor(volatilityMode: VolatilityMode) {
    resetWalkers();
    this.volatilityMode = volatilityMode;
    this.prices = Object.fromEntries(
      ASSETS.map((asset) => [asset.symbol, initialAssetState(asset)]),
    ) as Record<string, AssetPriceState>;
  }

  start(): void {
    this.stop();
    this.fullTimer = window.setInterval(() => this.fullTick(), 1000);
    this.microTimer = window.setInterval(() => this.microTick(), 250);
  }

  stop(): void {
    window.clearInterval(this.fullTimer);
    window.clearInterval(this.microTimer);
  }

  subscribe(listener: PriceListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot(), this.activeSymbol);
    return () => this.listeners.delete(listener);
  }

  setActiveSymbol(symbol: string): void {
    this.activeSymbol = getAsset(symbol).symbol;
    this.emit();
  }

  setVolatilityMode(mode: VolatilityMode): void {
    this.volatilityMode = mode;
  }

  setPositions(positions: Position[]): void {
    this.exposures.clear();
    positions.forEach((position) => {
      if (!this.exposures.has(position.symbol)) {
        this.exposures.set(position.symbol, position.side);
      }
    });
  }

  getPrices(): Record<string, AssetPriceState> {
    return this.snapshot();
  }

  private fullTick(): void {
    const now = performance.now();
    const elapsedSeconds = Math.min(4, Math.max(1, Math.round((now - this.lastFullTick) / 1000)));
    this.lastFullTick = now;

    for (let step = 0; step < elapsedSeconds; step += 1) {
      ASSETS.forEach((asset) => {
        const current = this.prices[asset.symbol];
        const next = nextSyntheticPrice(
          asset,
          current,
          this.volatilityMode,
          1,
          this.exposures.get(asset.symbol),
        );
        this.prices[asset.symbol] = closeAndOpenCandle(current, next.price, next.regime);
      });
    }

    this.emit();
  }

  private microTick(): void {
    const asset = getAsset(this.activeSymbol);
    const current = this.prices[asset.symbol];
    const next = nextSyntheticPrice(
      asset,
      current,
      this.volatilityMode,
      0.25,
      this.exposures.get(asset.symbol),
    );
    this.prices[asset.symbol] = mutateFormingCandle(current, next.price, next.regime);
    this.emit();
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot, this.activeSymbol));
  }

  private snapshot(): Record<string, AssetPriceState> {
    return Object.fromEntries(
      Object.entries(this.prices).map(([symbol, state]) => [
        symbol,
        {
          ...state,
          candles: state.candles.map((candle) => ({ ...candle })),
        },
      ]),
    ) as Record<string, AssetPriceState>;
  }
}

export function aggregateCandles(candles: Candle[], timeframe: Timeframe): Candle[] {
  const size = timeframe === "1s" ? 1 : timeframe === "5s" ? 5 : timeframe === "15s" ? 15 : 60;
  if (size === 1) return candles;

  const grouped = new Map<number, Candle[]>();
  candles.forEach((candle) => {
    const bucket = Math.floor(candle.time / size) * size;
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), candle]);
  });

  return [...grouped.entries()].map(([time, group]) => {
    const first = group[0];
    const last = group[group.length - 1];
    return {
      time,
      open: first.open,
      high: Math.max(...group.map((candle) => candle.high)),
      low: Math.min(...group.map((candle) => candle.low)),
      close: last.close,
      volume: group.reduce((sum, candle) => sum + candle.volume, 0),
    };
  });
}

function closeAndOpenCandle(
  current: AssetPriceState,
  price: number,
  regime: AssetPriceState["regime"],
): AssetPriceState {
  const candles = current.candles.slice();
  const last = candles[candles.length - 1];
  const updatedLast = {
    ...last,
    close: price,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    volume: last.volume + price * (0.2 + Math.random() * 1.2),
  };
  candles[candles.length - 1] = updatedLast;
  const nextTime = updatedLast.time + 1;
  candles.push({
    time: nextTime,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: price * (0.3 + Math.random() * 2),
  });
  while (candles.length > MAX_CANDLES) candles.shift();
  return buildState(current, candles, price, regime);
}

function mutateFormingCandle(
  current: AssetPriceState,
  price: number,
  regime: AssetPriceState["regime"],
): AssetPriceState {
  const candles = current.candles.slice();
  const last = candles[candles.length - 1];
  candles[candles.length - 1] = {
    ...last,
    close: price,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    volume: last.volume + price * 0.2,
  };
  return buildState(current, candles, price, regime);
}

function buildState(
  previous: AssetPriceState,
  candles: Candle[],
  price: number,
  regime: AssetPriceState["regime"],
): AssetPriceState {
  const dayOpen = candles[0]?.open ?? price;
  return {
    ...previous,
    price,
    previousPrice: previous.price,
    direction: price > previous.price ? 1 : price < previous.price ? -1 : 0,
    dayOpen,
    dayHigh: Math.max(...candles.map((candle) => candle.high)),
    dayLow: Math.min(...candles.map((candle) => candle.low)),
    volume24h: candles.reduce((sum, candle) => sum + candle.volume, 0),
    candles,
    regime,
  };
}

import type { Position, Side } from "../types";
import { clamp, roundMoney } from "../util/math";

export const FEE_RATE = 0.0004;

export function calculateLiquidationPrice(entryPrice: number, side: Side, leverage: number): number {
  const safeLeverage = clamp(leverage, 1, 1000);
  const feeBuffer = Math.min(0.0012, FEE_RATE * 1.5);
  const distance = 1 / safeLeverage;
  if (side === "long") {
    return Math.max(0.00000001, entryPrice * (1 - distance + feeBuffer));
  }
  return Math.max(0.00000001, entryPrice * (1 + distance - feeBuffer));
}

export function calculatePositionPnl(position: Position, markPrice: number): number {
  const gross =
    position.side === "long"
      ? (markPrice - position.entryPrice) * position.size
      : (position.entryPrice - markPrice) * position.size;
  return gross;
}

export function calculateFee(notional: number): number {
  return roundMoney(notional * FEE_RATE);
}

export function calculateRoi(pnl: number, margin: number): number {
  if (margin <= 0) return 0;
  return (pnl / margin) * 100;
}

export function maxMarginForBalance(balance: number): number {
  return Math.max(0, balance / (1 + FEE_RATE));
}

export function buildPosition(input: {
  symbol: string;
  side: Side;
  margin: number;
  leverage: number;
  entryPrice: number;
  tpPrice: number | null;
  slPrice: number | null;
}): Position {
  const margin = roundMoney(input.margin);
  const leverage = Math.round(clamp(input.leverage, 1, 1000));
  const notional = roundMoney(margin * leverage);
  const size = notional / input.entryPrice;
  return {
    id: crypto.randomUUID(),
    symbol: input.symbol,
    side: input.side,
    margin,
    leverage,
    notional,
    size,
    entryPrice: input.entryPrice,
    liqPrice: calculateLiquidationPrice(input.entryPrice, input.side, leverage),
    tpPrice: input.tpPrice,
    slPrice: input.slPrice,
    openedAt: Date.now(),
    feeOpen: calculateFee(notional),
  };
}

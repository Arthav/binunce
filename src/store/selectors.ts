import type {
  AppState,
  DerivedAccount,
  DerivedPosition,
  Position,
  Trade,
} from "../types";
import { calculatePositionPnl, calculateRoi } from "../engine/pnl";

export function derivePositions(state: Pick<AppState, "positions" | "prices">): DerivedPosition[] {
  return state.positions.map((position) => {
    const markPrice = state.prices[position.symbol]?.price ?? position.entryPrice;
    const unrealizedPnl = calculatePositionPnl(position, markPrice);
    const roiPct = calculateRoi(unrealizedPnl, position.margin);
    return {
      ...position,
      markPrice,
      unrealizedPnl,
      roiPct,
      heat: Math.min(1, Math.abs(roiPct) / 180),
    };
  });
}

export function deriveAccount(
  state: Pick<AppState, "account" | "positions" | "trades" | "prices">,
): DerivedAccount {
  const derivedPositions = derivePositions(state);
  const marginUsed = sum(state.positions.map((position) => position.margin));
  const totalUnrealizedPnl = sum(derivedPositions.map((position) => position.unrealizedPnl));
  const walletBalance = state.account.balance;
  const equity = walletBalance + marginUsed + totalUnrealizedPnl;
  const totalRealizedPnl = sum(state.trades.map((trade) => trade.pnl));
  return {
    walletBalance,
    marginUsed,
    totalUnrealizedPnl,
    equity,
    freeMargin: walletBalance,
    winRate:
      state.account.totalTrades > 0
        ? (state.account.totalWins / state.account.totalTrades) * 100
        : 0,
    totalRealizedPnl,
  };
}

export function tradeFromPosition(input: {
  position: Position;
  exitPrice: number;
  pnl: number;
  feeClose: number;
  closeReason: Trade["closeReason"];
  id?: string;
}): Trade {
  const closedAt = Date.now();
  const feeTotal = input.position.feeOpen + input.feeClose;
  const pnlNet = input.pnl - input.feeClose;
  const roiPct = input.position.margin > 0 ? (pnlNet / input.position.margin) * 100 : 0;
  return {
    id: input.id ?? input.position.id,
    symbol: input.position.symbol,
    side: input.position.side,
    margin: input.position.margin,
    leverage: input.position.leverage,
    notional: input.position.notional,
    size: input.position.size,
    entryPrice: input.position.entryPrice,
    exitPrice: input.exitPrice,
    pnl: input.closeReason === "liquidation" ? -input.position.margin : pnlNet,
    pnlPct: input.closeReason === "liquidation" ? -100 : roiPct,
    roiPct: input.closeReason === "liquidation" ? -100 : roiPct,
    feeTotal,
    closeReason: input.closeReason,
    openedAt: input.position.openedAt,
    closedAt,
    durationMs: closedAt - input.position.openedAt,
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

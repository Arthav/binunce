import type { CloseReason, Position } from "../types";

export function getTriggeredCloseReason(position: Position, markPrice: number): CloseReason | null {
  if (position.side === "long" && markPrice <= position.liqPrice) return "liquidation";
  if (position.side === "short" && markPrice >= position.liqPrice) return "liquidation";

  if (position.slPrice !== null) {
    if (position.side === "long" && markPrice <= position.slPrice) return "sl";
    if (position.side === "short" && markPrice >= position.slPrice) return "sl";
  }

  if (position.tpPrice !== null) {
    if (position.side === "long" && markPrice >= position.tpPrice) return "tp";
    if (position.side === "short" && markPrice <= position.tpPrice) return "tp";
  }

  return null;
}

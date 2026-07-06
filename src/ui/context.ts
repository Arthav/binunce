import type { BinunceRepo } from "../db/repo";
import type { PriceEngine } from "../engine/priceEngine";
import type { AppState, DepositMethod, OrderType, Position, Side, Timeframe, Trade } from "../types";
import type { Store } from "../store/store";

export interface PlaceOrderInput {
  symbol: string;
  side: Side;
  orderType: OrderType;
  margin: number;
  leverage: number;
  limitPrice: number | null;
  tpPrice: number | null;
  slPrice: number | null;
}

export interface AppActions {
  selectSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setMobileTab: (tab: AppState["mobileTab"]) => void;
  setPositionsPanelTab: (tab: AppState["positionsPanelTab"]) => void;
  reviewClosePosition: (positionId: string, fraction: number) => void;
  clearCloseReview: () => void;
  setTradeSide: (side: Side) => void;
  openTopup: () => void;
  closeTopup: () => void;
  completeOnboarding: () => void;
  deposit: (amount: number, method: DepositMethod) => void;
  placeOrder: (input: PlaceOrderInput) => void;
  addMarginToPosition: (positionId: string, amount: number) => boolean;
  updatePositionTriggers: (positionId: string, tpPrice: number | null, slPrice: number | null) => boolean;
  closePosition: (position: Position, reason: Trade["closeReason"], fraction?: number) => void;
  closeOpenReceipt: () => void;
  openResult: (trade: Trade) => void;
  closeResult: () => void;
  closeLiquidation: () => void;
  updateSettings: (settings: Partial<AppState["settings"]>) => void;
  updateDisplayName: (displayName: string) => void;
  resetAccount: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  toast: (message: string, tone?: AppState["toasts"][number]["tone"]) => void;
}

export interface UIContext {
  store: Store<AppState>;
  repo: BinunceRepo;
  engine: PriceEngine;
  actions: AppActions;
}

import type { BinunceRepo } from "../db/repo";
import type { PriceEngine } from "../engine/priceEngine";
import type { AppState, DepositMethod, Position, Side, Timeframe, Trade } from "../types";
import type { Store } from "../store/store";

export interface PlaceOrderInput {
  symbol: string;
  side: Side;
  margin: number;
  leverage: number;
  tpPrice: number | null;
  slPrice: number | null;
}

export interface AppActions {
  selectSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setMobileTab: (tab: AppState["mobileTab"]) => void;
  setTradeSide: (side: Side) => void;
  openTopup: () => void;
  closeTopup: () => void;
  completeOnboarding: () => void;
  deposit: (amount: number, method: DepositMethod) => void;
  placeOrder: (input: PlaceOrderInput) => void;
  closePosition: (position: Position, reason: Trade["closeReason"], fraction?: number) => void;
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

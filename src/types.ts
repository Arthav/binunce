export type Side = "long" | "short";
export type CloseReason = "manual" | "tp" | "sl" | "liquidation";
export type DepositMethod = "card" | "crypto" | "bank" | "instant";
export type ChartType = "candles" | "area";
export type VolatilityMode = "normal" | "insane";
export type Timeframe = "1s" | "5s" | "15s" | "1m";

export interface Account {
  id: 1;
  displayName: string;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  createdAt: number;
  highWatermark: number;
  totalTrades: number;
  totalWins: number;
  totalLiquidations: number;
  biggestWin: number;
  biggestLoss: number;
}

export interface Deposit {
  id: string;
  amount: number;
  method: DepositMethod;
  createdAt: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: Side;
  margin: number;
  leverage: number;
  notional: number;
  size: number;
  entryPrice: number;
  liqPrice: number;
  tpPrice: number | null;
  slPrice: number | null;
  openedAt: number;
  feeOpen: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: Side;
  margin: number;
  leverage: number;
  notional: number;
  size: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  roiPct: number;
  feeTotal: number;
  closeReason: CloseReason;
  openedAt: number;
  closedAt: number;
  durationMs: number;
}

export interface Settings {
  soundEnabled: boolean;
  chartType: ChartType;
  theme: "binunce-dark";
  hasOnboarded: boolean;
  volatilityMode: VolatilityMode;
}

export interface AssetDefinition {
  symbol: string;
  displayName: string;
  class: "crypto" | "stock";
  startPrice: number;
  vol: number;
  seed: number;
  logo: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AssetPriceState {
  symbol: string;
  price: number;
  previousPrice: number;
  direction: 1 | -1 | 0;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume24h: number;
  candles: Candle[];
  regime: "bull" | "bear" | "chop";
}

export interface ToastMessage {
  id: string;
  tone: "info" | "success" | "error" | "warning";
  message: string;
}

export interface AppState {
  booting: boolean;
  storageWarning: string | null;
  selectedSymbol: string;
  tradeSide: Side;
  timeframe: Timeframe;
  mobileTab: "markets" | "chart" | "trade" | "positions";
  account: Account;
  deposits: Deposit[];
  positions: Position[];
  trades: Trade[];
  settings: Settings;
  prices: Record<string, AssetPriceState>;
  lastClosedTrade: Trade | null;
  topupOpen: boolean;
  onboardingOpen: boolean;
  settingsOpen: boolean;
  resultOpen: boolean;
  liquidationTrade: Trade | null;
  toasts: ToastMessage[];
}

export interface DerivedPosition extends Position {
  markPrice: number;
  unrealizedPnl: number;
  roiPct: number;
  heat: number;
}

export interface DerivedAccount {
  walletBalance: number;
  marginUsed: number;
  totalUnrealizedPnl: number;
  equity: number;
  freeMargin: number;
  winRate: number;
  totalRealizedPnl: number;
}

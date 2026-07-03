import type { AppState } from "../types";
import { DEFAULT_SYMBOL } from "../engine/assets";
import type { RepoSnapshot } from "../db/repo";

export function createInitialAppState(
  snapshot: RepoSnapshot,
  prices: AppState["prices"],
  storageWarning: string | null,
): AppState {
  return {
    booting: false,
    storageWarning,
    selectedSymbol: DEFAULT_SYMBOL,
    tradeSide: "long",
    timeframe: "1s",
    mobileTab: "chart",
    account: snapshot.account,
    deposits: snapshot.deposits,
    positions: snapshot.positions,
    trades: snapshot.trades,
    settings: snapshot.settings,
    prices,
    lastClosedTrade: null,
    topupOpen: false,
    onboardingOpen: !snapshot.settings.hasOnboarded,
    settingsOpen: false,
    resultOpen: false,
    liquidationTrade: null,
    toasts: [],
  };
}

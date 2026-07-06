import "./styles/globals.css";

import { playSfx, primeAudio, setSoundEnabled } from "./audio/sfx";
import { createRepoRuntime } from "./db/sqlite";
import { getTriggeredCloseReason } from "./engine/liquidation";
import {
  buildPosition,
  calculateFee,
  calculateLiquidationPrice,
  calculatePositionPnl,
  maxMarginForBalance,
} from "./engine/pnl";
import { PriceEngine } from "./engine/priceEngine";
import { createInitialAppState } from "./store/appState";
import { deriveAccount, tradeFromPosition } from "./store/selectors";
import { createStore } from "./store/store";
import type { AppState, Deposit, Position, Settings, Trade } from "./types";
import { clamp, roundMoney } from "./util/math";
import { burstConfetti } from "./ui/confetti";
import type { AppActions, UIContext } from "./ui/context";
import { mountLayout, renderBootSplash } from "./ui/layout";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root.");

renderBootSplash(root);

const runtime = await createRepoRuntime();
const snapshot = runtime.repo.load();
const engine = new PriceEngine(snapshot.settings.volatilityMode);
const store = createStore(createInitialAppState(snapshot, engine.getPrices(), runtime.storageWarning));
const closingIds = new Set<string>();

const actions: AppActions = {
  selectSymbol(symbol) {
    engine.setActiveSymbol(symbol);
    store.set({ selectedSymbol: symbol, mobileTab: "chart", closeReview: null });
    playSfx("click");
  },
  setTimeframe(timeframe) {
    store.set({ timeframe });
    playSfx("click");
  },
  setMobileTab(tab) {
    store.set({ mobileTab: tab, closeReview: tab === "positions" ? store.get().closeReview : null });
    playSfx("click");
  },
  setPositionsPanelTab(tab) {
    store.set({ positionsPanelTab: tab, closeReview: tab === "positions" ? store.get().closeReview : null });
    playSfx("click");
  },
  reviewClosePosition(positionId, fraction) {
    const safeFraction = clamp(fraction, 0.1, 1);
    if (!store.get().positions.some((position) => position.id === positionId)) return;
    store.set({
      closeReview: { positionId, fraction: safeFraction },
      mobileTab: "positions",
      positionsPanelTab: "positions",
    });
    playSfx("click");
  },
  clearCloseReview() {
    store.set({ closeReview: null });
  },
  setTradeSide(side) {
    store.set({ tradeSide: side, mobileTab: "trade", closeReview: null });
    playSfx("click");
  },
  openTopup() {
    store.set({ topupOpen: true });
    playSfx("click");
  },
  closeTopup() {
    store.set({ topupOpen: false });
  },
  completeOnboarding() {
    const next = runtime.repo.updateSettings({ hasOnboarded: true });
    applySnapshot(next, { onboardingOpen: false, topupOpen: true });
  },
  deposit(amount, method) {
    const safeAmount = roundMoney(clamp(amount, 1, 1_000_000_000));
    const deposit: Deposit = {
      id: crypto.randomUUID(),
      amount: safeAmount,
      method,
      createdAt: Date.now(),
    };
    const next = runtime.repo.addDeposit(deposit);
    applySnapshot(next, { topupOpen: false });
    burstConfetti("cash");
    playSfx("cash");
    actions.toast(`Deposited ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(safeAmount)} simulated funds.`, "success");
  },
  placeOrder(input) {
    const state = store.get();
    const markPrice = state.prices[input.symbol]?.price;
    if (!markPrice || markPrice <= 0) {
      actions.toast("No mark price available for this symbol.", "error");
      return;
    }
    const derived = deriveAccount(state);
    const margin = roundMoney(clamp(input.margin, 1, maxMarginForBalance(derived.freeMargin)));
    const leverage = Math.round(clamp(input.leverage, 1, 1000));
    const entryPrice = input.orderType === "limit" ? input.limitPrice : markPrice;
    if (!entryPrice || !Number.isFinite(entryPrice) || entryPrice <= 0) {
      actions.toast("Limit price must be a positive price.", "error");
      return;
    }
    const validation = validateTriggers(input.side, entryPrice, input.tpPrice, input.slPrice);
    if (validation) {
      actions.toast(validation, "error");
      return;
    }
    const position = buildPosition({
      symbol: input.symbol,
      side: input.side,
      margin,
      leverage,
      entryPrice,
      tpPrice: input.tpPrice,
      slPrice: input.slPrice,
    });
    const debit = position.margin + position.feeOpen;
    if (debit > derived.freeMargin || position.margin < 1) {
      actions.toast("Not enough balance - deposit more.", "error");
      return;
    }
    const next = runtime.repo.openPosition(position, debit);
    applySnapshot(next, { mobileTab: "positions", positionsPanelTab: "positions", closeReview: null, lastOpenedPosition: position, toasts: [] });
    engine.setPositions(next.positions);
    playSfx("click");
  },
  updatePositionTriggers(positionId, tpPrice, slPrice) {
    const state = store.get();
    const position = state.positions.find((item) => item.id === positionId);
    if (!position) {
      actions.toast("Position is no longer open.", "error");
      return false;
    }
    const markPrice = state.prices[position.symbol]?.price ?? position.entryPrice;
    const validation = validateOpenPositionTriggers(position.side, markPrice, tpPrice, slPrice);
    if (validation) {
      actions.toast(validation, "error");
      return false;
    }
    const next = runtime.repo.updatePositionTriggers(position.id, tpPrice, slPrice);
    applySnapshot(next, { closeReview: null });
    engine.setPositions(next.positions);
    actions.toast(tpPrice === null && slPrice === null ? "TP / SL cleared." : "TP / SL updated.", "success");
    playSfx("click");
    return true;
  },
  addMarginToPosition(positionId, amount) {
    const state = store.get();
    const position = state.positions.find((item) => item.id === positionId);
    if (!position) {
      actions.toast("Position is no longer open.", "error");
      return false;
    }
    const derived = deriveAccount(state);
    const safeAmount = roundMoney(amount);
    const maxAdd = roundMoney(Math.min(derived.freeMargin, Math.max(0, position.notional - position.margin)));
    if (!Number.isFinite(safeAmount) || safeAmount < 1) {
      actions.toast("Add at least $1 margin.", "error");
      return false;
    }
    if (maxAdd < 1) {
      actions.toast("This position is already near 1x margin.", "warning");
      return false;
    }
    if (safeAmount > maxAdd) {
      actions.toast(`Add up to ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(maxAdd)} margin.`, "error");
      return false;
    }
    const nextMargin = roundMoney(position.margin + safeAmount);
    const nextLeverage = Math.max(1, position.notional / nextMargin);
    const nextPosition: Position = {
      ...position,
      margin: nextMargin,
      leverage: nextLeverage,
      liqPrice: calculateLiquidationPrice(position.entryPrice, position.side, nextLeverage),
    };
    const next = runtime.repo.addMarginToPosition(nextPosition, safeAmount);
    applySnapshot(next, { closeReview: null });
    engine.setPositions(next.positions);
    actions.toast(`Added ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(safeAmount)} margin to ${position.symbol}.`, "success");
    playSfx("click");
    return true;
  },
  closePosition(position, reason, fraction = 1) {
    closePosition(position, reason, fraction);
  },
  closeOpenReceipt() {
    store.set({ lastOpenedPosition: null });
  },
  openResult(trade) {
    store.set({ lastClosedTrade: trade, resultOpen: true });
  },
  closeResult() {
    store.set({ resultOpen: false });
  },
  closeLiquidation() {
    store.set({ liquidationTrade: null });
  },
  updateSettings(settings) {
    const next = runtime.repo.updateSettings(settings);
    applySnapshot(next);
    if (settings.volatilityMode) engine.setVolatilityMode(settings.volatilityMode);
    if (typeof settings.soundEnabled === "boolean") setSoundEnabled(settings.soundEnabled);
    playSfx("click");
  },
  updateDisplayName(displayName) {
    const next = runtime.repo.updateDisplayName(displayName);
    applySnapshot(next);
  },
  resetAccount() {
    const next = runtime.repo.reset();
    applySnapshot(next, {
      topupOpen: false,
      resultOpen: false,
      liquidationTrade: null,
      lastClosedTrade: null,
      lastOpenedPosition: null,
      closeReview: null,
      onboardingOpen: false,
    });
    actions.toast("Account reset. Wallet is back to $0.", "warning");
  },
  openSettings() {
    store.set({ settingsOpen: true });
    playSfx("click");
  },
  closeSettings() {
    store.set({ settingsOpen: false });
  },
  toast(message, tone = "info") {
    const id = crypto.randomUUID();
    store.set((state) => ({
      toasts: [...state.toasts, { id, tone, message }],
    }));
    window.setTimeout(() => {
      store.set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }));
    }, 3400);
  },
};

const ctx: UIContext = {
  store,
  repo: runtime.repo,
  engine,
  actions,
};

mountLayout(root, ctx);
engine.setPositions(snapshot.positions);
engine.start();

engine.subscribe((prices) => {
  store.set({ prices });
  evaluateAutoCloses();
});

store.subscribe((state, previous) => {
  if (state.positions !== previous.positions) engine.setPositions(state.positions);
  if (state.settings.volatilityMode !== previous.settings.volatilityMode) {
    engine.setVolatilityMode(state.settings.volatilityMode);
  }
  if (state.settings.soundEnabled !== previous.settings.soundEnabled) {
    setSoundEnabled(state.settings.soundEnabled);
  }
});

document.addEventListener(
  "pointerdown",
  () => {
    primeAudio();
  },
  { once: true },
);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    void runtime.flush();
  }
});

window.addEventListener("beforeunload", () => {
  void runtime.flush();
});

window.addEventListener("focus", () => {
  const latest = runtime.repo.load();
  applySnapshot(latest);
});

function applySnapshot(
  next: ReturnType<typeof runtime.repo.load>,
  extra: Partial<AppState> = {},
): void {
  store.set({
    account: next.account,
    deposits: next.deposits,
    positions: next.positions,
    trades: next.trades,
    settings: next.settings,
    ...extra,
  });
  void runtime.flush();
}

function closePosition(position: Position, reason: Trade["closeReason"], fraction = 1): void {
  if (closingIds.has(position.id)) return;
  const state = store.get();
  const fresh = state.positions.find((item) => item.id === position.id);
  if (!fresh) return;

  closingIds.add(fresh.id);
  try {
    const closeFraction = clamp(fraction, 0.1, 1);
    const exitPrice =
      reason === "tp" && fresh.tpPrice
        ? fresh.tpPrice
        : reason === "sl" && fresh.slPrice
          ? fresh.slPrice
          : reason === "liquidation"
            ? fresh.liqPrice
            : state.prices[fresh.symbol]?.price ?? fresh.entryPrice;

    const closingPosition: Position = {
      ...fresh,
      id: closeFraction < 1 ? `${fresh.id}-partial-${crypto.randomUUID()}` : fresh.id,
      margin: roundMoney(fresh.margin * closeFraction),
      notional: roundMoney(fresh.notional * closeFraction),
      size: fresh.size * closeFraction,
      feeOpen: roundMoney(fresh.feeOpen * closeFraction),
    };

    const feeClose = reason === "liquidation" ? 0 : calculateFee(closingPosition.notional);
    const grossPnl =
      reason === "liquidation" ? -closingPosition.margin : calculatePositionPnl(closingPosition, exitPrice);
    const trade = tradeFromPosition({
      position: closingPosition,
      exitPrice,
      pnl: grossPnl,
      feeClose,
      closeReason: reason,
      id: closingPosition.id,
    });
    const credit = reason === "liquidation" ? 0 : roundMoney(closingPosition.margin + trade.pnl);

    let nextSnapshot: ReturnType<typeof runtime.repo.load>;
    let remaining: Position | null = null;

    if (closeFraction < 1 && reason !== "liquidation") {
      remaining = {
        ...fresh,
        margin: roundMoney(fresh.margin - closingPosition.margin),
        notional: roundMoney(fresh.notional - closingPosition.notional),
        size: fresh.size - closingPosition.size,
        feeOpen: roundMoney(fresh.feeOpen - closingPosition.feeOpen),
      };
      const highWatermark = estimateHighWatermarkAfter(credit, fresh.id, remaining);
      nextSnapshot = runtime.repo.partialClosePosition(fresh.id, remaining, trade, credit, highWatermark);
    } else {
      const highWatermark = estimateHighWatermarkAfter(credit, fresh.id, null);
      nextSnapshot = runtime.repo.closePosition(fresh.id, trade, credit, highWatermark);
    }

    applySnapshot(nextSnapshot, {
      lastClosedTrade: trade,
      resultOpen: reason !== "liquidation",
      liquidationTrade: reason === "liquidation" ? trade : store.get().liquidationTrade,
      closeReview: null,
      toasts: [],
    });
    if (reason === "liquidation") {
      document.body.classList.add("screen-rekt");
      window.setTimeout(() => document.body.classList.remove("screen-rekt"), 760);
      burstConfetti("liquidation");
      playSfx("liquidate");
    } else if (trade.pnl >= 0) {
      burstConfetti("win");
      playSfx("win");
    } else {
      burstConfetti("loss");
      playSfx("loss");
    }
  } finally {
    closingIds.delete(position.id);
  }
}

function evaluateAutoCloses(): void {
  const state = store.get();
  state.positions.forEach((position) => {
    if (closingIds.has(position.id)) return;
    const mark = state.prices[position.symbol]?.price;
    if (!mark) return;
    const reason = getTriggeredCloseReason(position, mark);
    if (reason) closePosition(position, reason, 1);
  });
}

function estimateHighWatermarkAfter(
  credit: number,
  closingPositionId: string,
  remaining: Position | null,
): number {
  const state = store.get();
  const positions = state.positions.filter((position) => position.id !== closingPositionId);
  if (remaining) positions.push(remaining);
  const account = {
    ...state.account,
    balance: roundMoney(state.account.balance + credit),
  };
  const equity = deriveAccount({ ...state, account, positions }).equity;
  return Math.max(state.account.highWatermark, equity);
}

function validateTriggers(
  side: Position["side"],
  entryPrice: number,
  tpPrice: number | null,
  slPrice: number | null,
): string | null {
  if (tpPrice !== null && (!Number.isFinite(tpPrice) || tpPrice <= 0)) {
    return "Take-profit must be a positive price.";
  }
  if (slPrice !== null && (!Number.isFinite(slPrice) || slPrice <= 0)) {
    return "Stop-loss must be a positive price.";
  }
  if (tpPrice !== null && Number.isFinite(tpPrice)) {
    if (side === "long" && tpPrice <= entryPrice) return "Take-profit must be above entry for longs.";
    if (side === "short" && tpPrice >= entryPrice) return "Take-profit must be below entry for shorts.";
  }
  if (slPrice !== null && Number.isFinite(slPrice)) {
    if (side === "long" && slPrice >= entryPrice) return "Stop-loss must be below entry for longs.";
    if (side === "short" && slPrice <= entryPrice) return "Stop-loss must be above entry for shorts.";
  }
  return null;
}

function validateOpenPositionTriggers(
  side: Position["side"],
  markPrice: number,
  tpPrice: number | null,
  slPrice: number | null,
): string | null {
  if (tpPrice !== null && (!Number.isFinite(tpPrice) || tpPrice <= 0)) {
    return "Take-profit must be a positive price.";
  }
  if (slPrice !== null && (!Number.isFinite(slPrice) || slPrice <= 0)) {
    return "Stop-loss must be a positive price.";
  }
  if (tpPrice !== null && Number.isFinite(tpPrice)) {
    if (side === "long" && tpPrice <= markPrice) return "Take-profit must be above live mark for longs.";
    if (side === "short" && tpPrice >= markPrice) return "Take-profit must be below live mark for shorts.";
  }
  if (slPrice !== null && Number.isFinite(slPrice)) {
    if (side === "long" && slPrice >= markPrice) return "Stop-loss must be below live mark for longs.";
    if (side === "short" && slPrice <= markPrice) return "Stop-loss must be above live mark for shorts.";
  }
  return null;
}

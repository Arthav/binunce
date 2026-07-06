import { setSoundEnabled } from "../audio/sfx";
import { deriveAccount, derivePositions } from "../store/selectors";
import { formatCompact, formatCurrency, formatPercent, formatPrice, formatSignedCurrency, formatSignedPercent } from "../util/format";
import type { AppState, DerivedAccount, DerivedPosition } from "../types";
import type { UIContext } from "./context";
import { mountChart } from "./chart";
import { escapeHtml, icon } from "./dom";
import { mountLiquidationModal } from "./liquidationModal";
import { mountMarketList } from "./marketList";
import { mountOpenPositionReceipt } from "./openPositionReceipt";
import { mountOrderPanel } from "./orderPanel";
import { mountPositionsPanel } from "./positionsPanel";
import { mountResultModal } from "./resultModal";
import { mountSettingsDrawer } from "./settingsDrawer";
import { tickerMarkup } from "./ticker";
import { mountToastHost } from "./toast";
import { mountTopupModal } from "./topupModal";

export function renderBootSplash(root: HTMLElement): void {
  root.innerHTML = `<main class="grid min-h-screen place-items-center bg-base text-primary">
    <div class="w-[min(420px,calc(100vw-32px))] text-center">
      <div class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-4xl font-black text-black">B</div>
      <div class="mt-5 text-4xl font-black">Binunce</div>
      <div class="mt-2 text-sm font-bold text-secondary">Loading simulated futures terminal...</div>
      <div class="mt-7 h-2 overflow-hidden rounded-full bg-elevated">
        <div class="h-full w-2/3 animate-pulse rounded-full bg-brand"></div>
      </div>
      <div class="mt-4 text-[11px] font-black text-brand">SIMULATION - NO REAL MONEY</div>
    </div>
  </main>`;
}

export function mountLayout(root: HTMLElement, ctx: UIContext): void {
  root.innerHTML = `<div class="min-h-screen bg-base text-primary">
    <header class="sticky top-0 z-40 border-b border-line bg-[#0b0e11]/95 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur" data-top-nav></header>
    <div class="px-3 pb-[calc(88px+env(safe-area-inset-bottom))] pt-3 lg:px-4 lg:pb-3">
      <div class="mb-3 hidden rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-brand" data-storage-warning></div>
      <main class="grid min-w-0 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_320px] lg:grid-rows-[minmax(520px,calc(100vh-390px))_minmax(260px,1fr)]">
        <div data-pane="markets" class="min-h-[320px] min-w-0"></div>
        <div data-pane="chart" class="min-h-[420px] min-w-0"></div>
        <div data-pane="trade" class="min-h-[520px] min-w-0 lg:row-span-2"></div>
        <div data-pane="positions" class="min-h-[260px] min-w-0 lg:col-span-2 lg:row-start-2"></div>
      </main>
    </div>
    <nav class="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 gap-1 border-t border-line bg-[#0b0e11]/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_36px_rgba(0,0,0,0.32)] backdrop-blur lg:hidden" data-mobile-nav></nav>
    <div class="simulation-watermark">SIMULATION - NO REAL MONEY</div>
    <div data-onboarding-root></div>
    <div data-account-root></div>
    <div data-topup-root></div>
    <div data-open-position-root></div>
    <div data-result-root></div>
    <div data-liquidation-root></div>
    <div data-settings-root></div>
    <div data-toast-root></div>
  </div>`;

  const navRoot = root.querySelector<HTMLElement>("[data-top-nav]")!;
  const storageWarning = root.querySelector<HTMLElement>("[data-storage-warning]")!;
  const mobileNav = root.querySelector<HTMLElement>("[data-mobile-nav]")!;
  const accountRoot = root.querySelector<HTMLElement>("[data-account-root]")!;
  let onboardingStep = 0;
  let accountSheetOpen = false;
  const panes = {
    markets: root.querySelector<HTMLElement>('[data-pane="markets"]')!,
    chart: root.querySelector<HTMLElement>('[data-pane="chart"]')!,
    trade: root.querySelector<HTMLElement>('[data-pane="trade"]')!,
    positions: root.querySelector<HTMLElement>('[data-pane="positions"]')!,
  } satisfies Record<AppState["mobileTab"], HTMLElement>;

  mountMarketList(panes.markets, ctx);
  mountChart(panes.chart, ctx);
  mountOrderPanel(panes.trade, ctx);
  mountPositionsPanel(panes.positions, ctx);
  mountTopupModal(root.querySelector<HTMLElement>("[data-topup-root]")!, ctx);
  mountOpenPositionReceipt(root.querySelector<HTMLElement>("[data-open-position-root]")!, ctx);
  mountResultModal(root.querySelector<HTMLElement>("[data-result-root]")!, ctx);
  mountLiquidationModal(root.querySelector<HTMLElement>("[data-liquidation-root]")!, ctx);
  mountSettingsDrawer(root.querySelector<HTMLElement>("[data-settings-root]")!, ctx);
  mountToastHost(root.querySelector<HTMLElement>("[data-toast-root]")!, ctx);

  navRoot.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-open-account-sheet]")) {
      accountSheetOpen = true;
      renderAccountSheet(root, ctx, accountSheetOpen);
      return;
    }
    if (target.closest("[data-open-deposit]")) ctx.actions.openTopup();
    if (target.closest("[data-open-settings]")) ctx.actions.openSettings();
  });

  accountRoot.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-close-account]") || target.matches("[data-account-backdrop]")) {
      accountSheetOpen = false;
      renderAccountSheet(root, ctx, accountSheetOpen);
      return;
    }
    if (target.closest("[data-account-deposit]")) {
      accountSheetOpen = false;
      renderAccountSheet(root, ctx, accountSheetOpen);
      ctx.actions.openTopup();
      return;
    }
    if (target.closest("[data-account-positions]")) {
      accountSheetOpen = false;
      renderAccountSheet(root, ctx, accountSheetOpen);
      ctx.actions.setMobileTab("positions");
      ctx.actions.setPositionsPanelTab("positions");
      return;
    }
    if (target.closest("[data-account-settings]")) {
      accountSheetOpen = false;
      renderAccountSheet(root, ctx, accountSheetOpen);
      ctx.actions.openSettings();
    }
  });

  mobileNav.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>("[data-mobile-tab]");
    if (button) ctx.actions.setMobileTab(button.dataset.mobileTab as AppState["mobileTab"]);
  });

  root.querySelector<HTMLElement>("[data-onboarding-root]")!.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const nextButton = target.closest<HTMLElement>("[data-onboarding-next]");
    if (nextButton) {
      const current = Number(nextButton.dataset.onboardingNext ?? 0);
      if (current >= 2) ctx.actions.completeOnboarding();
      else {
        onboardingStep = current + 1;
        renderOnboarding(root, ctx, onboardingStep);
      }
    }
    if (target.closest("[data-onboarding-skip]")) ctx.actions.completeOnboarding();
  });

  ctx.store.subscribe((state) => {
    setSoundEnabled(state.settings.soundEnabled);
    const derived = deriveAccount(state);
    const pnlColor =
      derived.totalUnrealizedPnl > 0 ? "text-long shadow-win" : derived.totalUnrealizedPnl < 0 ? "text-short shadow-loss" : "text-primary";
    const marginUsagePct = derived.marginUsed > 0 && derived.equity > 0 ? (derived.marginUsed / derived.equity) * 100 : 0;
    const riskColor =
      marginUsagePct >= 75 ? "text-short" : marginUsagePct >= 45 ? "text-brand" : derived.marginUsed > 0 ? "text-long" : "text-secondary";
    navRoot.innerHTML = `<div class="grid min-h-[88px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:min-h-[72px] sm:grid-cols-[auto_minmax(0,1fr)_auto] lg:flex lg:min-h-14 lg:gap-3 lg:px-4 lg:py-0">
      <div class="flex min-w-0 items-center gap-2">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-lg font-black text-black shadow-[0_0_22px_rgba(240,185,11,0.22)] sm:h-9 sm:w-9">B</div>
        <div class="hidden min-w-0 min-[430px]:block">
          <div class="truncate text-sm font-black leading-none sm:text-lg">Binunce</div>
          <div class="whitespace-nowrap text-[10px] font-black text-brand">FUTURES SIM</div>
        </div>
      </div>
      <div class="hidden min-w-0 text-xs font-bold text-secondary md:block">${state.selectedSymbol} synthetic perpetual</div>
      <div class="min-w-0 text-center lg:ml-auto lg:flex lg:items-center lg:gap-3 lg:text-right">
        <div class="hidden text-right sm:block">
          <div class="text-[10px] font-black uppercase text-secondary">Wallet</div>
          <div class="font-mono text-sm font-black">${formatCurrency(derived.walletBalance)}</div>
        </div>
        ${mobileAccountButton(derived, marginUsagePct, pnlColor, riskColor)}
        <div class="hidden min-w-0 sm:block">
          <div class="flex items-center justify-center gap-1 text-[10px] font-black uppercase text-secondary lg:justify-end">
            <span>Equity / Unrealized</span>
          </div>
          <div class="mx-auto max-w-full overflow-hidden whitespace-nowrap font-mono text-[clamp(1.28rem,6.2vw,1.9rem)] font-black leading-tight tracking-normal sm:max-w-none sm:text-4xl lg:mx-0 ${pnlColor}">
            ${tickerMarkup(formatCurrency(derived.equity))}
          </div>
          <div class="font-mono text-xs font-black ${derived.totalUnrealizedPnl >= 0 ? "text-long" : "text-short"}">${formatSignedCurrency(derived.totalUnrealizedPnl)} / ${formatSignedPercent(derived.marginUsed > 0 ? (derived.totalUnrealizedPnl / derived.marginUsed) * 100 : 0)}</div>
        </div>
      </div>
      <div class="flex items-center justify-end gap-2">
        <button class="btn btn-primary hidden items-center gap-2 sm:flex" data-open-deposit>${icon("deposit")} Deposit</button>
        <button class="btn btn-primary !min-h-11 px-3 text-sm sm:hidden" data-open-deposit>Deposit</button>
        <button class="btn btn-ghost grid !h-9 !w-9 place-items-center !p-0" data-open-settings aria-label="Open settings">${icon("settings")}</button>
        <div class="hidden rounded-full border border-brand/30 px-3 py-1 text-[10px] font-black text-brand xl:block">SIMULATION</div>
      </div>
    </div>`;

    storageWarning.textContent = state.storageWarning ?? "";
    storageWarning.classList.toggle("hidden", !state.storageWarning);
    mobileNav.innerHTML = (["markets", "chart", "trade", "positions"] as AppState["mobileTab"][])
      .map((tab) => mobileTabButton(tab, state))
      .join("");
    Object.entries(panes).forEach(([key, pane]) => {
      pane.classList.toggle("hidden", state.mobileTab !== key);
      pane.classList.add("lg:block");
    });
    renderOnboarding(root, ctx, onboardingStep);
    renderAccountSheet(root, ctx, accountSheetOpen);
  });
}

function renderAccountSheet(root: HTMLElement, ctx: UIContext, open: boolean): void {
  const target = root.querySelector<HTMLElement>("[data-account-root]");
  if (!target) return;
  if (!open) {
    target.innerHTML = "";
    return;
  }
  const state = ctx.store.get();
  const derived = deriveAccount(state);
  const positions = derivePositions(state);
  const marginUsagePct = derived.marginUsed > 0 && derived.equity > 0 ? (derived.marginUsed / derived.equity) * 100 : 0;
  const riskColor =
    marginUsagePct >= 75 ? "text-short" : marginUsagePct >= 45 ? "text-brand" : derived.marginUsed > 0 ? "text-long" : "text-secondary";
  const pnlColor = derived.totalUnrealizedPnl > 0 ? "text-long" : derived.totalUnrealizedPnl < 0 ? "text-short" : "text-primary";
  target.innerHTML = `<div class="modal-backdrop" data-account-backdrop>
    <div class="modal-panel flex h-[min(650px,calc(100dvh-env(safe-area-inset-top)))] w-full flex-col md:h-auto md:w-[min(560px,100%)]">
      <div class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-[#12161b]/95 px-5 py-4 backdrop-blur">
        <div>
          <div class="text-[11px] font-black uppercase text-brand">Account</div>
          <div class="mt-1 text-2xl font-black">Wallet and risk</div>
        </div>
        <button class="btn btn-ghost grid !h-9 !w-9 place-items-center !p-0" data-close-account aria-label="Close account details">${icon("close")}</button>
      </div>
      <div class="min-h-0 flex-1 overflow-auto p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div class="rounded-xl border border-brand/25 bg-brand/10 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-[10px] font-black uppercase text-secondary">Equity</div>
              <div class="mt-1 font-mono text-3xl font-black leading-none ${pnlColor}">${tickerMarkup(formatCurrency(derived.equity))}</div>
              <div class="mt-2 font-mono text-xs font-black ${derived.totalUnrealizedPnl >= 0 ? "text-long" : "text-short"}">${formatSignedCurrency(derived.totalUnrealizedPnl)} unrealized</div>
            </div>
            <div class="rounded-lg border border-line bg-[#0b0f13]/80 px-3 py-2 text-right">
              <div class="text-[9px] font-black uppercase text-secondary">Risk</div>
              <div class="mt-1 font-mono text-base font-black ${riskColor}">${formatPercent(marginUsagePct)}</div>
              <div class="text-[10px] font-black ${riskColor}">${accountRiskLabel(marginUsagePct, positions.length)}</div>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2">
            ${accountMetric("Free", formatCompactCurrency(derived.freeMargin))}
            ${accountMetric("Margin", formatCompactCurrency(derived.marginUsed), derived.marginUsed > 0 ? "text-brand" : "text-secondary")}
            ${accountMetric("Open", String(positions.length), positions.length > 0 ? "text-brand" : "text-secondary")}
          </div>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2">
          ${accountMetric("Wallet", formatCurrency(derived.walletBalance))}
          ${accountMetric("Realized", formatSignedCurrency(derived.totalRealizedPnl), derived.totalRealizedPnl >= 0 ? "text-long" : "text-short")}
          ${accountMetric("Win rate", formatPercent(derived.winRate), derived.winRate >= 50 ? "text-long" : "text-secondary")}
          ${accountMetric("Deposited", formatCurrency(state.account.totalDeposited), "text-primary")}
        </div>
        <div class="mt-4 rounded-xl border border-line bg-[#0b0f13]/70 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-black">Exposure</div>
              <div class="mt-1 text-xs font-semibold text-secondary">${positions.length > 0 ? "Live positions update with synthetic marks." : "No open exposure. Free margin is fully available."}</div>
            </div>
            <button class="chip" data-account-positions>${positions.length > 0 ? "Manage" : "Positions"}</button>
          </div>
          <div class="mt-3 grid gap-2">
            ${
              positions.length > 0
                ? positions.slice(0, 3).map(accountPositionRow).join("")
                : `<div class="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm font-bold text-secondary">Open a ticket when you want simulated exposure.</div>`
            }
          </div>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <button class="btn btn-primary !min-h-11 px-2" data-account-deposit>Deposit</button>
          <button class="btn btn-ghost !min-h-11 px-2" data-account-positions>Positions</button>
          <button class="btn btn-ghost !min-h-11 px-2" data-account-settings>Settings</button>
        </div>
      </div>
    </div>
  </div>`;
}

function mobileAccountButton(derived: DerivedAccount, marginUsagePct: number, pnlColor: string, riskColor: string): string {
  return `<button class="grid min-w-0 rounded-xl border border-line/80 bg-[#11161b]/80 px-2 py-1 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-brand/45 sm:hidden" data-open-account-sheet aria-label="Open account details">
    <span class="flex min-w-0 items-center justify-center gap-1 text-[10px] font-black uppercase text-secondary">
      <span>Equity</span>
      <span class="rounded border border-line bg-[#0b0f13] px-1 py-0.5 font-mono text-[9px] leading-none ${riskColor}" data-account-metric="risk">Risk ${formatPercent(marginUsagePct)}</span>
    </span>
    <span class="mt-0.5 block max-w-full overflow-hidden whitespace-nowrap font-mono text-[clamp(1.08rem,5.1vw,1.34rem)] font-black leading-tight tracking-normal ${pnlColor}">
      ${tickerMarkup(formatCurrency(derived.equity))}
    </span>
    <span class="font-mono text-[11px] font-black ${derived.totalUnrealizedPnl >= 0 ? "text-long" : "text-short"}">${formatSignedCurrency(derived.totalUnrealizedPnl)} / ${formatSignedPercent(derived.marginUsed > 0 ? (derived.totalUnrealizedPnl / derived.marginUsed) * 100 : 0)}</span>
    <span class="mt-0.5 truncate font-mono text-[9px] font-black uppercase text-secondary" data-account-strip>Free ${formatCompactCurrency(derived.freeMargin)} / Margin ${formatCompactCurrency(derived.marginUsed)}</span>
  </button>`;
}

function accountMetric(label: string, value: string, colorClass = "text-primary"): string {
  return `<div class="min-w-0 rounded-lg border border-line bg-[#11161b] p-3">
    <div class="truncate text-[10px] font-black uppercase text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono text-sm font-black ${colorClass}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

function accountPositionRow(position: DerivedPosition): string {
  const positive = position.unrealizedPnl >= 0;
  return `<div class="rounded-lg border border-line bg-[#11161b] px-3 py-2">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="truncate text-sm font-black">${escapeHtml(position.symbol)}</div>
        <div class="mt-1 text-[11px] font-black ${position.side === "long" ? "text-long" : "text-short"}">${position.side.toUpperCase()} ${position.leverage}x</div>
      </div>
      <div class="text-right">
        <div class="font-mono text-sm font-black ${positive ? "text-long" : "text-short"}">${formatSignedCurrency(position.unrealizedPnl)}</div>
        <div class="font-mono text-[11px] font-black ${positive ? "text-long" : "text-short"}">${formatSignedPercent(position.roiPct)}</div>
      </div>
    </div>
    <div class="mt-2 grid grid-cols-2 gap-2 text-[10px] font-semibold text-secondary">
      <span class="truncate">Margin <span class="font-mono font-black text-primary">${formatCompactCurrency(position.margin)}</span></span>
      <span class="truncate text-right">Liq <span class="font-mono font-black text-primary">${formatPrice(position.liqPrice)}</span></span>
    </div>
  </div>`;
}

function accountRiskLabel(marginUsagePct: number, openPositions: number): string {
  if (marginUsagePct >= 75) return "High";
  if (marginUsagePct >= 45) return "Watch";
  if (openPositions > 0) return "Active";
  return "Idle";
}

function renderOnboarding(root: HTMLElement, ctx: UIContext, step: number): void {
  const target = root.querySelector<HTMLElement>("[data-onboarding-root]");
  if (!target) return;
  const state = ctx.store.get();
  if (!state.onboardingOpen) {
    target.innerHTML = "";
    return;
  }
  const slides = [
    {
      title: "Welcome to Binunce",
      body: "A browser-only simulated futures terminal built for fake adrenaline and zero real settlement.",
    },
    {
      title: "This is a simulation",
      body: "Every chart, position, receipt, and deposit is synthetic. No real money enters this app.",
    },
    {
      title: "Top up to start",
      body: "Deposit imaginary funds, open ridiculous leverage, and watch the PnL swing hard.",
    },
  ];
  const slide = slides[step] ?? slides[0];
  target.innerHTML = `<div class="modal-backdrop">
    <div class="modal-panel w-[min(520px,100%)] p-6 text-center">
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand text-3xl font-black text-black">B</div>
      <div class="mt-5 text-3xl font-black">${slide.title}</div>
      <div class="mt-3 text-sm font-semibold leading-6 text-secondary">${slide.body}</div>
      <div class="mt-6 flex justify-center gap-2">
        ${slides.map((_, index) => `<span class="h-2 w-8 rounded-full ${index === step ? "bg-brand" : "bg-elevated"}"></span>`).join("")}
      </div>
      <div class="mt-7 flex gap-3">
        <button class="btn btn-ghost flex-1" data-onboarding-skip>Skip</button>
        <button class="btn btn-primary flex-1" data-onboarding-next="${step}">${step === 2 ? "Open deposit" : "Next"}</button>
      </div>
      <div class="mt-4 text-[11px] font-black text-brand">SIMULATION - NO REAL MONEY</div>
    </div>
  </div>`;
}

function label(tab: AppState["mobileTab"]): string {
  if (tab === "markets") return "Markets";
  if (tab === "chart") return "Chart";
  if (tab === "trade") return "Trade";
  return "Positions";
}

function mobileTabButton(tab: AppState["mobileTab"], state: AppState): string {
  const active = state.mobileTab === tab;
  const count = tab === "positions" ? state.positions.length : 0;
  return `<button class="mobile-tab ${active ? "mobile-tab-active" : ""}" data-mobile-tab="${tab}" aria-label="${label(tab)}">
    <span class="relative grid place-items-center">
      ${icon(tab)}
      ${count > 0 ? `<span class="mobile-tab-badge">${count}</span>` : ""}
    </span>
    <span>${label(tab)}</span>
  </button>`;
}

function formatCompactCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? "-" : "";
  return `${sign}$${formatCompact(Math.abs(safe))}`;
}

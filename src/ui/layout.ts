import { setSoundEnabled } from "../audio/sfx";
import { deriveAccount } from "../store/selectors";
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from "../util/format";
import type { AppState } from "../types";
import type { UIContext } from "./context";
import { mountChart } from "./chart";
import { icon } from "./dom";
import { mountLiquidationModal } from "./liquidationModal";
import { mountMarketList } from "./marketList";
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
    <header class="sticky top-0 z-40 border-b border-line bg-[#0b0e11]/95 backdrop-blur" data-top-nav></header>
    <div class="px-3 pb-[calc(88px+env(safe-area-inset-bottom))] pt-3 lg:px-4 lg:pb-3">
      <div class="mb-3 hidden rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-brand" data-storage-warning></div>
      <main class="grid min-w-0 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_320px] lg:grid-rows-[minmax(520px,calc(100vh-390px))_minmax(260px,1fr)]">
        <div data-pane="markets" class="min-h-[320px]"></div>
        <div data-pane="chart" class="min-h-[420px]"></div>
        <div data-pane="trade" class="min-h-[520px] lg:row-span-2"></div>
        <div data-pane="positions" class="min-h-[260px] lg:col-span-2 lg:row-start-2"></div>
      </main>
    </div>
    <nav class="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 gap-1 border-t border-line bg-[#0b0e11]/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" data-mobile-nav></nav>
    <div class="simulation-watermark">SIMULATION - NO REAL MONEY</div>
    <div data-onboarding-root></div>
    <div data-topup-root></div>
    <div data-result-root></div>
    <div data-liquidation-root></div>
    <div data-settings-root></div>
    <div data-toast-root></div>
  </div>`;

  const navRoot = root.querySelector<HTMLElement>("[data-top-nav]")!;
  const storageWarning = root.querySelector<HTMLElement>("[data-storage-warning]")!;
  const mobileNav = root.querySelector<HTMLElement>("[data-mobile-nav]")!;
  let onboardingStep = 0;
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
  mountResultModal(root.querySelector<HTMLElement>("[data-result-root]")!, ctx);
  mountLiquidationModal(root.querySelector<HTMLElement>("[data-liquidation-root]")!, ctx);
  mountSettingsDrawer(root.querySelector<HTMLElement>("[data-settings-root]")!, ctx);
  mountToastHost(root.querySelector<HTMLElement>("[data-toast-root]")!, ctx);

  navRoot.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-open-deposit]")) ctx.actions.openTopup();
    if (target.closest("[data-open-settings]")) ctx.actions.openSettings();
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
    navRoot.innerHTML = `<div class="grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2 lg:flex lg:min-h-14 lg:gap-3 lg:px-4 lg:py-0">
      <div class="flex min-w-0 items-center gap-2">
        <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-lg font-black text-black">B</div>
        <div class="min-w-0">
          <div class="truncate text-base font-black leading-none sm:text-lg">Binunce</div>
          <div class="text-[10px] font-black text-brand">FUTURES SIM</div>
        </div>
      </div>
      <div class="hidden min-w-0 text-xs font-bold text-secondary md:block">${state.selectedSymbol} synthetic perpetual</div>
      <div class="min-w-0 text-center lg:ml-auto lg:flex lg:items-center lg:gap-3 lg:text-right">
        <div class="hidden text-right sm:block">
          <div class="text-[10px] font-black uppercase text-secondary">Wallet</div>
          <div class="font-mono text-sm font-black">${formatCurrency(derived.walletBalance)}</div>
        </div>
        <div class="min-w-0">
          <div class="text-[10px] font-black uppercase text-secondary">Equity / Unrealized</div>
          <div class="max-w-[150px] overflow-hidden font-mono text-2xl font-black leading-tight sm:max-w-none sm:text-4xl ${pnlColor}">
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
      .map(
        (tab) =>
          `<button class="min-h-11 rounded-lg px-2 py-2 text-xs font-black ${state.mobileTab === tab ? "bg-brand text-black" : "text-secondary"}" data-mobile-tab="${tab}">${label(tab)}</button>`,
      )
      .join("");
    Object.entries(panes).forEach(([key, pane]) => {
      pane.classList.toggle("hidden", state.mobileTab !== key);
      pane.classList.add("lg:block");
    });
    renderOnboarding(root, ctx, onboardingStep);
  });
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

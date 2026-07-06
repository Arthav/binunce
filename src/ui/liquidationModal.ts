import type { UIContext } from "./context";
import { clearConfetti } from "./confetti";
import { escapeHtml, icon } from "./dom";
import { shareCardMarkup } from "./shareCard";
import {
  formatCurrency,
  formatDuration,
  formatPercent,
  formatPrice,
  formatSignedCurrency,
  formatSignedPercent,
  formatTime,
} from "../util/format";
import type { Trade } from "../types";

export function mountLiquidationModal(root: HTMLElement, ctx: UIContext): void {
  const render = () => {
    const trade = ctx.store.get().liquidationTrade;
    if (!trade) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = `<div class="modal-backdrop">
      <div class="modal-panel flex h-[calc(100dvh-env(safe-area-inset-top))] w-full flex-col border-short/50 md:h-auto md:w-[min(860px,100%)]">
        <div class="grid min-h-0 flex-1 min-w-0 gap-0 md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:gap-5 md:p-5">
          <div class="min-h-0 overflow-auto p-3 pb-0 md:overflow-visible md:p-0">
            <div class="min-w-0 rounded-xl border border-short/40 bg-short/10 p-4 pb-0 sm:p-5 sm:pb-0 md:pb-5">
              <div class="flex min-w-0 items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-black uppercase text-short">Liquidated</div>
                  <div class="mt-2 text-[clamp(3.5rem,18vw,4.5rem)] font-black leading-none text-short sm:text-7xl">REKT</div>
                </div>
                <button class="btn btn-ghost grid !h-9 !w-9 shrink-0 place-items-center !p-0" data-close-liquidation aria-label="Close liquidation modal">${icon("close")}</button>
              </div>
              <div class="mt-7 max-w-full whitespace-nowrap font-mono text-[clamp(2.25rem,11vw,3rem)] font-black leading-tight tracking-normal text-short sm:mt-8 sm:text-5xl">${formatSignedCurrency(trade.pnl)}</div>
              <div class="mt-3 max-w-full whitespace-nowrap font-mono text-[clamp(1.6rem,7vw,1.875rem)] font-black tracking-normal text-short sm:text-3xl">${formatSignedPercent(trade.roiPct)}</div>
              <div class="mt-6 text-lg font-black">${liquidationCopy(trade)}</div>
              <div class="mt-2 text-sm font-semibold text-secondary">Recorded as a simulated forced close. The full margin was consumed and the wallet credit is zero.</div>
              <div class="mt-5 rounded-xl border border-short/35 bg-[#0b0f13]/75 p-3">
                <div class="grid grid-cols-2 gap-2 text-xs">
                  ${liquidationMetric("Entry", formatPrice(trade.entryPrice))}
                  ${liquidationMetric("Exit", formatPrice(trade.exitPrice), "text-short")}
                  ${liquidationMetric("Margin lost", formatCurrency(trade.margin), "text-short")}
                  ${liquidationMetric("Wallet credit", formatCurrency(0), "text-short")}
                  ${liquidationMetric("Notional", formatCurrency(trade.notional))}
                  ${liquidationMetric("Reason", "Liquidation", "text-short")}
                </div>
                <div class="mt-3 hidden grid-cols-2 gap-2 text-xs sm:grid">
                  ${liquidationMetric("Fees", formatCurrency(trade.feeTotal), "text-secondary")}
                  ${liquidationMetric("Opened", formatTime(trade.openedAt))}
                  ${liquidationMetric("Closed", formatTime(trade.closedAt))}
                  ${liquidationMetric("Duration", formatDuration(trade.durationMs))}
                </div>
              </div>
              <div class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-short/35 bg-short/10 p-3 md:hidden">
                <div class="min-w-0">
                  <div class="text-sm font-black text-short">Risk report saved</div>
                  <div class="mt-1 text-xs font-semibold leading-5 text-secondary">Use History to review the fill, or reopen the ticket with the same side selected.</div>
                </div>
                <div class="shrink-0 rounded border border-short/35 bg-[#0b0f13]/80 px-2 py-1 font-mono text-[10px] font-black text-short">LIQ</div>
              </div>
              <div class="sticky bottom-0 z-10 -mx-4 mt-5 grid grid-cols-2 gap-2 rounded-t-xl border-t border-line/80 bg-[#12161b]/96 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-18px_40px_rgba(0,0,0,0.38)] backdrop-blur sm:-mx-5 sm:px-5 md:static md:mx-0 md:mt-8 md:rounded-none md:bg-transparent md:p-0 md:pb-0 md:shadow-none md:backdrop-blur-0">
                <button class="btn btn-short flex min-w-0 items-center justify-center gap-2 whitespace-nowrap" data-liquidation-history>${icon("history")} History</button>
                <button class="btn btn-ghost flex min-w-0 items-center justify-center gap-2 whitespace-nowrap" data-liquidation-trade>${icon("trade")} Trade again</button>
              </div>
            </div>
          </div>
          <div class="fixed left-[-430px] top-3 w-[360px] min-w-0 md:static md:grid md:w-auto md:place-items-center md:overflow-hidden">${shareCardMarkup(trade)}</div>
        </div>
      </div>
    </div>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const trade = ctx.store.get().liquidationTrade;
    const dismissLiquidation = () => {
      clearConfetti();
      ctx.actions.closeLiquidation();
    };
    if (target.closest("[data-liquidation-history]")) {
      dismissLiquidation();
      ctx.actions.setMobileTab("positions");
      ctx.actions.setPositionsPanelTab("history");
      return;
    }
    if (target.closest("[data-liquidation-trade]") && trade) {
      dismissLiquidation();
      ctx.actions.selectSymbol(trade.symbol);
      ctx.actions.setTradeSide(trade.side);
      return;
    }
    if (target.closest("[data-close-liquidation]")) dismissLiquidation();
  });

  ctx.store.subscribe(render);
}

function liquidationCopy(trade: Trade): string {
  return `At ${trade.leverage}x, a ${formatPercent(liquidationMovePct(trade))} move took the full margin.`;
}

function liquidationMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="rounded-lg border border-line/80 bg-[#11161b] p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono text-xs font-black ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

function liquidationMovePct(trade: Trade): number {
  if (!Number.isFinite(trade.entryPrice) || trade.entryPrice <= 0) return 0;
  return Math.abs((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
}

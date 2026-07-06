import type { UIContext } from "./context";
import { clearConfetti } from "./confetti";
import { escapeHtml, icon } from "./dom";
import { shareCardMarkup, shareFileName, shareText } from "./shareCard";
import { copyElementPng, downloadElementPng, openXIntent, shareElementPng } from "../util/share";
import {
  formatCurrency,
  formatDuration,
  formatPrice,
  formatSignedCurrency,
  formatSignedPercent,
  formatTime,
} from "../util/format";
import { playSfx } from "../audio/sfx";
import type { Trade } from "../types";

export function mountResultModal(root: HTMLElement, ctx: UIContext): void {
  const render = () => {
    const { resultOpen, lastClosedTrade } = ctx.store.get();
    if (!resultOpen || !lastClosedTrade) {
      root.innerHTML = "";
      return;
    }
    const trade = lastClosedTrade;
    const positive = trade.pnl >= 0;
    const reason = closeReasonLabel(trade.closeReason);
    const walletCredit = settlementCredit(trade);
    const tradeSideLabel = trade.side.toUpperCase();
    root.innerHTML = `<div class="modal-backdrop">
      <div class="modal-panel flex h-[calc(100dvh-env(safe-area-inset-top))] w-full flex-col md:h-auto md:w-[min(920px,100%)]">
        <div class="grid min-h-0 flex-1 min-w-0 gap-0 md:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] md:gap-5 md:p-5">
          <div class="min-h-0 overflow-auto p-3 pb-0 md:overflow-visible md:p-0">
            <div class="min-w-0 rounded-xl border ${positive ? "border-long/35 bg-long/10" : "border-short/35 bg-short/10"} p-4 pb-0 sm:p-5 sm:pb-0 md:pb-5">
              <div class="flex min-w-0 items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-xs font-black uppercase sm:text-sm ${positive ? "text-long" : "text-short"}">${positive ? "Trade closed in profit" : "Trade closed in loss"}</div>
                  <div class="mt-3 max-w-full whitespace-nowrap font-mono text-[clamp(2rem,10vw,3.75rem)] font-black leading-none tracking-normal sm:text-6xl ${positive ? "text-long" : "text-short"}">${formatSignedCurrency(trade.pnl)}</div>
                  <div class="mt-3 max-w-full whitespace-nowrap font-mono text-[clamp(1.75rem,8vw,2.25rem)] font-black leading-tight tracking-normal sm:text-4xl ${positive ? "text-long" : "text-short"}">${formatSignedPercent(trade.roiPct)}</div>
                </div>
                <button class="btn btn-ghost grid !h-9 !w-9 shrink-0 place-items-center !p-0" data-close-result aria-label="Close result modal">${icon("close")}</button>
              </div>
              <div class="mt-7 text-xl font-black leading-tight sm:mt-8 sm:text-2xl">${escapeHtml(trade.symbol)} ${trade.side.toUpperCase()} ${trade.leverage}x closed</div>
              <div class="mt-2 text-sm font-semibold leading-6 text-secondary">Execution receipt for a ${escapeHtml(reason.toLowerCase())}. Review fill prices, fees, and wallet credit before the next trade.</div>
              <div class="mt-5 rounded-xl border border-line/80 bg-[#0b0f13]/75 p-3">
                <div class="grid grid-cols-2 gap-2 text-xs">
                  ${receiptMetric("Entry", formatPrice(trade.entryPrice))}
                  ${receiptMetric("Exit", formatPrice(trade.exitPrice))}
                  ${receiptMetric("Margin", formatCurrency(trade.margin))}
                  ${receiptMetric("Notional", formatCurrency(trade.notional))}
                  ${receiptMetric("Fees", formatCurrency(trade.feeTotal), "text-secondary")}
                  ${receiptMetric("Wallet credit", formatCurrency(walletCredit), walletCredit >= 0 ? "text-long" : "text-short")}
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                  ${receiptMetric("Opened", formatTime(trade.openedAt))}
                  ${receiptMetric("Closed", formatTime(trade.closedAt))}
                  ${receiptMetric("Duration", formatDuration(trade.durationMs))}
                  ${receiptMetric("Reason", reason, positive ? "text-long" : "text-brand")}
                </div>
              </div>
              <div class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand/10 p-3 md:hidden">
                <div class="min-w-0">
                  <div class="text-sm font-black text-brand">Receipt PNG ready</div>
                  <div class="mt-1 text-xs font-semibold leading-5 text-secondary">Full share card is prepared for download, copy, or mobile share.</div>
                </div>
                <div class="shrink-0 rounded border border-brand/30 bg-[#0b0f13]/80 px-2 py-1 font-mono text-[10px] font-black text-brand">SIM</div>
              </div>
              <div class="sticky bottom-0 z-10 -mx-4 mt-5 rounded-t-xl border-t border-line/80 bg-[#12161b]/96 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-18px_40px_rgba(0,0,0,0.38)] backdrop-blur sm:-mx-5 sm:px-5 md:static md:mx-0 md:mt-6 md:rounded-none md:bg-transparent md:p-0 md:pb-0 md:shadow-none md:backdrop-blur-0">
                <div class="grid grid-cols-2 gap-2" data-result-next-actions>
                  <button class="btn btn-primary flex min-w-0 items-center justify-center gap-2 whitespace-nowrap" data-result-history>${icon("history")} View history</button>
                  <button class="btn btn-ghost flex min-w-0 items-center justify-center gap-2 whitespace-nowrap" data-result-trade>${icon("trade")} Again ${tradeSideLabel}</button>
                </div>
                <div class="mt-3 border-t border-line/80 pt-3 md:mt-5 md:pt-4">
                  <div class="text-[11px] font-black uppercase text-secondary">Receipt tools</div>
                  <div class="mt-2 grid grid-cols-4 gap-1.5 md:mt-3 md:grid-cols-2 md:gap-3">
                    <button class="btn btn-primary flex !min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none md:!min-h-11 md:flex-row md:gap-2 md:px-3 md:text-sm" data-download-card>${icon("download")} <span class="md:hidden">PNG</span><span class="hidden md:inline">Download PNG</span></button>
                    <button class="btn btn-ghost flex !min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none md:!min-h-11 md:flex-row md:gap-2 md:px-3 md:text-sm" data-copy-card>${icon("copy")} <span class="md:hidden">Copy</span><span class="hidden md:inline">Copy image</span></button>
                    <button class="btn btn-ghost flex !min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none md:!min-h-11 md:flex-row md:gap-2 md:px-3 md:text-sm" data-native-share>${icon("share")} <span class="md:hidden">Share</span><span class="hidden md:inline">Share</span></button>
                    <button class="btn btn-ghost flex !min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none md:!min-h-11 md:flex-row md:gap-2 md:px-3 md:text-sm" data-x-share>${icon("x")} <span class="md:hidden">X</span><span class="hidden md:inline">Share to X</span></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="fixed left-[-430px] top-3 w-[360px] min-w-0 md:static md:grid md:w-auto md:place-items-center md:overflow-hidden">${shareCardMarkup(trade)}</div>
        </div>
      </div>
    </div>`;
  };

  root.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const trade = ctx.store.get().lastClosedTrade;
    if (!trade) return;
    const card = root.querySelector<HTMLElement>("[data-share-card]");
    const dismissResult = () => {
      clearConfetti();
      ctx.actions.closeResult();
    };
    if (target.closest("[data-close-result]")) {
      dismissResult();
      return;
    }
    if (target.closest("[data-result-history]")) {
      dismissResult();
      ctx.actions.setMobileTab("positions");
      ctx.actions.setPositionsPanelTab("history");
      return;
    }
    if (target.closest("[data-result-trade]")) {
      dismissResult();
      ctx.actions.selectSymbol(trade.symbol);
      ctx.actions.setTradeSide(trade.side);
      ctx.actions.setMobileTab("trade");
      ctx.actions.toast(`${trade.symbol} ${trade.side.toUpperCase()} ticket loaded from receipt.`, "info");
      return;
    }
    if (target.closest("[data-download-card]") && card) {
      playSfx("shutter");
      await downloadElementPng(card, shareFileName(trade));
      ctx.actions.toast("Trade card downloaded.", "success");
    }
    if (target.closest("[data-copy-card]") && card) {
      playSfx("shutter");
      const outcome = await copyElementPng(card);
      ctx.actions.toast(outcome === "copied" ? "Trade card copied." : "Copy unsupported - downloaded instead.", "success");
    }
    if (target.closest("[data-native-share]") && card) {
      playSfx("shutter");
      const outcome = await shareElementPng(card, shareText(trade));
      ctx.actions.toast(outcome === "shared" ? "Share sheet opened." : "Share unavailable - downloaded PNG.", "info");
    }
    if (target.closest("[data-x-share]")) {
      openXIntent(shareText(trade));
    }
  });

  ctx.store.subscribe(render);
}

function receiptMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="rounded-lg border border-line/80 bg-[#11161b] p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono text-xs font-black ${color}">${escapeHtml(value)}</div>
  </div>`;
}

function closeReasonLabel(reason: Trade["closeReason"]): string {
  if (reason === "tp") return "Take profit";
  if (reason === "sl") return "Stop loss";
  if (reason === "liquidation") return "Liquidation";
  return "Manual close";
}

function settlementCredit(trade: Trade): number {
  if (trade.closeReason === "liquidation") return 0;
  return trade.margin + trade.pnl;
}

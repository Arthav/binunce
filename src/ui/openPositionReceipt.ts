import { derivePositions } from "../store/selectors";
import { formatCurrency, formatPrice, formatSignedCurrency, formatSignedPercent, formatTime } from "../util/format";
import type { UIContext } from "./context";
import { escapeHtml, icon } from "./dom";

export function mountOpenPositionReceipt(root: HTMLElement, ctx: UIContext): void {
  const render = () => {
    const state = ctx.store.get();
    const receiptPosition = state.lastOpenedPosition;
    if (!receiptPosition) {
      root.innerHTML = "";
      return;
    }
    const position = state.positions.find((item) => item.id === receiptPosition.id) ?? receiptPosition;
    const derivedPosition = derivePositions(state).find((item) => item.id === position.id);
    const sideColor = position.side === "long" ? "text-long" : "text-short";
    const sideButton = position.side === "long" ? "btn-long" : "btn-short";
    const unrealized = derivedPosition?.unrealizedPnl ?? 0;
    const roi = derivedPosition?.roiPct ?? 0;
    root.innerHTML = `<div class="modal-backdrop">
      <div class="modal-panel flex h-[calc(100dvh-env(safe-area-inset-top))] w-full flex-col md:h-auto md:w-[min(760px,100%)]">
        <div class="min-h-0 flex-1 overflow-auto p-4 pb-0 md:p-5 md:pb-0">
          <div class="rounded-xl border ${position.side === "long" ? "border-long/35 bg-long/10" : "border-short/35 bg-short/10"} p-4 pb-0 md:pb-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs font-black uppercase ${sideColor}">Order filled</div>
                <div class="mt-2 flex min-w-0 items-center gap-2">
                  <div class="truncate text-2xl font-black">${escapeHtml(position.symbol)}</div>
                  <div class="rounded border ${position.side === "long" ? "border-long/35 bg-long/10 text-long" : "border-short/35 bg-short/10 text-short"} px-2 py-1 text-xs font-black">${position.side.toUpperCase()} ${position.leverage}x</div>
                </div>
                <div class="mt-2 text-sm font-semibold leading-6 text-secondary">Synthetic fill confirmed. The position is live and marked against the simulated book.</div>
              </div>
              <button class="btn btn-ghost grid !h-9 !w-9 shrink-0 place-items-center !p-0" data-close-open-receipt aria-label="Close fill receipt">${icon("close")}</button>
            </div>
            <div class="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-xl border border-line/80 bg-[#0b0f13]/75 p-3">
              <div class="min-w-0">
                <div class="text-[10px] font-black uppercase text-secondary">Live PnL</div>
                <div class="mt-1 truncate font-mono text-3xl font-black ${unrealized >= 0 ? "text-long" : "text-short"}">${formatSignedCurrency(unrealized)}</div>
                <div class="mt-1 font-mono text-sm font-black ${roi >= 0 ? "text-long" : "text-short"}">${formatSignedPercent(roi)}</div>
              </div>
              <div class="rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-right">
                <div class="text-[9px] font-black uppercase text-secondary">Margin</div>
                <div class="font-mono text-lg font-black text-brand">${formatCurrency(position.margin)}</div>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
              ${receiptMetric("Entry", formatPrice(position.entryPrice))}
              ${receiptMetric("Liq price", formatPrice(position.liqPrice), "text-short")}
              ${receiptMetric("Notional", formatCurrency(position.notional))}
              ${receiptMetric("Open fee", formatCurrency(position.feeOpen), "text-secondary")}
              ${receiptMetric("Size", `${formatSize(position.size)} units`)}
              ${receiptMetric("Opened", formatTime(position.openedAt))}
              ${receiptMetric("Take profit", position.tpPrice ? formatPrice(position.tpPrice) : "Off", position.tpPrice ? "text-long" : "text-secondary")}
              ${receiptMetric("Stop loss", position.slPrice ? formatPrice(position.slPrice) : "Off", position.slPrice ? "text-short" : "text-secondary")}
            </div>
            <div class="mt-4 rounded-xl border border-brand/25 bg-brand/10 p-3">
              <div class="text-sm font-black text-brand">Position is now live</div>
              <div class="mt-1 text-xs font-semibold leading-5 text-secondary">Use Positions to reduce, close, or edit TP / SL. Chart keeps the market context if you want to watch the fill breathe.</div>
            </div>
            <div class="sticky bottom-0 z-10 -mx-4 mt-5 grid grid-cols-3 gap-2 rounded-t-xl border-t border-line/80 bg-[#12161b]/96 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-18px_40px_rgba(0,0,0,0.38)] backdrop-blur md:static md:mx-0 md:mt-6 md:rounded-none md:bg-transparent md:p-0 md:pb-0 md:shadow-none md:backdrop-blur-0">
              <button class="btn btn-primary !min-h-11 px-2" data-open-receipt-manage>Manage</button>
              <button class="btn btn-ghost !min-h-11 px-2" data-open-receipt-chart>${icon("chart")} Chart</button>
              <button class="btn ${sideButton} !min-h-11 px-2" data-open-receipt-add>${icon("trade")} Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const position = ctx.store.get().lastOpenedPosition;
    if (!position) return;
    const closeReceipt = () => ctx.actions.closeOpenReceipt();
    if (target.closest("[data-close-open-receipt]")) {
      closeReceipt();
      return;
    }
    if (target.closest("[data-open-receipt-manage]")) {
      closeReceipt();
      ctx.actions.setMobileTab("positions");
      ctx.actions.setPositionsPanelTab("positions");
      return;
    }
    if (target.closest("[data-open-receipt-chart]")) {
      closeReceipt();
      ctx.actions.selectSymbol(position.symbol);
      ctx.actions.setMobileTab("chart");
      return;
    }
    if (target.closest("[data-open-receipt-add]")) {
      closeReceipt();
      ctx.actions.selectSymbol(position.symbol);
      ctx.actions.setTradeSide(position.side);
      ctx.actions.setMobileTab("trade");
      ctx.actions.toast(`${position.symbol} ${position.side.toUpperCase()} ticket loaded.`, "info");
    }
  });

  ctx.store.subscribe(render);
}

function receiptMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="rounded-lg border border-line/80 bg-[#11161b] p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono text-xs font-black ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

function formatSize(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(value < 1 ? 6 : 3);
}

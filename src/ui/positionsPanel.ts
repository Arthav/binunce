import { derivePositions } from "../store/selectors";
import type { AppState } from "../types";
import {
  formatCurrency,
  formatPrice,
  formatSignedCurrency,
  formatSignedPercent,
} from "../util/format";
import type { UIContext } from "./context";
import { escapeHtml } from "./dom";
import { historyMarkup } from "./historyPanel";
import { tickerMarkup } from "./ticker";

export function mountPositionsPanel(root: HTMLElement, ctx: UIContext): void {
  let tab: "positions" | "history" = "positions";

  const render = () => {
    const state = ctx.store.get();
    root.innerHTML = `<section class="panel flex min-h-[calc(100dvh-164px)] flex-col overflow-hidden lg:h-full lg:min-h-[260px]">
      <div class="flex items-center justify-between border-b border-line p-3">
        <div class="flex gap-2">
          <button class="chip ${tab === "positions" ? "active" : ""}" data-panel-tab="positions">Positions (${state.positions.length})</button>
          <button class="chip ${tab === "history" ? "active" : ""}" data-panel-tab="history">History (${state.trades.length})</button>
        </div>
        <div class="text-[11px] font-black text-brand">LIVE PNL UPDATES</div>
      </div>
      <div class="min-h-0 flex-1 overflow-hidden">${tab === "positions" ? positionsMarkup(state) : historyMarkup(state)}</div>
    </section>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const tabButton = target.closest<HTMLElement>("[data-panel-tab]");
    const closeButton = target.closest<HTMLElement>("[data-close-position]");
    const halfButton = target.closest<HTMLElement>("[data-half-position]");
    const shareButton = target.closest<HTMLElement>("[data-share-trade]");
    if (tabButton) {
      tab = tabButton.dataset.panelTab as "positions" | "history";
      render();
    }
    if (closeButton) {
      const position = ctx.store.get().positions.find((item) => item.id === closeButton.dataset.closePosition);
      if (position) ctx.actions.closePosition(position, "manual", 1);
    }
    if (halfButton) {
      const position = ctx.store.get().positions.find((item) => item.id === halfButton.dataset.halfPosition);
      if (position) ctx.actions.closePosition(position, "manual", 0.5);
    }
    if (shareButton) {
      const trade = ctx.store.get().trades.find((item) => item.id === shareButton.dataset.shareTrade);
      if (trade) ctx.actions.openResult(trade);
    }
  });

  ctx.store.subscribe(render);
}

function positionsMarkup(state: AppState): string {
  const positions = derivePositions(state);
  if (positions.length === 0) {
    return `<div class="grid h-full min-h-[210px] place-items-center text-center">
      <div>
        <div class="text-lg font-black">No open positions.</div>
        <div class="mt-1 text-sm font-semibold text-secondary">Pick your poison.</div>
      </div>
    </div>`;
  }
  return `<div class="h-full overflow-auto">
    <div class="grid gap-3 p-3 lg:hidden">
      ${positions
        .map((position) => {
          const positive = position.unrealizedPnl >= 0;
          const background = positive
            ? `rgba(14,203,129,${0.06 + position.heat * 0.16})`
            : `rgba(246,70,93,${0.06 + position.heat * 0.16})`;
          return `<article class="rounded-xl border border-line bg-[#10151a] p-3" style="background:${background}">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-base font-black">${escapeHtml(position.symbol)}</div>
                <div class="mt-1 inline-flex rounded px-2 py-1 text-xs font-black ${position.side === "long" ? "bg-long/10 text-long" : "bg-short/10 text-short"}">${position.side.toUpperCase()} ${position.leverage}x</div>
              </div>
              <div class="text-right font-mono font-black ${positive ? "text-long" : "text-short"}">
                <div class="text-3xl leading-none">${tickerMarkup(formatSignedCurrency(position.unrealizedPnl))}</div>
                <div class="mt-1 text-sm">${escapeHtml(formatSignedPercent(position.roiPct))}</div>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
              ${cardMetric("Entry", formatPrice(position.entryPrice))}
              ${cardMetric("Mark", formatPrice(position.markPrice))}
              ${cardMetric("Liq", formatPrice(position.liqPrice), "text-short")}
              ${cardMetric("Margin", formatCurrency(position.margin))}
              ${cardMetric("Size", formatSize(position.size))}
              ${cardMetric("TP / SL", `${position.tpPrice ? formatPrice(position.tpPrice) : "--"} / ${position.slPrice ? formatPrice(position.slPrice) : "--"}`)}
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button class="btn btn-ghost !min-h-11" data-half-position="${position.id}">Close 50%</button>
              <button class="btn btn-ghost !min-h-11" data-close-position="${position.id}">Close</button>
            </div>
          </article>`;
        })
        .join("")}
    </div>
    <table class="hidden w-full min-w-[980px] text-left text-sm lg:table">
      <thead class="sticky top-0 bg-[#11161b] text-[11px] uppercase text-secondary">
        <tr>
          <th class="px-3 py-2">Symbol</th>
          <th class="px-3 py-2">Side</th>
          <th class="px-3 py-2">Size</th>
          <th class="px-3 py-2">Entry</th>
          <th class="px-3 py-2">Mark</th>
          <th class="px-3 py-2">Liq</th>
          <th class="px-3 py-2">Margin</th>
          <th class="px-3 py-2">Unrealized PnL</th>
          <th class="px-3 py-2">TP / SL</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        ${positions
          .map((position) => {
            const positive = position.unrealizedPnl >= 0;
            const background = positive
              ? `rgba(14,203,129,${0.04 + position.heat * 0.16})`
              : `rgba(246,70,93,${0.04 + position.heat * 0.16})`;
            return `<tr class="border-b border-line/70" style="background:${background}">
              <td class="px-3 py-2 font-black">${escapeHtml(position.symbol)}</td>
              <td class="px-3 py-2"><span class="rounded px-2 py-1 text-xs font-black ${position.side === "long" ? "bg-long/10 text-long" : "bg-short/10 text-short"}">${position.side.toUpperCase()} ${position.leverage}x</span></td>
              <td class="px-3 py-2 font-mono">${escapeHtml(formatSize(position.size))}</td>
              <td class="px-3 py-2 font-mono">${escapeHtml(formatPrice(position.entryPrice))}</td>
              <td class="px-3 py-2 font-mono">${escapeHtml(formatPrice(position.markPrice))}</td>
              <td class="px-3 py-2 font-mono text-short">${escapeHtml(formatPrice(position.liqPrice))}</td>
              <td class="px-3 py-2 font-mono">${escapeHtml(formatCurrency(position.margin))}</td>
              <td class="px-3 py-2 font-mono font-black ${positive ? "text-long" : "text-short"}">
                ${tickerMarkup(formatSignedCurrency(position.unrealizedPnl))}
                <span class="ml-2">${escapeHtml(formatSignedPercent(position.roiPct))}</span>
              </td>
              <td class="px-3 py-2 font-mono text-xs text-secondary">${position.tpPrice ? escapeHtml(formatPrice(position.tpPrice)) : "--"} / ${position.slPrice ? escapeHtml(formatPrice(position.slPrice)) : "--"}</td>
              <td class="px-3 py-2 text-right">
                <button class="chip" data-half-position="${position.id}">Close 50%</button>
                <button class="chip ml-1" data-close-position="${position.id}">Close</button>
              </td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function cardMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono font-black ${color}">${escapeHtml(value)}</div>
  </div>`;
}

function formatSize(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(value < 1 ? 6 : 3);
}

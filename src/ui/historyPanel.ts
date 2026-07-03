import type { AppState, Trade } from "../types";
import {
  formatCurrency,
  formatDuration,
  formatPrice,
  formatSignedCurrency,
  formatSignedPercent,
} from "../util/format";
import { escapeHtml } from "./dom";

export function historyMarkup(state: AppState): string {
  const totalPnl = state.trades.reduce((sum, trade) => sum + trade.pnl, 0);
  return `<div class="flex h-full flex-col">
    <div class="grid gap-2 border-b border-line p-3 grid-cols-2 sm:grid-cols-4">
      ${stat("Win rate", `${state.account.totalTrades > 0 ? ((state.account.totalWins / state.account.totalTrades) * 100).toFixed(1) : "0.0"}%`)}
      ${stat("Realized PnL", formatSignedCurrency(totalPnl), totalPnl >= 0 ? "text-long" : "text-short")}
      ${stat("Biggest win", formatCurrency(state.account.biggestWin), "text-long")}
      ${stat("Liquidations", String(state.account.totalLiquidations), "text-short")}
    </div>
    <div class="min-h-0 flex-1 overflow-auto">
      ${
        state.trades.length === 0
          ? `<div class="grid h-44 place-items-center text-center text-sm font-bold text-secondary">Your legend hasn't started yet.</div>`
          : `<div class="grid gap-3 p-3 lg:hidden">
              ${state.trades.map(card).join("")}
            </div>
            <table class="hidden w-full min-w-[840px] text-left text-sm lg:table">
              <thead class="sticky top-0 bg-[#11161b] text-[11px] uppercase text-secondary">
                <tr>
                  <th class="px-3 py-2">Symbol</th>
                  <th class="px-3 py-2">Side</th>
                  <th class="px-3 py-2">Entry</th>
                  <th class="px-3 py-2">Exit</th>
                  <th class="px-3 py-2">PnL</th>
                  <th class="px-3 py-2">ROI</th>
                  <th class="px-3 py-2">Reason</th>
                  <th class="px-3 py-2">Duration</th>
                  <th class="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                ${state.trades.map(row).join("")}
              </tbody>
            </table>`
      }
    </div>
  </div>`;
}

function card(trade: Trade): string {
  const positive = trade.pnl >= 0;
  return `<article class="rounded-xl border border-line bg-[#10151a] p-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-base font-black">${escapeHtml(trade.symbol)}</div>
        <div class="mt-1 inline-flex rounded px-2 py-1 text-xs font-black ${trade.side === "long" ? "bg-long/10 text-long" : "bg-short/10 text-short"}">${trade.side.toUpperCase()} ${trade.leverage}x</div>
      </div>
      <div class="text-right">
        <div class="font-mono text-2xl font-black ${positive ? "text-long" : "text-short"}">${escapeHtml(formatSignedCurrency(trade.pnl))}</div>
        <div class="font-mono text-xs font-black ${positive ? "text-long" : "text-short"}">${escapeHtml(formatSignedPercent(trade.roiPct))}</div>
      </div>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
      ${smallMetric("Entry", formatPrice(trade.entryPrice))}
      ${smallMetric("Exit", formatPrice(trade.exitPrice))}
      ${smallMetric("Reason", reasonLabel(trade.closeReason))}
      ${smallMetric("Duration", formatDuration(trade.durationMs))}
    </div>
    <button class="btn btn-ghost mt-3 w-full !min-h-11" data-share-trade="${trade.id}">Share receipt</button>
  </article>`;
}

function row(trade: Trade): string {
  const positive = trade.pnl >= 0;
  return `<tr class="border-b border-line/70">
    <td class="px-3 py-2 font-black">${escapeHtml(trade.symbol)}</td>
    <td class="px-3 py-2"><span class="rounded px-2 py-1 text-xs font-black ${trade.side === "long" ? "bg-long/10 text-long" : "bg-short/10 text-short"}">${trade.side.toUpperCase()} ${trade.leverage}x</span></td>
    <td class="px-3 py-2 font-mono">${escapeHtml(formatPrice(trade.entryPrice))}</td>
    <td class="px-3 py-2 font-mono">${escapeHtml(formatPrice(trade.exitPrice))}</td>
    <td class="px-3 py-2 font-mono font-black ${positive ? "text-long" : "text-short"}">${escapeHtml(formatSignedCurrency(trade.pnl))}</td>
    <td class="px-3 py-2 font-mono font-black ${positive ? "text-long" : "text-short"}">${escapeHtml(formatSignedPercent(trade.roiPct))}</td>
    <td class="px-3 py-2 font-bold text-secondary">${escapeHtml(reasonLabel(trade.closeReason))}</td>
    <td class="px-3 py-2 font-mono text-secondary">${escapeHtml(formatDuration(trade.durationMs))}</td>
    <td class="px-3 py-2 text-right"><button class="chip" data-share-trade="${trade.id}">Share</button></td>
  </tr>`;
}

function stat(label: string, value: string, color = "text-primary"): string {
  return `<div class="rounded-lg border border-line bg-[#0f1318] p-3">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono text-base font-black sm:text-lg ${color}">${escapeHtml(value)}</div>
  </div>`;
}

function smallMetric(label: string, value: string): string {
  return `<div class="rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono font-black text-primary">${escapeHtml(value)}</div>
  </div>`;
}

function reasonLabel(reason: Trade["closeReason"]): string {
  if (reason === "tp") return "TP";
  if (reason === "sl") return "SL";
  if (reason === "liquidation") return "LIQ";
  return "Manual";
}

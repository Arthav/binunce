import type { AppState, Trade } from "../types";
import {
  formatCompact,
  formatCurrency,
  formatDuration,
  formatPercent,
  formatPrice,
  formatSignedCurrency,
  formatSignedPercent,
  formatTime,
} from "../util/format";
import { escapeHtml, icon } from "./dom";

export type HistoryFilter = "all" | "wins" | "losses" | "liquidations";

export function historyMarkup(state: AppState, activeFilter: HistoryFilter = "all"): string {
  const sortedTrades = [...state.trades].sort((a, b) => b.closedAt - a.closedAt);
  const trades = sortedTrades.filter((trade) => matchesFilter(trade, activeFilter));
  const totalPnl = state.trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const winRate = state.account.totalTrades > 0 ? (state.account.totalWins / state.account.totalTrades) * 100 : 0;
  const totalFees = state.trades.reduce((sum, trade) => sum + trade.feeTotal, 0);
  return `<div class="flex h-full flex-col">
    <div class="sticky top-0 z-10 border-b border-line bg-[#161a1e]/95 p-3 backdrop-blur lg:static">
      <div class="rounded-xl border border-line bg-[#0f1318] p-2.5 lg:hidden" data-history-summary>
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div class="min-w-0">
            <div class="text-[10px] font-black uppercase text-secondary">Closed ledger</div>
            <div class="mt-0.5 truncate font-mono text-xl font-black ${totalPnl >= 0 ? "text-long" : "text-short"}">${escapeHtml(formatSignedCurrency(totalPnl))}</div>
          </div>
          <div class="shrink-0 rounded border border-brand/30 bg-brand/10 px-2 py-1 text-right font-mono text-[10px] font-black text-brand">${sortedTrades.length} fills</div>
        </div>
        <div class="mt-2 grid grid-cols-3 gap-1.5 text-[10px] font-black uppercase">
          <div class="truncate text-secondary">WR <span class="${winRate >= 50 ? "text-long" : "text-primary"}">${escapeHtml(formatPercent(winRate))}</span></div>
          <div class="truncate text-secondary">LIQ <span class="${state.account.totalLiquidations > 0 ? "text-short" : "text-primary"}">${state.account.totalLiquidations}</span></div>
          <div class="truncate text-secondary">Fees <span class="text-primary" title="${escapeHtml(formatCurrency(totalFees))}">${escapeHtml(formatCompactCurrency(totalFees))}</span></div>
        </div>
      </div>
      <div class="hidden grid-cols-6 gap-2 lg:grid">
        ${stat("Trades", String(state.account.totalTrades))}
        ${stat("Win rate", formatPercent(winRate))}
        ${stat("Realized PnL", formatCompactSignedCurrency(totalPnl), totalPnl >= 0 ? "text-long" : "text-short", formatSignedCurrency(totalPnl))}
        ${stat("Biggest win", formatCompactCurrency(state.account.biggestWin), "text-long", formatCurrency(state.account.biggestWin))}
        ${stat("Biggest loss", formatCompactSignedCurrency(state.account.biggestLoss), "text-short", formatSignedCurrency(state.account.biggestLoss))}
        ${stat("Liquidations", String(state.account.totalLiquidations), "text-short")}
      </div>
      <div class="mt-3 grid grid-cols-4 gap-2">
        ${filterButton("all", "All", sortedTrades.length, activeFilter)}
        ${filterButton("wins", "Wins", sortedTrades.filter((trade) => trade.pnl > 0).length, activeFilter)}
        ${filterButton("losses", "Losses", sortedTrades.filter((trade) => trade.pnl < 0 && trade.closeReason !== "liquidation").length, activeFilter)}
        ${filterButton("liquidations", "Liq", sortedTrades.filter((trade) => trade.closeReason === "liquidation").length, activeFilter)}
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto">
      ${
        sortedTrades.length === 0
          ? `<div class="grid h-full min-h-[360px] place-items-center p-6 text-center">
              <div>
                <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-[#0f1318] font-mono text-xl font-black text-secondary">--</div>
                <div class="mt-4 text-xl font-black">Your legend hasn't started yet</div>
                <div class="mx-auto mt-2 max-w-[28ch] text-sm font-semibold leading-6 text-secondary">Closed trades, liquidations, and share receipts will land here.</div>
              </div>
            </div>`
          : trades.length === 0
            ? `<div class="grid h-full min-h-[300px] place-items-center p-6 text-center">
                <div>
                  <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-[#0f1318] font-mono text-xl font-black text-secondary">0</div>
                  <div class="mt-4 text-xl font-black">No ${filterLabel(activeFilter).toLowerCase()} yet</div>
                  <div class="mx-auto mt-2 max-w-[28ch] text-sm font-semibold leading-6 text-secondary">Switch filters or make another trade to fill this lane.</div>
                </div>
              </div>`
          : `<div class="grid gap-3 p-3 lg:hidden">
              ${trades.map(card).join("")}
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
                ${trades.map(row).join("")}
              </tbody>
            </table>`
      }
    </div>
  </div>`;
}

function card(trade: Trade): string {
  const positive = trade.pnl >= 0;
  const reason = reasonMeta(trade.closeReason);
  const walletCredit = settlementCredit(trade);
  return `<article class="rounded-xl border border-line bg-[#10151a] p-3" style="background:${positive ? "rgba(14,203,129,0.06)" : "rgba(246,70,93,0.08)"}">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-base font-black">${escapeHtml(trade.symbol)}</div>
        <div class="mt-1 inline-flex rounded px-2 py-1 text-xs font-black ${trade.side === "long" ? "bg-long/10 text-long" : "bg-short/10 text-short"}">${trade.side.toUpperCase()} ${trade.leverage}x</div>
        <div class="mt-2 text-[11px] font-semibold text-secondary">${escapeHtml(formatTime(trade.closedAt))}</div>
      </div>
      <div class="text-right">
        <div class="font-mono text-2xl font-black ${positive ? "text-long" : "text-short"}">${escapeHtml(formatSignedCurrency(trade.pnl))}</div>
        <div class="font-mono text-xs font-black ${positive ? "text-long" : "text-short"}">${escapeHtml(formatSignedPercent(trade.roiPct))}</div>
      </div>
    </div>
    <div class="mt-3 rounded-lg border border-line/80 bg-[#0b0f13]/75 p-2">
      <div class="flex min-w-0 items-center justify-between gap-2 px-1 py-1">
        <span class="rounded px-2 py-1 text-xs font-black ${reason.tone}">${reason.label}</span>
        <span class="font-mono text-xs font-black text-secondary">${escapeHtml(formatDuration(trade.durationMs))}</span>
      </div>
      <div class="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-line/70 bg-[#11161b] px-2 py-2">
        <div class="min-w-0">
          <div class="text-[10px] font-black uppercase text-secondary">Settlement</div>
          <div class="mt-1 truncate font-mono text-xs font-black text-primary">${escapeHtml(formatPrice(trade.entryPrice))} -> ${escapeHtml(formatPrice(trade.exitPrice))}</div>
        </div>
        <div class="text-right">
          <div class="text-[10px] font-black uppercase text-secondary">Wallet</div>
          <div class="mt-1 font-mono text-xs font-black ${walletCredit >= 0 ? "text-long" : "text-short"}">${escapeHtml(formatCurrency(walletCredit))}</div>
        </div>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button class="btn btn-ghost flex !min-h-11 items-center justify-center gap-2 whitespace-nowrap px-2 text-sm" data-replay-trade="${trade.id}">${icon("trade")} Again</button>
        <button class="btn btn-primary flex !min-h-11 items-center justify-center gap-2 whitespace-nowrap px-2 text-sm" data-share-trade="${trade.id}">${icon("history")} Receipt</button>
      </div>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
      ${smallMetric("Margin", formatCurrency(trade.margin))}
      ${smallMetric("Fees", formatCurrency(trade.feeTotal), "text-secondary")}
      ${smallMetric("Notional", formatCurrency(trade.notional), "text-primary", "hidden sm:block")}
      ${smallMetric("Wallet credit", formatCurrency(walletCredit), walletCredit >= 0 ? "text-long" : "text-short", "hidden sm:block")}
    </div>
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

function stat(label: string, value: string, color = "text-primary", title = value): string {
  return `<div class="min-w-0 rounded-lg border border-line bg-[#0f1318] p-2 sm:p-3">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono text-sm font-black sm:text-base lg:text-lg ${color}" title="${escapeHtml(title)}">${escapeHtml(value)}</div>
  </div>`;
}

function filterButton(filter: HistoryFilter, label: string, count: number, activeFilter: HistoryFilter): string {
  const active = filter === activeFilter;
  return `<button class="chip ${active ? "active" : ""} grid !min-h-10 place-items-center !px-1 text-center" data-history-filter="${filter}">
    <span class="leading-none">${escapeHtml(label)}</span>
    <span class="font-mono text-[10px] leading-none ${active ? "text-brand" : "text-muted"}">${count}</span>
  </button>`;
}

function smallMetric(label: string, value: string, color = "text-primary", className = ""): string {
  return `<div class="${className} rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono font-black ${color}">${escapeHtml(value)}</div>
  </div>`;
}

function reasonLabel(reason: Trade["closeReason"]): string {
  if (reason === "tp") return "TP";
  if (reason === "sl") return "SL";
  if (reason === "liquidation") return "LIQ";
  return "Manual";
}

function reasonMeta(reason: Trade["closeReason"]): { label: string; tone: string } {
  if (reason === "tp") return { label: "TP close", tone: "bg-long/10 text-long" };
  if (reason === "sl") return { label: "SL close", tone: "bg-short/10 text-short" };
  if (reason === "liquidation") return { label: "LIQUIDATED", tone: "bg-short/10 text-short" };
  return { label: "Manual close", tone: "bg-brand/10 text-brand" };
}

function matchesFilter(trade: Trade, filter: HistoryFilter): boolean {
  if (filter === "wins") return trade.pnl > 0;
  if (filter === "losses") return trade.pnl < 0 && trade.closeReason !== "liquidation";
  if (filter === "liquidations") return trade.closeReason === "liquidation";
  return true;
}

function filterLabel(filter: HistoryFilter): string {
  if (filter === "wins") return "Wins";
  if (filter === "losses") return "Losses";
  if (filter === "liquidations") return "Liquidations";
  return "Trades";
}

function settlementCredit(trade: Trade): number {
  if (trade.closeReason === "liquidation") return 0;
  return trade.margin + trade.pnl;
}

function formatCompactCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `$${formatCompact(Math.abs(safe))}`;
}

function formatCompactSignedCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : safe < 0 ? "-" : "";
  return `${sign}$${formatCompact(Math.abs(safe))}`;
}

import qrcode from "qrcode-generator";
import type { Trade } from "../types";
import {
  formatPrice,
  formatSignedCurrency,
  formatSignedPercent,
  formatTime,
} from "../util/format";
import { escapeHtml } from "./dom";

export function shareText(trade: Trade): string {
  return `Binunce ${trade.symbol} ${trade.side.toUpperCase()} ${trade.leverage}x ${formatSignedPercent(
    trade.roiPct,
  )} ROI. Simulated only - no real money.`;
}

export function shareFileName(trade: Trade): string {
  return `binunce-${trade.symbol}-${trade.roiPct >= 0 ? "win" : "loss"}-${trade.closedAt}.png`;
}

export function shareCardMarkup(trade: Trade): string {
  const positive = trade.pnl >= 0;
  const qr = qrcode(0, "M");
  qr.addData("https://binunce.local/simulated?ref=DEGEN777");
  qr.make();
  return `<div class="relative h-[620px] w-[min(360px,calc(100vw-40px))] overflow-hidden rounded-2xl border border-line bg-[#0b0e11] p-5 text-primary shadow-2xl" data-share-card>
    <div class="pointer-events-none absolute inset-0 opacity-15" style="background: radial-gradient(circle at 35% 20%, ${positive ? "#0ECB81" : "#F6465D"} 0, transparent 36%), radial-gradient(circle at 80% 80%, #F0B90B 0, transparent 30%);"></div>
    <div class="pointer-events-none absolute left-0 top-[250px] rotate-[-22deg] text-5xl font-black tracking-normal text-white/5 sm:left-[-20px] sm:text-6xl">SIMULATED</div>
    <div class="relative flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="grid h-9 w-9 place-items-center rounded-lg bg-brand text-lg font-black text-black">B</div>
        <div>
          <div class="text-lg font-black">Binunce</div>
          <div class="text-xs font-bold text-secondary">Futures PnL Receipt</div>
        </div>
      </div>
      <div class="rounded-full border border-brand/35 px-2 py-1 text-[10px] font-black text-brand">SIMULATED</div>
    </div>
    <div class="relative mt-10">
      <div class="text-xs font-black uppercase text-secondary">ROI</div>
      <div class="mt-1 font-mono text-6xl font-black leading-none ${positive ? "text-long" : "text-short"}">
        ${escapeHtml(formatSignedPercent(trade.roiPct))}
      </div>
      <div class="mt-3 font-mono text-3xl font-black ${positive ? "text-long" : "text-short"}">
        ${escapeHtml(formatSignedCurrency(trade.pnl))}
      </div>
    </div>
    <div class="relative mt-7 grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-lg border border-line bg-[#11161b] p-3">
        <div class="text-[10px] font-bold uppercase text-secondary">Symbol</div>
        <div class="mt-1 font-black">${escapeHtml(trade.symbol)}</div>
      </div>
      <div class="rounded-lg border border-line bg-[#11161b] p-3">
        <div class="text-[10px] font-bold uppercase text-secondary">Side</div>
        <div class="mt-1 font-black ${trade.side === "long" ? "text-long" : "text-short"}">${trade.side.toUpperCase()} ${trade.leverage}x</div>
      </div>
      <div class="rounded-lg border border-line bg-[#11161b] p-3">
        <div class="text-[10px] font-bold uppercase text-secondary">Entry</div>
        <div class="mt-1 font-mono font-black">${escapeHtml(formatPrice(trade.entryPrice))}</div>
      </div>
      <div class="rounded-lg border border-line bg-[#11161b] p-3">
        <div class="text-[10px] font-bold uppercase text-secondary">Exit</div>
        <div class="mt-1 font-mono font-black">${escapeHtml(formatPrice(trade.exitPrice))}</div>
      </div>
    </div>
    <div class="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
      <div>
        <div class="text-xs font-bold text-secondary">Referral: DEGEN777</div>
        <div class="mt-1 text-xs text-muted">${escapeHtml(formatTime(trade.closedAt))}</div>
        <div class="mt-3 max-w-[178px] text-[11px] font-semibold leading-4 text-secondary">Simulation only. No real funds, no affiliation, no financial product.</div>
      </div>
      <div class="grid h-[92px] w-[92px] place-items-center rounded-xl bg-white p-2">
        ${qr.createSvgTag({ cellSize: 2, margin: 2 }).replace("<svg", '<svg aria-hidden="true"')}
      </div>
    </div>
  </div>`;
}

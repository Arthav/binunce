import { ASSETS } from "../engine/assets";
import type { AppState } from "../types";
import { formatCompact, formatPercent, formatPrice } from "../util/format";
import type { UIContext } from "./context";
import { escapeHtml } from "./dom";

export function mountMarketList(root: HTMLElement, ctx: UIContext): void {
  let query = "";
  let movers = false;

  const render = () => {
    const state = ctx.store.get();
    const rows = ASSETS.filter((asset) => {
      const needle = `${asset.symbol} ${asset.displayName}`.toLowerCase();
      return needle.includes(query.toLowerCase());
    }).sort((a, b) => {
      if (!movers) return 0;
      return Math.abs(changePct(state, b.symbol)) - Math.abs(changePct(state, a.symbol));
    });

    root.innerHTML = `<section class="panel flex h-full min-h-[320px] flex-col overflow-hidden">
      <div class="border-b border-line p-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-black">Markets</h2>
          <button class="chip ${movers ? "active" : ""}" data-toggle-movers>Movers</button>
        </div>
        <input class="mt-3 h-9 w-full rounded-lg px-3 text-sm font-bold" data-market-search placeholder="Search symbol" value="${escapeHtml(query)}" />
      </div>
      <div class="min-h-0 flex-1 overflow-auto">
        ${rows
          .map((asset) => {
            const price = state.prices[asset.symbol];
            const active = state.selectedSymbol === asset.symbol;
            const direction = price?.direction ?? 0;
            const change = changePct(state, asset.symbol);
            return `<button class="grid w-full grid-cols-[34px_1fr_auto] items-center gap-2 border-b border-line/70 px-3 py-2 text-left transition hover:bg-white/[0.03] ${active ? "bg-brand/10" : ""}" data-symbol="${asset.symbol}">
              <span class="grid h-8 w-8 place-items-center rounded-lg border border-line bg-[#0f1318] text-xs font-black text-brand">${escapeHtml(asset.logo)}</span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-black">${escapeHtml(asset.symbol)}</span>
                <span class="block truncate text-[11px] font-semibold text-secondary">${escapeHtml(asset.displayName)} - ${asset.class}</span>
                <span class="mt-1 block h-6">${sparkline(price?.candles.map((candle) => candle.close) ?? [])}</span>
              </span>
              <span class="text-right">
                <span class="block rounded px-1 py-0.5 font-mono text-sm font-black ${direction > 0 ? "price-up text-long" : direction < 0 ? "price-down text-short" : "text-primary"}">${escapeHtml(formatPrice(price?.price ?? asset.startPrice))}</span>
                <span class="block text-xs font-black ${change >= 0 ? "text-long" : "text-short"}">${escapeHtml(formatPercent(change))}</span>
                <span class="block text-[10px] font-semibold text-muted">Vol ${escapeHtml(formatCompact(price?.volume24h ?? 0))}</span>
              </span>
            </button>`;
          })
          .join("")}
      </div>
      <div class="border-t border-line p-3 text-[11px] font-semibold leading-4 text-muted">Not affiliated with listed assets or exchanges. Prices are synthetic and simulated.</div>
    </section>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const symbolButton = target.closest<HTMLElement>("[data-symbol]");
    if (symbolButton) ctx.actions.selectSymbol(symbolButton.dataset.symbol ?? "BTCUSDT");
    if (target.closest("[data-toggle-movers]")) {
      movers = !movers;
      render();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches("[data-market-search]")) {
      query = target.value;
      render();
      root.querySelector<HTMLInputElement>("[data-market-search]")?.focus();
    }
  });

  ctx.store.subscribe(render);
}

function changePct(state: AppState, symbol: string): number {
  const price = state.prices[symbol];
  if (!price || price.dayOpen <= 0) return 0;
  return ((price.price - price.dayOpen) / price.dayOpen) * 100;
}

function sparkline(values: number[]): string {
  const recent = values.slice(-28);
  if (recent.length < 2) return "";
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const span = max - min || 1;
  const points = recent
    .map((value, index) => {
      const x = (index / (recent.length - 1)) * 100;
      const y = 24 - ((value - min) / span) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = recent[recent.length - 1] >= recent[0];
  return `<svg viewBox="0 0 100 24" preserveAspectRatio="none" class="h-6 w-full">
    <polyline points="${points}" fill="none" stroke="${up ? "#0ECB81" : "#F6465D"}" stroke-width="2" vector-effect="non-scaling-stroke" />
  </svg>`;
}

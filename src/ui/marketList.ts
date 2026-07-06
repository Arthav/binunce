import { ASSETS } from "../engine/assets";
import type { AppState, AssetDefinition, Side } from "../types";
import { formatCompact, formatPercent, formatPrice } from "../util/format";
import type { UIContext } from "./context";
import { escapeHtml, icon } from "./dom";

type MarketFilter = "all" | AssetDefinition["class"];

export function mountMarketList(root: HTMLElement, ctx: UIContext): void {
  let query = "";
  let movers = false;
  let filter: MarketFilter = "all";

  const render = () => {
    const state = ctx.store.get();
    const rows = ASSETS.filter((asset) => {
      const needle = `${asset.symbol} ${asset.displayName}`.toLowerCase();
      const matchesQuery = needle.includes(query.toLowerCase());
      const matchesFilter = filter === "all" || asset.class === filter;
      return matchesQuery && matchesFilter;
    }).sort((a, b) => {
      if (!movers) return 0;
      return Math.abs(changePct(state, b.symbol)) - Math.abs(changePct(state, a.symbol));
    });
    const current = ASSETS.find((asset) => asset.symbol === state.selectedSymbol) ?? ASSETS[0];
    const selected = rows.find((asset) => asset.symbol === state.selectedSymbol) ?? rows[0] ?? current;
    const selectedPrice = state.prices[selected.symbol];
    const selectedChange = changePct(state, selected.symbol);
    const selectedMark = selectedPrice?.price ?? selected.startPrice;
    const selectedHigh = selectedPrice?.dayHigh ?? selectedMark;
    const selectedLow = selectedPrice?.dayLow ?? selectedMark;

    root.innerHTML = `<section class="panel flex h-[calc(100dvh-220px)] min-h-[320px] flex-col overflow-hidden lg:h-full">
      <div class="border-b border-line p-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-black">Markets</h2>
          <button class="chip ${movers ? "active" : ""}" data-toggle-movers>Movers</button>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2">
          ${(["all", "crypto", "stock"] as MarketFilter[])
            .map((item) => `<button class="chip ${filter === item ? "active" : ""}" data-market-filter="${item}">${filterLabel(item)}</button>`)
            .join("")}
        </div>
        <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input class="h-10 min-w-0 rounded-lg px-3 text-sm font-bold" data-market-search placeholder="Search symbol" value="${escapeHtml(query)}" />
          <button class="chip !min-h-10 !px-3 ${query ? "" : "opacity-40"}" data-clear-market-search ${query ? "" : "disabled"}>Clear</button>
        </div>
        <div class="mt-2 flex items-center justify-between gap-3 text-[11px] font-black uppercase text-secondary">
          <span>${rows.length} ${rows.length === 1 ? "market" : "markets"}</span>
          <span class="truncate">${movers ? "Sorted by movers" : filterLabel(filter)}</span>
        </div>
        ${
          rows.length > 0
            ? `<div class="mt-3 rounded-xl border border-brand/25 bg-brand/10 p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand/30 bg-[#0f1318] text-xs font-black text-brand">${escapeHtml(selected.logo)}</span>
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-black">${escapeHtml(selected.symbol)}</span>
                      <span class="block truncate text-[11px] font-semibold text-secondary">${escapeHtml(selected.displayName)} - ${selected.class}</span>
                    </span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-mono text-sm font-black ${selectedPrice?.direction === 1 ? "text-long" : selectedPrice?.direction === -1 ? "text-short" : "text-primary"}">${escapeHtml(formatPrice(selectedMark))}</div>
                  <div class="font-mono text-xs font-black ${selectedChange >= 0 ? "text-long" : "text-short"}">${escapeHtml(formatPercent(selectedChange))}</div>
                </div>
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
                ${selectedMetric("24h range", `${formatPrice(selectedLow)} - ${formatPrice(selectedHigh)}`)}
                ${selectedMetric("Volume", formatCompact(selectedPrice?.volume24h ?? 0))}
                ${selectedMetric("Regime", selectedPrice?.regime ?? "chop", regimeColor(selectedPrice?.regime))}
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2">
                <button class="btn btn-ghost flex !min-h-11 min-w-0 items-center justify-center gap-1 px-2" data-market-chart="${selected.symbol}">${icon("chart")} <span class="truncate">Chart</span></button>
                <button class="btn btn-long !min-h-11 min-w-0 px-2" data-market-trade-side="long" data-market-symbol="${selected.symbol}">Long</button>
                <button class="btn btn-short !min-h-11 min-w-0 px-2" data-market-trade-side="short" data-market-symbol="${selected.symbol}">Short</button>
              </div>
            </div>`
            : ""
        }
      </div>
      <div class="min-h-0 flex-1 overflow-auto">
        ${
          rows.length === 0
            ? `<div class="grid h-48 place-items-center px-5 text-center">
                <div>
                  <div class="text-base font-black text-primary">No matching markets</div>
                  <div class="mt-1 text-sm font-semibold text-secondary">Clear search or switch filters.</div>
                  <div class="mt-4 grid grid-cols-2 gap-2">
                    <button class="btn btn-primary !min-h-11" data-clear-market-search>Clear search</button>
                    <button class="btn btn-ghost !min-h-11" data-reset-market-filters>Show all</button>
                  </div>
                </div>
              </div>`
            : rows.map((asset) => marketRow(asset, state)).join("")
        }
      </div>
      <div class="border-t border-line p-3 text-[11px] font-semibold leading-4 text-muted">Not affiliated with listed assets or exchanges. Prices are synthetic and simulated.</div>
    </section>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const symbolButton = target.closest<HTMLElement>("[data-symbol]");
    const tradeButton = target.closest<HTMLElement>("[data-market-trade-side]");
    const chartButton = target.closest<HTMLElement>("[data-market-chart]");
    const filterButton = target.closest<HTMLElement>("[data-market-filter]");
    const clearSearchButton = target.closest<HTMLElement>("[data-clear-market-search]");
    const resetFiltersButton = target.closest<HTMLElement>("[data-reset-market-filters]");
    if (clearSearchButton) {
      query = "";
      render();
      root.querySelector<HTMLInputElement>("[data-market-search]")?.focus();
      return;
    }
    if (resetFiltersButton) {
      query = "";
      filter = "all";
      movers = false;
      render();
      root.querySelector<HTMLInputElement>("[data-market-search]")?.focus();
      return;
    }
    if (chartButton) {
      ctx.actions.selectSymbol(chartButton.dataset.marketChart ?? ctx.store.get().selectedSymbol);
      ctx.actions.setMobileTab("chart");
      return;
    }
    if (symbolButton) ctx.actions.selectSymbol(symbolButton.dataset.symbol ?? "BTCUSDT");
    if (tradeButton) {
      const symbol = tradeButton.dataset.marketSymbol ?? ctx.store.get().selectedSymbol;
      const side = tradeButton.dataset.marketTradeSide as Side;
      ctx.actions.selectSymbol(symbol);
      ctx.actions.setTradeSide(side);
      ctx.actions.setMobileTab("trade");
      ctx.actions.toast(`${symbol} ${side.toUpperCase()} ticket loaded.`, "info");
      return;
    }
    if (filterButton) {
      filter = filterButton.dataset.marketFilter as MarketFilter;
      render();
    }
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

function marketRow(asset: AssetDefinition, state: AppState): string {
  const price = state.prices[asset.symbol];
  const active = state.selectedSymbol === asset.symbol;
  const direction = price?.direction ?? 0;
  const change = changePct(state, asset.symbol);
  return `<button class="grid w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2 border-b border-line/70 px-3 py-2 text-left transition hover:bg-white/[0.03] ${active ? "bg-brand/10" : ""}" data-symbol="${asset.symbol}">
    <span class="grid h-8 w-8 place-items-center rounded-lg border border-line bg-[#0f1318] text-xs font-black text-brand">${escapeHtml(asset.logo)}</span>
    <span class="min-w-0">
      <span class="flex min-w-0 items-center gap-2">
        <span class="truncate text-sm font-black">${escapeHtml(asset.symbol)}</span>
        ${active ? `<span class="rounded border border-brand/30 px-1.5 py-0.5 text-[9px] font-black text-brand">ACTIVE</span>` : ""}
      </span>
      <span class="block truncate text-[11px] font-semibold text-secondary">${escapeHtml(asset.displayName)} - ${asset.class}</span>
      <span class="mt-1 block h-6">${sparkline(price?.candles.map((candle) => candle.close) ?? [])}</span>
    </span>
    <span class="text-right">
      <span class="block rounded px-1 py-0.5 font-mono text-sm font-black ${direction > 0 ? "price-up text-long" : direction < 0 ? "price-down text-short" : "text-primary"}">${escapeHtml(formatPrice(price?.price ?? asset.startPrice))}</span>
      <span class="block text-xs font-black ${change >= 0 ? "text-long" : "text-short"}">${escapeHtml(formatPercent(change))}</span>
      <span class="block text-[10px] font-semibold text-muted">Vol ${escapeHtml(formatCompact(price?.volume24h ?? 0))}</span>
    </span>
  </button>`;
}

function changePct(state: AppState, symbol: string): number {
  const price = state.prices[symbol];
  if (!price || price.dayOpen <= 0) return 0;
  return ((price.price - price.dayOpen) / price.dayOpen) * 100;
}

function filterLabel(filter: MarketFilter): string {
  if (filter === "crypto") return "Crypto";
  if (filter === "stock") return "Stocks";
  return "All";
}

function selectedMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="min-w-0 rounded-lg border border-line/80 bg-[#0b0f13]/75 p-2">
    <div class="truncate text-[9px] font-black uppercase text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono text-[11px] font-black ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

function regimeColor(regime?: "bull" | "bear" | "chop"): string {
  if (regime === "bull") return "text-long";
  if (regime === "bear") return "text-short";
  return "text-brand";
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

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
} from "lightweight-charts";
import { aggregateCandles } from "../engine/priceEngine";
import { getAsset } from "../engine/assets";
import { derivePositions } from "../store/selectors";
import type { Timeframe } from "../types";
import {
  formatCompact,
  formatCurrency,
  formatPercent,
  formatPrice,
  formatSignedCurrency,
  formatSignedPercent,
} from "../util/format";
import type { UIContext } from "./context";
import { escapeHtml } from "./dom";
import { tickerMarkup } from "./ticker";

export function mountChart(root: HTMLElement, ctx: UIContext): void {
  root.innerHTML = `<section class="panel flex min-h-[calc(100dvh-164px)] flex-col overflow-hidden lg:h-full lg:min-h-[420px]">
    <div class="border-b border-line p-3" data-chart-header></div>
    <div class="relative min-h-[360px] flex-1">
      <div class="absolute inset-0" data-chart-canvas></div>
      <div class="pointer-events-none absolute right-3 top-3 rounded-full border border-brand/25 bg-black/35 px-2 py-1 text-[10px] font-black text-brand backdrop-blur sm:px-3 sm:text-[11px]">SIMULATED</div>
    </div>
    <div class="border-t border-line p-3 lg:hidden" data-chart-rail></div>
  </section>`;

  const header = root.querySelector<HTMLElement>("[data-chart-header]")!;
  const canvas = root.querySelector<HTMLElement>("[data-chart-canvas]")!;
  const rail = root.querySelector<HTMLElement>("[data-chart-rail]")!;
  const chart: IChartApi = createChart(canvas, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "#0B0E11" },
      textColor: "#848E9C",
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: "rgba(43,49,57,0.42)" },
      horzLines: { color: "rgba(43,49,57,0.42)" },
    },
    rightPriceScale: { borderColor: "#2B3139" },
    timeScale: { borderColor: "#2B3139", timeVisible: true, secondsVisible: true },
    crosshair: { mode: 0 },
  });

  let series: any = null;
  let seriesType: "candles" | "area" | null = null;
  let lastSymbol = "";
  let lastTimeframe: Timeframe | "" = "";
  let lines: any[] = [];

  const ensureSeries = () => {
    const chartType = ctx.store.get().settings.chartType;
    if (series && seriesType === chartType) return;
    if (series) chart.removeSeries(series);
    lines = [];
    if (chartType === "candles") {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#0ECB81",
        downColor: "#F6465D",
        borderUpColor: "#0ECB81",
        borderDownColor: "#F6465D",
        wickUpColor: "#0ECB81",
        wickDownColor: "#F6465D",
      });
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: "#F0B90B",
        topColor: "rgba(240,185,11,0.28)",
        bottomColor: "rgba(240,185,11,0.02)",
      });
    }
    seriesType = chartType;
  };

  const render = () => {
    const state = ctx.store.get();
    const asset = getAsset(state.selectedSymbol);
    const price = state.prices[state.selectedSymbol];
    const candles = aggregateCandles(price?.candles ?? [], state.timeframe);
    const change = price && price.dayOpen > 0 ? ((price.price - price.dayOpen) / price.dayOpen) * 100 : 0;
    const activePosition = derivePositions(state).find(
      (position) => position.symbol === state.selectedSymbol,
    );
    header.innerHTML = `<div class="grid gap-3">
      <div class="flex items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <div class="grid h-9 w-9 place-items-center rounded-lg border border-line bg-[#0f1318] text-sm font-black text-brand">${escapeHtml(asset.logo)}</div>
          <div>
            <div class="text-xl font-black">${escapeHtml(asset.symbol)}</div>
            <div class="text-xs font-semibold text-secondary">${escapeHtml(asset.displayName)} - ${asset.class.toUpperCase()} - regime ${price?.regime ?? "chop"}</div>
          </div>
        </div>
      </div>
      <div class="text-right">
          <div class="text-[10px] font-black uppercase text-secondary">Mark</div>
          <div class="font-mono text-xl font-black ${price?.direction === 1 ? "text-long" : price?.direction === -1 ? "text-short" : "text-primary"}">${escapeHtml(formatPrice(price?.price ?? asset.startPrice))}</div>
        </div>
      </div>
      <div class="flex items-center justify-between gap-2 overflow-x-auto text-right">
        <div>
          <div class="text-[10px] font-black uppercase text-secondary">24h</div>
          <div class="font-mono text-sm font-black ${change >= 0 ? "text-long" : "text-short"}">${escapeHtml(formatPercent(change))}</div>
        </div>
        <div>
          <div class="text-[10px] font-black uppercase text-secondary">High / Low</div>
          <div class="font-mono text-xs font-bold text-primary">${escapeHtml(formatPrice(price?.dayHigh ?? 0))} / ${escapeHtml(formatPrice(price?.dayLow ?? 0))}</div>
        </div>
        <div>
          <div class="text-[10px] font-black uppercase text-secondary">Volume</div>
          <div class="font-mono text-xs font-bold text-primary">${escapeHtml(formatCompact(price?.volume24h ?? 0))}</div>
        </div>
        <div class="ml-auto flex shrink-0 gap-1">
          ${(["1s", "5s", "15s", "1m"] as Timeframe[])
            .map((tf) => `<button class="chip ${state.timeframe === tf ? "active" : ""}" data-timeframe="${tf}">${tf}</button>`)
            .join("")}
        </div>
      </div>
    </div>`;
    rail.innerHTML = `<div class="grid gap-3">
      ${
        activePosition
          ? `<div class="rounded-xl border border-line bg-[#10151a] p-3" style="background:${activePosition.unrealizedPnl >= 0 ? "rgba(14,203,129,0.08)" : "rgba(246,70,93,0.08)"}">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-xs font-black text-primary">${escapeHtml(activePosition.symbol)} <span class="${activePosition.side === "long" ? "text-long" : "text-short"}">${activePosition.side.toUpperCase()} ${activePosition.leverage}x</span></div>
                  <div class="mt-1 text-[11px] font-semibold text-secondary">Margin ${escapeHtml(formatCurrency(activePosition.margin))} - Liq ${escapeHtml(formatPrice(activePosition.liqPrice))}</div>
                </div>
                <div class="text-right font-mono font-black ${activePosition.unrealizedPnl >= 0 ? "text-long" : "text-short"}">
                  <div class="text-2xl">${tickerMarkup(formatSignedCurrency(activePosition.unrealizedPnl))}</div>
                  <div class="text-xs">${escapeHtml(formatSignedPercent(activePosition.roiPct))}</div>
                </div>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2">
                <button class="btn btn-ghost !min-h-11" data-chart-half-position="${activePosition.id}">Close 50%</button>
                <button class="btn btn-ghost !min-h-11" data-chart-close-position="${activePosition.id}">Close</button>
              </div>
            </div>`
          : ""
      }
      <div class="grid grid-cols-2 gap-2">
        <button class="btn btn-long !min-h-12" data-chart-trade-side="long">LONG ${escapeHtml(state.selectedSymbol)}</button>
        <button class="btn btn-short !min-h-12" data-chart-trade-side="short">SHORT ${escapeHtml(state.selectedSymbol)}</button>
      </div>
    </div>`;

    ensureSeries();
    const data =
      state.settings.chartType === "candles"
        ? candles.map((candle) => ({
            time: candle.time as any,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }))
        : candles.map((candle) => ({
            time: candle.time as any,
            value: candle.close,
          }));

    if (state.selectedSymbol !== lastSymbol || state.timeframe !== lastTimeframe || seriesType !== state.settings.chartType) {
      series.setData(data);
      chart.timeScale().fitContent();
      lastSymbol = state.selectedSymbol;
      lastTimeframe = state.timeframe;
    } else if (data.length > 0) {
      series.update(data[data.length - 1]);
    }

    lines.forEach((line) => series.removePriceLine(line));
    lines = [];
    derivePositions(state)
      .filter((position) => position.symbol === state.selectedSymbol)
      .forEach((position) => {
        lines.push(
          series.createPriceLine({
            price: position.entryPrice,
            color: position.side === "long" ? "#0ECB81" : "#F6465D",
            lineWidth: 2,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `${position.side.toUpperCase()} ENTRY`,
          }),
        );
        lines.push(
          series.createPriceLine({
            price: position.liqPrice,
            color: "#F6465D",
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: "LIQ",
          }),
        );
      });
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>("[data-timeframe]");
    if (button) ctx.actions.setTimeframe(button.dataset.timeframe as Timeframe);
    const tradeSide = target.closest<HTMLElement>("[data-chart-trade-side]");
    if (tradeSide) ctx.actions.setTradeSide(tradeSide.dataset.chartTradeSide as "long" | "short");
    const closeButton = target.closest<HTMLElement>("[data-chart-close-position]");
    if (closeButton) {
      const position = ctx.store.get().positions.find((item) => item.id === closeButton.dataset.chartClosePosition);
      if (position) ctx.actions.closePosition(position, "manual", 1);
    }
    const halfButton = target.closest<HTMLElement>("[data-chart-half-position]");
    if (halfButton) {
      const position = ctx.store.get().positions.find((item) => item.id === halfButton.dataset.chartHalfPosition);
      if (position) ctx.actions.closePosition(position, "manual", 0.5);
    }
  });

  ctx.store.subscribe(render);
}

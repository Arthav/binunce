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
import { escapeHtml, icon } from "./dom";
import { tickerMarkup } from "./ticker";

export function mountChart(root: HTMLElement, ctx: UIContext): void {
  root.innerHTML = `<section class="panel flex min-h-[calc(100dvh-220px)] flex-col overflow-hidden lg:h-full lg:min-h-[420px]">
    <div class="border-b border-line p-3" data-chart-header></div>
    <div class="relative min-h-[120px] flex-1 overflow-hidden sm:min-h-[220px] lg:min-h-[360px]">
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
    const regime = price?.regime ?? "chop";
    const symbolPositions = derivePositions(state).filter((position) => position.symbol === state.selectedSymbol);
    const activePosition = symbolPositions[0] ?? null;
    header.innerHTML = `<div class="grid gap-3">
      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <button class="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-[#0f1318] px-2 text-left transition hover:border-brand/45" data-chart-open-markets aria-label="Change chart market from ${escapeHtml(asset.symbol)}">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-[#0b0f13] text-sm font-black text-brand">${escapeHtml(asset.logo)}</span>
          <span class="min-w-0">
            <span class="block truncate text-xl font-black">${escapeHtml(asset.symbol)}</span>
            <span class="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-black uppercase leading-none">
              <span class="text-secondary">${escapeHtml(asset.displayName)}</span>
              <span class="rounded border border-line bg-[#0b0f13] px-1.5 py-1 text-secondary">${escapeHtml(asset.class)}</span>
              <span class="rounded border px-1.5 py-1 ${regimeTone(regime)}">Regime ${escapeHtml(regime)}</span>
            </span>
          </span>
          <span class="ml-auto shrink-0 text-brand">${icon("markets")}</span>
        </button>
        <div class="shrink-0 text-right">
          <div class="text-[10px] font-black uppercase text-secondary">Mark</div>
          <div class="font-mono text-[clamp(1rem,4.8vw,1.25rem)] font-black ${price?.direction === 1 ? "text-long" : price?.direction === -1 ? "text-short" : "text-primary"}">${escapeHtml(formatPrice(price?.price ?? asset.startPrice))}</div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        ${chartStat("24h", formatPercent(change), change >= 0 ? "text-long" : "text-short")}
        ${chartRangeStat("High / Low", formatPrice(price?.dayHigh ?? 0), formatPrice(price?.dayLow ?? 0))}
        ${chartStat("Volume", formatCompact(price?.volume24h ?? 0))}
      </div>
      <div class="grid grid-cols-4 gap-1 rounded-lg border border-line/80 bg-[#0b0f13]/75 p-1" aria-label="Chart timeframe">
        ${(["1s", "5s", "15s", "1m"] as Timeframe[])
          .map((tf) => timeframeButton(tf, state.timeframe === tf))
          .join("")}
      </div>
    </div>`;
    rail.innerHTML = `<div class="grid gap-3">
      ${
        activePosition
          ? chartPositionCockpitMarkup(symbolPositions, activePosition)
          : chartTradeTicketMarkup(price?.price ?? asset.startPrice, state.selectedSymbol)
      }
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
        if (position.tpPrice) {
          lines.push(
            series.createPriceLine({
              price: position.tpPrice,
              color: "#0ECB81",
              lineWidth: 2,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `${position.side.toUpperCase()} TP`,
            }),
          );
        }
        if (position.slPrice) {
          lines.push(
            series.createPriceLine({
              price: position.slPrice,
              color: "#F6465D",
              lineWidth: 2,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `${position.side.toUpperCase()} SL`,
            }),
          );
        }
      });
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>("[data-timeframe]");
    if (button) ctx.actions.setTimeframe(button.dataset.timeframe as Timeframe);
    if (target.closest("[data-chart-open-markets]")) ctx.actions.setMobileTab("markets");
    if (target.closest("[data-chart-manage-positions]")) {
      ctx.actions.setMobileTab("positions");
      ctx.actions.setPositionsPanelTab("positions");
      return;
    }
    const tradeSide = target.closest<HTMLElement>("[data-chart-trade-side]");
    if (tradeSide) {
      const side = tradeSide.dataset.chartTradeSide as "long" | "short";
      const symbol = ctx.store.get().selectedSymbol;
      ctx.actions.setTradeSide(side);
      ctx.actions.setMobileTab("trade");
      ctx.actions.toast(`${symbol} ${side.toUpperCase()} ticket loaded.`, "info");
      return;
    }
    const closeButton = target.closest<HTMLElement>("[data-chart-close-position]");
    if (closeButton) {
      ctx.actions.reviewClosePosition(closeButton.dataset.chartClosePosition ?? "", 1);
      return;
    }
    const halfButton = target.closest<HTMLElement>("[data-chart-half-position]");
    if (halfButton) {
      ctx.actions.reviewClosePosition(halfButton.dataset.chartHalfPosition ?? "", 0.5);
      return;
    }
  });

  ctx.store.subscribe(render);
}

function chartStat(label: string, value: string, color = "text-primary"): string {
  return `<div class="min-w-0 rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2 text-left">
    <div class="text-[10px] font-black uppercase leading-none text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono text-xs font-black leading-tight ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

function chartRangeStat(label: string, high: string, low: string): string {
  return `<div class="min-w-0 rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2 text-left">
    <div class="text-[10px] font-black uppercase leading-none text-secondary">${label}</div>
    <div class="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1 font-mono text-[11px] font-black leading-tight text-primary">
      <span class="text-[9px] text-secondary">H</span><span class="truncate" title="${escapeHtml(high)}">${escapeHtml(high)}</span>
      <span class="text-[9px] text-secondary">L</span><span class="truncate" title="${escapeHtml(low)}">${escapeHtml(low)}</span>
    </div>
  </div>`;
}

function timeframeButton(timeframe: Timeframe, active: boolean): string {
  return `<button class="min-h-9 rounded-md border px-2 font-mono text-sm font-black transition ${
    active
      ? "border-brand bg-brand text-[#0b0e11] shadow-[0_8px_18px_rgba(240,185,11,0.18)]"
      : "border-transparent bg-[#11161b] text-secondary hover:border-brand/45 hover:text-brand"
  }" data-timeframe="${timeframe}">${timeframe}</button>`;
}

function quickTradeButton(side: "long" | "short", symbol: string, compact = false): string {
  const isLong = side === "long";
  return `<button class="btn ${isLong ? "btn-long" : "btn-short"} flex !min-h-12 min-w-0 flex-col items-center justify-center px-2 leading-none" data-chart-trade-side="${side}" aria-label="Open ${side} ticket for ${escapeHtml(symbol)}">
    <span class="text-sm font-black">${compact ? (isLong ? "Long" : "Short") : isLong ? "Open long" : "Open short"}</span>
    <span class="mt-1 max-w-full truncate font-mono text-[10px] font-black opacity-80">${escapeHtml(symbol)}</span>
  </button>`;
}

function chartTradeTicketMarkup(markPrice: number, symbol: string): string {
  return `<div class="rounded-xl border border-line bg-[#0f1318] p-2.5">
    <div class="grid grid-cols-[minmax(0,1fr)_78px_78px] items-center gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-[#0b0f13] text-brand">${icon("trade")}</span>
        <span class="min-w-0">
          <span class="block text-sm font-black">Trade ticket</span>
          <span class="block truncate font-mono text-[11px] font-black text-secondary">${escapeHtml(formatPrice(markPrice))}</span>
        </span>
      </div>
      ${quickTradeButton("long", symbol, true)}
      ${quickTradeButton("short", symbol, true)}
    </div>
  </div>`;
}

function chartPositionCockpitMarkup(positions: ReturnType<typeof derivePositions>, activePosition: ReturnType<typeof derivePositions>[number]): string {
  const totalMargin = positions.reduce((sum, position) => sum + position.margin, 0);
  const totalExposure = positions.reduce((sum, position) => sum + position.notional, 0);
  const totalPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const roiPct = totalMargin > 0 ? (totalPnl / totalMargin) * 100 : 0;
  const nearestLiqBuffer = Math.min(...positions.map(liquidationBufferPct));
  const risk = chartRiskTone(nearestLiqBuffer);
  const triggerSummary = activePosition.tpPrice || activePosition.slPrice
    ? `${activePosition.tpPrice ? `TP ${formatPrice(activePosition.tpPrice)}` : "TP --"} / ${activePosition.slPrice ? `SL ${formatPrice(activePosition.slPrice)}` : "SL --"}`
    : "No TP / SL armed";
  const stackLabel = positions.length === 1 ? "1 live leg" : `${positions.length} live legs`;

  return `<div class="rounded-xl border border-line bg-[#10151a] p-2.5" data-chart-position-cockpit style="background:${totalPnl >= 0 ? "rgba(14,203,129,0.08)" : "rgba(246,70,93,0.08)"}">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-1">
          <span class="rounded px-2 py-1 text-xs font-black ${activePosition.side === "long" ? "bg-long/10 text-long" : "bg-short/10 text-short"}">${escapeHtml(activePosition.side.toUpperCase())} ${escapeHtml(formatLeverage(activePosition.leverage))}</span>
          <span class="rounded border border-line/80 bg-[#0b0f13]/80 px-2 py-1 text-xs font-black ${risk.color}">${escapeHtml(risk.label)}</span>
        </div>
        <div class="mt-2 text-sm font-black">${escapeHtml(activePosition.symbol)} position stack</div>
        <div class="mt-1 truncate text-[11px] font-semibold text-secondary">${escapeHtml(stackLabel)} - ${escapeHtml(triggerSummary)}</div>
      </div>
      <div class="shrink-0 text-right font-mono font-black ${totalPnl >= 0 ? "text-long" : "text-short"}">
        <div class="text-2xl leading-none">${tickerMarkup(formatSignedCurrency(totalPnl))}</div>
        <div class="text-xs">${escapeHtml(formatSignedPercent(roiPct))}</div>
      </div>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
      ${chartRailMetric("Margin", formatCurrency(totalMargin))}
      ${chartRailMetric("Exposure", formatCurrency(totalExposure))}
      ${chartRailMetric("Liq gap", formatPercent(nearestLiqBuffer), risk.color)}
    </div>
    <div class="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
      <button class="btn btn-ghost !min-h-11 min-w-0 px-2" data-chart-manage-positions aria-label="Manage open positions">Manage</button>
      <button class="btn btn-ghost !min-h-11 min-w-0 px-2" data-chart-half-position="${activePosition.id}">Reduce</button>
      <button class="btn btn-primary !min-h-11 min-w-0 px-2" data-chart-close-position="${activePosition.id}">Close</button>
    </div>
  </div>`;
}

function chartRailMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="min-w-0 rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono text-xs font-black ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

function liquidationBufferPct(position: ReturnType<typeof derivePositions>[number]): number {
  if (position.markPrice <= 0 || position.liqPrice <= 0) return 0;
  const gap = position.side === "long" ? position.markPrice - position.liqPrice : position.liqPrice - position.markPrice;
  return Math.max(0, (gap / position.markPrice) * 100);
}

function chartRiskTone(bufferPct: number): { label: string; color: string } {
  if (bufferPct <= 1.5) return { label: "Critical", color: "text-short" };
  if (bufferPct <= 4) return { label: "Tight", color: "text-brand" };
  return { label: "Roomy", color: "text-long" };
}

function formatLeverage(value: number): string {
  if (!Number.isFinite(value)) return "0x";
  if (Number.isInteger(value)) return `${value.toFixed(0)}x`;
  if (value >= 100) return `${value.toFixed(0)}x`;
  if (value >= 10) return `${value.toFixed(1)}x`;
  return `${value.toFixed(2).replace(/\.?0+$/, "")}x`;
}

function regimeTone(regime: string): string {
  if (regime === "bull") return "border-long/35 bg-long/10 text-long";
  if (regime === "bear") return "border-short/35 bg-short/10 text-short";
  return "border-brand/35 bg-brand/10 text-brand";
}

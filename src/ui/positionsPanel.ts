import { deriveAccount, derivePositions } from "../store/selectors";
import { calculateFee, calculateLiquidationPrice } from "../engine/pnl";
import type { AppState, DerivedPosition, Trade } from "../types";
import {
  formatCurrency,
  formatDuration,
  formatPercent,
  formatPrice,
  formatSignedCurrency,
  formatSignedPercent,
  formatTime,
} from "../util/format";
import { formatInputMoney, parseMoneyInput } from "../util/math";
import type { UIContext } from "./context";
import { escapeHtml, icon } from "./dom";
import { historyMarkup, type HistoryFilter } from "./historyPanel";
import { tickerMarkup } from "./ticker";

interface TriggerEditor {
  positionId: string;
  tpRaw: string;
  slRaw: string;
}

interface AddMarginEditor {
  positionId: string;
  amountRaw: string;
}

export function mountPositionsPanel(root: HTMLElement, ctx: UIContext): void {
  let triggerEditor: TriggerEditor | null = null;
  let addMarginEditor: AddMarginEditor | null = null;
  let historyFilter: HistoryFilter = "all";

  const render = () => {
    const state = ctx.store.get();
    const tab = state.positionsPanelTab;
    if (triggerEditor && !state.positions.some((position) => position.id === triggerEditor?.positionId)) {
      triggerEditor = null;
    }
    if (addMarginEditor && !state.positions.some((position) => position.id === addMarginEditor?.positionId)) {
      addMarginEditor = null;
    }
    const previousPositionsScrollTop = root.querySelector<HTMLElement>("[data-positions-scroll]")?.scrollTop ?? 0;
    const pendingClose =
      tab === "positions" && state.closeReview && state.positions.some((position) => position.id === state.closeReview?.positionId)
        ? state.closeReview
        : null;
    root.innerHTML = `<section class="panel flex h-[calc(100dvh-220px)] flex-col overflow-hidden lg:h-full lg:min-h-[260px]">
      <div class="flex items-center justify-between border-b border-line p-3">
        <div class="flex gap-2">
          <button class="chip ${tab === "positions" ? "active" : ""}" data-panel-tab="positions">Positions (${state.positions.length})</button>
          <button class="chip ${tab === "history" ? "active" : ""}" data-panel-tab="history">History (${state.trades.length})</button>
        </div>
        <div class="text-[11px] font-black text-brand">LIVE PNL UPDATES</div>
      </div>
      <div class="min-h-0 flex-1 overflow-hidden">${tab === "positions" ? positionsMarkup(state, pendingClose, triggerEditor, addMarginEditor) : historyMarkup(state, historyFilter)}</div>
    </section>`;
    const nextPositionsScroller = root.querySelector<HTMLElement>("[data-positions-scroll]");
    if (nextPositionsScroller && previousPositionsScrollTop > 0) {
      nextPositionsScroller.scrollTop = previousPositionsScrollTop;
    }
    if (tab === "positions" && (pendingClose || triggerEditor || addMarginEditor)) revealActiveInlineEditor();
  };

  function revealActiveInlineEditor(): void {
    const scrollEditorIntoView = () => {
      const editors = Array.from(
        root.querySelectorAll<HTMLElement>(
          "[data-close-confirmation], [data-trigger-editor], [data-add-margin-editor]",
        ),
      );
      const visibleConfirmation = editors.find((element) => element.offsetParent !== null) ?? editors[0];
      const scroller = root.querySelector<HTMLElement>("[data-positions-scroll]");
      if (!visibleConfirmation || !scroller) return;
      const confirmationRect = visibleConfirmation.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const bottomNavTop = document.querySelector("nav")?.getBoundingClientRect().top ?? window.innerHeight;
      const visibleBottom = Math.min(scrollerRect.bottom, bottomNavTop - 12);
      const neededScroll = confirmationRect.bottom - visibleBottom + 12;
      if (neededScroll > 0) {
        scroller.scrollTop += neededScroll;
      }
    };
    window.requestAnimationFrame(scrollEditorIntoView);
    window.setTimeout(scrollEditorIntoView, 80);
  }

  function renderAndRestoreInput(selector: string, caret: number | null): void {
    render();
    const input = root.querySelector<HTMLInputElement>(selector);
    if (!input) return;
    input.focus({ preventScroll: true });
    const nextCaret = Math.min(caret ?? input.value.length, input.value.length);
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // Some input modes do not allow programmatic selection; focus is still restored.
    }
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const tabButton = target.closest<HTMLElement>("[data-panel-tab]");
    const closeButton = target.closest<HTMLElement>("[data-close-position]");
    const halfButton = target.closest<HTMLElement>("[data-half-position]");
    const closeSizePresetButton = target.closest<HTMLElement>("[data-close-size-preset]");
    const confirmCloseButton = target.closest<HTMLElement>("[data-confirm-close-position]");
    const cancelCloseButton = target.closest<HTMLElement>("[data-cancel-close]");
    const editTriggersButton = target.closest<HTMLElement>("[data-edit-triggers]");
    const positionChartButton = target.closest<HTMLElement>("[data-position-chart]");
    const positionAddButton = target.closest<HTMLElement>("[data-position-add]");
    const addMarginPresetButton = target.closest<HTMLElement>("[data-add-margin-preset]");
    const confirmAddMarginButton = target.closest<HTMLElement>("[data-confirm-add-margin]");
    const presetTriggerButton = target.closest<HTMLElement>("[data-trigger-preset]");
    const saveTriggersButton = target.closest<HTMLElement>("[data-save-triggers]");
    const historyFilterButton = target.closest<HTMLElement>("[data-history-filter]");
    const replayTradeButton = target.closest<HTMLElement>("[data-replay-trade]");
    const shareButton = target.closest<HTMLElement>("[data-share-trade]");
    const emptyTradeButton = target.closest<HTMLElement>("[data-empty-trade]");
    const emptyMarketsButton = target.closest<HTMLElement>("[data-empty-markets]");
    if (tabButton) {
      triggerEditor = null;
      addMarginEditor = null;
      ctx.actions.clearCloseReview();
      ctx.actions.setPositionsPanelTab(tabButton.dataset.panelTab as AppState["positionsPanelTab"]);
    }
    if (target.closest("[data-open-deposit]")) ctx.actions.openTopup();
    if (emptyTradeButton) ctx.actions.setMobileTab("trade");
    if (emptyMarketsButton) ctx.actions.setMobileTab("markets");
    if (positionChartButton) {
      const position = ctx.store.get().positions.find((item) => item.id === positionChartButton.dataset.positionChart);
      if (!position) return;
      triggerEditor = null;
      addMarginEditor = null;
      ctx.actions.selectSymbol(position.symbol);
      ctx.actions.setMobileTab("chart");
      return;
    }
    if (positionAddButton) {
      const state = ctx.store.get();
      const position = derivePositions(state).find((item) => item.id === positionAddButton.dataset.positionAdd);
      if (!position) return;
      triggerEditor = null;
      ctx.actions.clearCloseReview();
      const freeMargin = deriveAccount(state).freeMargin;
      addMarginEditor = {
        positionId: position.id,
        amountRaw: formatInputMoney(suggestedMarginAdd(position, freeMargin)),
      };
      render();
      return;
    }
    if (historyFilterButton) {
      historyFilter = historyFilterButton.dataset.historyFilter as HistoryFilter;
      render();
      return;
    }
    if (replayTradeButton) {
      const trade = ctx.store.get().trades.find((item) => item.id === replayTradeButton.dataset.replayTrade);
      if (!trade) return;
      ctx.actions.selectSymbol(trade.symbol);
      ctx.actions.setTradeSide(trade.side);
      ctx.actions.setMobileTab("trade");
      ctx.actions.toast(`${trade.symbol} ${trade.side.toUpperCase()} setup loaded from history.`, "info");
      return;
    }
    if (cancelCloseButton) {
      ctx.actions.clearCloseReview();
      return;
    }
    if (closeSizePresetButton) {
      const positionId = closeSizePresetButton.dataset.closeSizePosition ?? "";
      const percent = Number(closeSizePresetButton.dataset.closeSizePreset ?? 100);
      ctx.actions.reviewClosePosition(positionId, percent / 100);
      return;
    }
    if (target.closest("[data-cancel-triggers]")) {
      triggerEditor = null;
      render();
      return;
    }
    if (target.closest("[data-cancel-add-margin]")) {
      addMarginEditor = null;
      render();
      return;
    }
    if (addMarginPresetButton && addMarginEditor) {
      addMarginEditor = {
        ...addMarginEditor,
        amountRaw: formatInputMoney(Number(addMarginPresetButton.dataset.addMarginPreset ?? 0)),
      };
      render();
      return;
    }
    if (confirmAddMarginButton && addMarginEditor) {
      const amount = parseMoneyInput(addMarginEditor.amountRaw);
      const updated = ctx.actions.addMarginToPosition(addMarginEditor.positionId, amount);
      if (updated) {
        addMarginEditor = null;
        render();
      }
      return;
    }
    if (target.closest("[data-clear-position-triggers]") && triggerEditor) {
      triggerEditor = { ...triggerEditor, tpRaw: "", slRaw: "" };
      render();
      return;
    }
    if (presetTriggerButton && triggerEditor) {
      const position = derivePositions(ctx.store.get()).find((item) => item.id === triggerEditor?.positionId);
      if (!position) return;
      const preset = presetTriggerButton.dataset.triggerPreset;
      if (preset === "tp") {
        triggerEditor = {
          ...triggerEditor,
          tpRaw: triggerInputPrice(triggerPresetPrice(position, "tp")),
        };
      }
      if (preset === "sl") {
        triggerEditor = {
          ...triggerEditor,
          slRaw: triggerInputPrice(triggerPresetPrice(position, "sl")),
        };
      }
      render();
      return;
    }
    if (saveTriggersButton && triggerEditor) {
      const position = derivePositions(ctx.store.get()).find((item) => item.id === triggerEditor?.positionId);
      if (!position) return;
      const { tpPrice, slPrice } = resolveTriggerPrices(triggerEditor);
      const triggerIssue = validatePositionTriggers(position.side, position.markPrice, tpPrice, slPrice);
      if (triggerIssue) {
        ctx.actions.toast(triggerIssue, "error");
        render();
        return;
      }
      const updated = ctx.actions.updatePositionTriggers(
        triggerEditor.positionId,
        tpPrice,
        slPrice,
      );
      if (updated) {
        triggerEditor = null;
        render();
      }
      return;
    }
    if (confirmCloseButton) {
      const position = ctx.store.get().positions.find((item) => item.id === confirmCloseButton.dataset.confirmClosePosition);
      const fraction = Number(confirmCloseButton.dataset.closeFraction ?? 1);
      ctx.actions.clearCloseReview();
      if (position) ctx.actions.closePosition(position, "manual", Number.isFinite(fraction) ? fraction : 1);
      return;
    }
    if (editTriggersButton) {
      const position = ctx.store.get().positions.find((item) => item.id === editTriggersButton.dataset.editTriggers);
      if (!position) return;
      addMarginEditor = null;
      triggerEditor = {
        positionId: position.id,
        tpRaw: position.tpPrice ? triggerInputPrice(position.tpPrice) : "",
        slRaw: position.slPrice ? triggerInputPrice(position.slPrice) : "",
      };
      ctx.actions.clearCloseReview();
      render();
      return;
    }
    if (closeButton) {
      triggerEditor = null;
      addMarginEditor = null;
      ctx.actions.reviewClosePosition(closeButton.dataset.closePosition ?? "", 1);
      return;
    }
    if (halfButton) {
      triggerEditor = null;
      addMarginEditor = null;
      ctx.actions.reviewClosePosition(halfButton.dataset.halfPosition ?? "", 0.5);
      return;
    }
    if (shareButton) {
      const trade = ctx.store.get().trades.find((item) => item.id === shareButton.dataset.shareTrade);
      if (trade) ctx.actions.openResult(trade);
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    if (triggerEditor && target.matches("[data-trigger-tp-input]")) {
      const caret = target.selectionStart;
      triggerEditor = { ...triggerEditor, tpRaw: target.value };
      renderAndRestoreInput("[data-trigger-tp-input]", caret);
      return;
    }
    if (triggerEditor && target.matches("[data-trigger-sl-input]")) {
      const caret = target.selectionStart;
      triggerEditor = { ...triggerEditor, slRaw: target.value };
      renderAndRestoreInput("[data-trigger-sl-input]", caret);
      return;
    }
    if (addMarginEditor && target.matches("[data-add-margin-input]")) {
      const caret = target.selectionStart;
      addMarginEditor = { ...addMarginEditor, amountRaw: target.value };
      renderAndRestoreInput("[data-add-margin-input]", caret);
      return;
    }
    if (target.matches("[data-close-slider]")) {
      const percent = Number(target.value);
      ctx.actions.reviewClosePosition(target.dataset.closeSlider ?? "", percent / 100);
    }
  });

  ctx.store.subscribe(render);
}

function positionsMarkup(
  state: AppState,
  pendingClose: { positionId: string; fraction: number } | null,
  triggerEditor: TriggerEditor | null,
  addMarginEditor: AddMarginEditor | null,
): string {
  const positions = derivePositions(state);
  const derived = deriveAccount(state);
  if (positions.length === 0) {
    const latestTrade = latestClosedTrade(state);
    return `<div class="h-full overflow-auto" data-positions-scroll>
      <div class="grid min-h-full place-items-center p-3 text-center">
        <div class="w-full max-w-sm py-2">
          <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-xl font-black text-brand">0x</div>
          <div class="mt-4 text-xl font-black">No open positions</div>
          <div class="mx-auto mt-2 max-w-[30ch] text-sm font-semibold leading-6 text-secondary">Nothing is exposed right now. Reopen the last setup or start clean from the ticket.</div>
          ${latestTrade ? latestSettlementPreviewMarkup(latestTrade) : ""}
          <div class="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-line bg-[#0f1318] p-3 text-left">
          ${cardMetric("Free wallet", formatCurrency(derived.freeMargin))}
          ${cardMetric("Open margin", formatCurrency(derived.marginUsed))}
          </div>
          <div class="mt-4 grid gap-2">
            ${
              derived.freeMargin <= 0
                ? `<button class="btn btn-primary w-full" data-open-deposit>Deposit simulated funds</button>`
                : `<button class="btn btn-primary w-full" data-empty-trade>Open trade ticket</button>`
            }
            <button class="btn btn-ghost w-full" data-empty-markets>Browse markets</button>
          </div>
          <div class="mt-3 text-[11px] font-black text-brand">SIMULATION - NO REAL MONEY</div>
        </div>
      </div>
    </div>`;
  }
  return `<div class="h-full overflow-auto" data-positions-scroll>
    <div class="grid gap-3 p-3 lg:hidden">
      ${positionBookSummaryMarkup(positions)}
      ${positions
        .map((position) => {
          const positive = position.unrealizedPnl >= 0;
          const liqBuffer = liquidationBufferPct(position);
          const risk = liquidationRisk(liqBuffer);
          const closeFee = calculateFee(position.notional);
          const estimatedCloseCredit = position.margin + position.unrealizedPnl - closeFee;
          const activeTriggerEditor = triggerEditor?.positionId === position.id ? triggerEditor : null;
          const activeAddMarginEditor = addMarginEditor?.positionId === position.id ? addMarginEditor : null;
          const background = positive
            ? `rgba(14,203,129,${0.06 + position.heat * 0.16})`
            : `rgba(246,70,93,${0.06 + position.heat * 0.16})`;
          return `<article class="rounded-xl border border-line bg-[#10151a] p-3" style="background:${background}">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-base font-black">${escapeHtml(position.symbol)}</div>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span class="inline-flex rounded px-2 py-1 text-xs font-black ${position.side === "long" ? "bg-long/10 text-long" : "bg-short/10 text-short"}">${position.side.toUpperCase()} ${position.leverage}x</span>
                  <span class="inline-flex rounded border border-line/80 bg-[#0b0f13]/80 px-2 py-1 text-xs font-black ${risk.color}">${escapeHtml(risk.label)}</span>
                </div>
              </div>
              <div class="text-right font-mono font-black ${positive ? "text-long" : "text-short"}">
                <div class="text-3xl leading-none">${tickerMarkup(formatSignedCurrency(position.unrealizedPnl))}</div>
                <div class="mt-1 text-sm">${escapeHtml(formatSignedPercent(position.roiPct))}</div>
              </div>
            </div>
            ${
              pendingClose?.positionId === position.id
                ? `<div class="mt-4">${closeConfirmationMarkup(position, pendingClose.fraction)}</div>`
                : activeAddMarginEditor
                  ? `<div class="mt-4">${addMarginEditorMarkup(position, activeAddMarginEditor, derived.freeMargin)}</div>`
                  : activeTriggerEditor
                    ? `<div class="mt-4">${triggerEditorMarkup(position, activeTriggerEditor)}</div>`
                    : `<div class="mt-4 grid gap-2">
                      <div class="grid grid-cols-3 gap-2">
                        <button class="btn btn-ghost flex !min-h-11 min-w-0 items-center justify-center gap-1 px-2" data-position-chart="${position.id}">${icon("chart")} <span class="truncate">Chart</span></button>
                        <button class="btn btn-primary flex !min-h-11 min-w-0 items-center justify-center gap-1 px-2" data-position-add="${position.id}">${icon("deposit")} <span class="truncate">Margin</span></button>
                        <button class="btn btn-ghost flex !min-h-11 min-w-0 items-center justify-center border-brand/35 px-2 text-brand" data-edit-triggers="${position.id}">TP / SL</button>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <button class="btn btn-ghost !min-h-11" data-half-position="${position.id}">Reduce size</button>
                        <button class="btn btn-ghost !min-h-11 border-short/40 text-short" data-close-position="${position.id}">Close review</button>
                      </div>
                    </div>`
            }
            <div class="mt-4 rounded-xl border border-line/80 bg-[#0b0f13]/80 p-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-[10px] font-black uppercase text-secondary">Liquidation buffer</div>
                  <div class="mt-1 text-xs font-semibold text-secondary">Distance from mark to forced close</div>
                </div>
                <div class="font-mono text-lg font-black ${risk.color}">${escapeHtml(formatPercent(liqBuffer))}</div>
              </div>
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-[#05080a]">
                <div class="h-full rounded-full" style="width:${riskBarWidth(liqBuffer)}%;background:${risk.barColor}"></div>
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
                ${cardMetric("Open age", formatDuration(Date.now() - position.openedAt))}
                ${cardMetric("Exposure", formatCurrency(position.notional))}
                ${cardMetric("If closed", formatCurrency(estimatedCloseCredit), estimatedCloseCredit >= 0 ? "text-long" : "text-short")}
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
                <button class="chip" data-half-position="${position.id}">Reduce 50%</button>
                <button class="chip ml-1" data-close-position="${position.id}">Review close</button>
              </td>
            </tr>
            ${
              pendingClose?.positionId === position.id
                ? `<tr class="border-b border-line/70 bg-[#0b0f13]">
                    <td colspan="10" class="px-3 py-3">${closeConfirmationMarkup(position, pendingClose.fraction)}</td>
                  </tr>`
                : ""
            }`;
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

function latestClosedTrade(state: AppState): Trade | null {
  return [...state.trades].sort((a, b) => b.closedAt - a.closedAt)[0] ?? null;
}

function latestSettlementPreviewMarkup(trade: Trade): string {
  const positive = trade.pnl >= 0;
  const reason = tradeReasonMeta(trade.closeReason);
  const walletCredit = tradeSettlementCredit(trade);
  return `<article class="mt-4 rounded-xl border border-line bg-[#10151a] p-3 text-left" style="background:${positive ? "rgba(14,203,129,0.06)" : "rgba(246,70,93,0.08)"}">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[10px] font-black uppercase text-secondary">Latest settlement</div>
        <div class="mt-1 truncate text-base font-black">${escapeHtml(trade.symbol)}</div>
        <div class="mt-1 flex flex-wrap items-center gap-1">
          <span class="rounded px-2 py-1 text-[10px] font-black ${trade.side === "long" ? "bg-long/10 text-long" : "bg-short/10 text-short"}">${trade.side.toUpperCase()} ${trade.leverage}x</span>
          <span class="rounded px-2 py-1 text-[10px] font-black ${reason.tone}">${reason.label}</span>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <div class="font-mono text-xl font-black ${positive ? "text-long" : "text-short"}">${escapeHtml(formatSignedCurrency(trade.pnl))}</div>
        <div class="font-mono text-[11px] font-black ${positive ? "text-long" : "text-short"}">${escapeHtml(formatSignedPercent(trade.roiPct))}</div>
      </div>
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
      ${cardMetric("Closed", formatTime(trade.closedAt))}
      ${cardMetric("Held", formatDuration(trade.durationMs))}
      ${cardMetric("Exit", formatPrice(trade.exitPrice))}
      ${cardMetric("Wallet credit", formatCurrency(walletCredit), walletCredit >= 0 ? "text-long" : "text-short")}
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button class="btn btn-ghost flex !min-h-11 min-w-0 items-center justify-center gap-1 px-2 text-xs" data-replay-trade="${trade.id}">${icon("trade")} <span>Again</span></button>
      <button class="btn btn-primary flex !min-h-11 min-w-0 items-center justify-center gap-1 px-2 text-xs" data-share-trade="${trade.id}">${icon("history")} <span>Receipt</span></button>
    </div>
  </article>`;
}

function tradeReasonMeta(reason: Trade["closeReason"]): { label: string; tone: string } {
  if (reason === "tp") return { label: "TP close", tone: "bg-long/10 text-long" };
  if (reason === "sl") return { label: "SL close", tone: "bg-short/10 text-short" };
  if (reason === "liquidation") return { label: "LIQUIDATED", tone: "bg-short/10 text-short" };
  return { label: "Manual close", tone: "bg-brand/10 text-brand" };
}

function tradeSettlementCredit(trade: Trade): number {
  if (trade.closeReason === "liquidation") return 0;
  return trade.margin + trade.pnl;
}

function positionBookSummaryMarkup(positions: DerivedPosition[]): string {
  const totalPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const totalMargin = positions.reduce((sum, position) => sum + position.margin, 0);
  const totalExposure = positions.reduce((sum, position) => sum + position.notional, 0);
  const lowestBuffer = Math.min(...positions.map(liquidationBufferPct));
  const risk = liquidationRisk(lowestBuffer);
  return `<div class="rounded-xl border border-line bg-[#0f1318] p-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm font-black">Open book</div>
        <div class="mt-1 text-xs font-semibold text-secondary">${positions.length} live ${positions.length === 1 ? "position" : "positions"} watched in real time</div>
      </div>
      <div class="rounded border border-line bg-[#0b0f13] px-2 py-1 text-[10px] font-black ${risk.color}">${escapeHtml(risk.label)}</div>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-2">
      ${cardMetric("Open PnL", formatSignedCurrency(totalPnl), totalPnl >= 0 ? "text-long" : "text-short")}
      ${cardMetric("Margin", formatCurrency(totalMargin))}
      ${cardMetric("Lowest buffer", formatPercent(lowestBuffer), risk.color)}
    </div>
    <div class="mt-2 grid grid-cols-2 gap-2">
      ${cardMetric("Exposure", formatCurrency(totalExposure))}
      ${cardMetric("Avg leverage", `${formatAverageLeverage(totalExposure, totalMargin)}x`, "text-brand")}
    </div>
  </div>`;
}

function addMarginEditorMarkup(position: DerivedPosition, editor: AddMarginEditor, freeMargin: number): string {
  const maxAdd = maxMarginAdd(position, freeMargin);
  const requestedAmount = parseMoneyInput(editor.amountRaw);
  const safePreviewAmount = Math.min(maxAdd, Math.max(0, requestedAmount));
  const nextMargin = position.margin + safePreviewAmount;
  const nextLeverage = effectiveLeverage(position.notional, nextMargin);
  const nextLiqPrice = calculateLiquidationPrice(position.entryPrice, position.side, nextLeverage);
  const currentBuffer = liquidationBufferPct(position);
  const nextBuffer = liquidationBufferFromPrices(position.side, position.markPrice, nextLiqPrice);
  const disabledReason =
    freeMargin < 1
      ? "No free wallet margin available."
      : maxAdd < 1
        ? "Position is already near 1x margin."
        : requestedAmount < 1
          ? "Enter at least $1."
          : requestedAmount > maxAdd
            ? `Max add is ${formatCurrency(maxAdd)}.`
            : null;
  const presets = marginPresetAmounts(position, freeMargin);
  return `<div class="rounded-xl border border-brand/35 bg-[#0b0f13]/95 p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)]" data-add-margin-editor="${position.id}">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm font-black">Add isolated margin</div>
        <div class="mt-1 text-xs font-semibold text-secondary">Uses free wallet to lower effective leverage.</div>
      </div>
      <div class="rounded border border-brand/30 px-2 py-1 text-[10px] font-black text-brand">PREVIEW</div>
    </div>
    <label class="mt-3 grid gap-1">
      <span class="text-[10px] font-black uppercase text-secondary">Amount from wallet</span>
      <input class="h-11 w-full min-w-0 rounded-lg px-3 font-mono text-lg font-black" data-add-margin-input value="${escapeHtml(editor.amountRaw)}" placeholder="${escapeHtml(formatInputMoney(suggestedMarginAdd(position, freeMargin)))}" inputmode="decimal" />
    </label>
    <div class="mt-3 grid grid-cols-3 gap-2">
      ${presets
        .map((preset) => `<button class="chip !min-h-10" data-add-margin-preset="${escapeHtml(String(preset.amount))}" ${preset.amount < 1 ? "disabled" : ""}>${escapeHtml(preset.label)}</button>`)
        .join("")}
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
      ${cardMetric("Wallet free", formatCurrency(freeMargin), freeMargin >= requestedAmount ? "text-long" : "text-short")}
      ${cardMetric("Max add", formatCurrency(maxAdd), maxAdd >= 1 ? "text-brand" : "text-secondary")}
      ${cardMetric("Liq buffer", `${formatPercent(currentBuffer)} -> ${formatPercent(nextBuffer)}`, nextBuffer > currentBuffer ? "text-long" : "text-secondary")}
      ${cardMetric("Eff. leverage", `${formatLeverage(position.leverage)} -> ${formatLeverage(nextLeverage)}`, nextLeverage < position.leverage ? "text-long" : "text-secondary")}
    </div>
    ${
      disabledReason
        ? `<div class="mt-3 rounded-lg border border-short/35 bg-short/10 p-2 text-xs font-black text-short">${escapeHtml(disabledReason)}</div>`
        : `<div class="mt-3 rounded-lg border border-long/30 bg-long/5 p-2 text-xs font-bold text-secondary">Adding ${escapeHtml(formatCurrency(requestedAmount))} improves the liquidation gap without changing size.</div>`
    }
    <div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      <button class="btn btn-ghost !min-h-11 px-3" data-cancel-add-margin>Cancel</button>
      ${
        freeMargin < 1
          ? `<button class="btn btn-primary !min-h-11" data-open-deposit>Deposit funds</button>`
          : `<button class="btn btn-primary !min-h-11" data-confirm-add-margin="${position.id}" ${disabledReason ? "disabled" : ""}>Add margin</button>`
      }
    </div>
  </div>`;
}

function triggerEditorMarkup(position: DerivedPosition, editor: TriggerEditor): string {
  const { tpPrice, slPrice } = resolveTriggerPrices(editor);
  const issue = validatePositionTriggers(position.side, position.markPrice, tpPrice, slPrice);
  const hasTriggers = tpPrice !== null || slPrice !== null;
  const saveDisabled = issue ? "disabled" : "";
  return `<div class="rounded-xl border border-brand/35 bg-[#0b0f13]/95 p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)]" data-trigger-editor="${position.id}">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm font-black">Manage TP / SL</div>
        <div class="mt-1 text-xs font-semibold text-secondary">Entry ${escapeHtml(formatPrice(position.entryPrice))} - mark ${escapeHtml(formatPrice(position.markPrice))}</div>
      </div>
      <div class="rounded border border-brand/30 px-2 py-1 text-[10px] font-black text-brand">LIVE</div>
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2">
      <label class="grid min-w-0 gap-1">
        <span class="text-[10px] font-black uppercase text-secondary">Take profit</span>
        <input class="h-11 w-full min-w-0 rounded-lg px-3 font-mono text-sm" data-trigger-tp-input value="${escapeHtml(editor.tpRaw)}" placeholder="${escapeHtml(tpPlaceholder(position))}" inputmode="decimal" />
      </label>
      <label class="grid min-w-0 gap-1">
        <span class="text-[10px] font-black uppercase text-secondary">Stop loss</span>
        <input class="h-11 w-full min-w-0 rounded-lg px-3 font-mono text-sm" data-trigger-sl-input value="${escapeHtml(editor.slRaw)}" placeholder="${escapeHtml(slPlaceholder(position))}" inputmode="decimal" />
      </label>
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button class="chip !min-h-10" data-trigger-preset="tp">${escapeHtml(tpPresetLabel(position))}</button>
      <button class="chip !min-h-10" data-trigger-preset="sl">${escapeHtml(slPresetLabel(position))}</button>
    </div>
    ${positionTriggerStatusMarkup(position, tpPrice, slPrice, issue)}
    ${
      hasTriggers
        ? `<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            ${positionTriggerMetricMarkup(position, "Take profit", tpPrice)}
            ${positionTriggerMetricMarkup(position, "Stop loss", slPrice)}
          </div>`
        : ""
    }
    <div class="mt-3 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2">
      <button class="btn btn-ghost !min-h-11 px-3" data-clear-position-triggers>Clear</button>
      <button class="btn btn-ghost !min-h-11 px-3" data-cancel-triggers>Cancel</button>
      <button class="btn btn-primary !min-h-11" data-save-triggers ${saveDisabled}>${issue ? "Fix TP / SL" : "Save TP / SL"}</button>
    </div>
  </div>`;
}

function resolveTriggerPrices(editor: TriggerEditor): { tpPrice: number | null; slPrice: number | null } {
  return {
    tpPrice: parseOptionalPrice(editor.tpRaw),
    slPrice: parseOptionalPrice(editor.slRaw),
  };
}

function positionTriggerStatusMarkup(
  position: DerivedPosition,
  tpPrice: number | null,
  slPrice: number | null,
  issue: string | null,
): string {
  if (issue) {
    return `<div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-short/35 bg-short/10 p-2.5" data-position-trigger-status aria-live="polite">
      <div class="grid h-8 w-8 place-items-center rounded-md border border-short/30 bg-short/10 text-short">${icon("close")}</div>
      <div class="min-w-0">
        <div class="text-[10px] font-black uppercase text-short">Protection invalid</div>
        <div class="mt-0.5 text-[11px] font-semibold text-secondary">${escapeHtml(issue)}</div>
      </div>
    </div>`;
  }
  if (tpPrice !== null || slPrice !== null) {
    return `<div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-long/30 bg-long/5 p-2.5" data-position-trigger-status aria-live="polite">
      <div class="grid h-8 w-8 place-items-center rounded-md border border-long/30 bg-long/10 text-long">${icon("trade")}</div>
      <div class="min-w-0">
        <div class="text-[10px] font-black uppercase text-long">Protection armed</div>
        <div class="mt-0.5 truncate text-[11px] font-semibold text-secondary" title="${escapeHtml(positionTriggerSummary(position, tpPrice, slPrice))}">
          ${escapeHtml(positionTriggerSummary(position, tpPrice, slPrice))}
        </div>
      </div>
    </div>`;
  }
  return `<div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-line/80 bg-[#10151a] p-2.5" data-position-trigger-status aria-live="polite">
    <div class="grid h-8 w-8 place-items-center rounded-md border border-brand/25 bg-brand/10 text-brand">${icon("history")}</div>
    <div class="min-w-0">
      <div class="text-[10px] font-black uppercase text-secondary">Protection optional</div>
      <div class="mt-0.5 text-[11px] font-semibold text-secondary">${escapeHtml(position.side === "long" ? "For longs, TP must be above mark and SL below." : "For shorts, TP must be below mark and SL above.")}</div>
    </div>
  </div>`;
}

function positionTriggerMetricMarkup(
  position: DerivedPosition,
  label: string,
  triggerPrice: number | null,
): string {
  if (triggerPrice === null) {
    return cardMetric(label, "Not set", "text-secondary");
  }
  const pnl = estimatedTriggerPnl(position, triggerPrice);
  const roi = position.margin > 0 ? (pnl / position.margin) * 100 : 0;
  const distance = ((triggerPrice - position.markPrice) / position.markPrice) * 100;
  const value = `${formatSignedCurrency(pnl)} / ${formatSignedPercent(roi)}`;
  const helper = `${formatPrice(triggerPrice)} (${formatSignedPercent(distance)} from mark)`;
  const color = pnl >= 0 ? "text-long" : "text-short";
  return `<div class="rounded-lg border border-line/80 bg-[#10151a] p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono font-black ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
    <div class="mt-1 truncate text-[10px] font-semibold text-muted" title="${escapeHtml(helper)}">${escapeHtml(helper)}</div>
  </div>`;
}

function validatePositionTriggers(
  side: DerivedPosition["side"],
  markPrice: number,
  tpPrice: number | null,
  slPrice: number | null,
): string | null {
  if (tpPrice !== null && (!Number.isFinite(tpPrice) || tpPrice <= 0)) {
    return "Take-profit must be a positive price.";
  }
  if (slPrice !== null && (!Number.isFinite(slPrice) || slPrice <= 0)) {
    return "Stop-loss must be a positive price.";
  }
  if (tpPrice !== null && Number.isFinite(tpPrice)) {
    if (side === "long" && tpPrice <= markPrice) return "Take-profit must be above live mark for longs.";
    if (side === "short" && tpPrice >= markPrice) return "Take-profit must be below live mark for shorts.";
  }
  if (slPrice !== null && Number.isFinite(slPrice)) {
    if (side === "long" && slPrice >= markPrice) return "Stop-loss must be below live mark for longs.";
    if (side === "short" && slPrice <= markPrice) return "Stop-loss must be above live mark for shorts.";
  }
  return null;
}

function positionTriggerSummary(position: DerivedPosition, tpPrice: number | null, slPrice: number | null): string {
  const parts: string[] = [];
  if (tpPrice !== null) {
    const pnl = estimatedTriggerPnl(position, tpPrice);
    parts.push(`TP ${formatSignedCurrency(pnl)}`);
  }
  if (slPrice !== null) {
    const pnl = estimatedTriggerPnl(position, slPrice);
    parts.push(`SL ${formatSignedCurrency(pnl)}`);
  }
  return parts.join("; ");
}

function estimatedTriggerPnl(position: DerivedPosition, price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return position.side === "long"
    ? (price - position.entryPrice) * position.size
    : (position.entryPrice - price) * position.size;
}

function parseOptionalPrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number(trimmed.replace(/,/g, ""));
}

function triggerInputPrice(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toFixed(4);
  return value.toPrecision(6);
}

function tpPlaceholder(position: DerivedPosition): string {
  return triggerInputPrice(triggerPresetPrice(position, "tp"));
}

function slPlaceholder(position: DerivedPosition): string {
  return triggerInputPrice(triggerPresetPrice(position, "sl"));
}

function triggerPresetPrice(position: DerivedPosition, type: "tp" | "sl"): number {
  if (type === "tp") {
    return position.side === "long" ? position.markPrice * 1.01 : position.markPrice * 0.99;
  }
  return position.side === "long" ? position.markPrice * 0.995 : position.markPrice * 1.005;
}

function tpPresetLabel(position: DerivedPosition): string {
  return position.side === "long" ? "TP +1%" : "TP -1%";
}

function slPresetLabel(position: DerivedPosition): string {
  return position.side === "long" ? "SL -0.5%" : "SL +0.5%";
}

function maxMarginAdd(position: DerivedPosition, freeMargin: number): number {
  return Math.max(0, Math.min(freeMargin, position.notional - position.margin));
}

function suggestedMarginAdd(position: DerivedPosition, freeMargin: number): number {
  const maxAdd = maxMarginAdd(position, freeMargin);
  if (maxAdd < 1) return 0;
  return Math.min(maxAdd, Math.max(1, position.margin * 0.25));
}

function marginPresetAmounts(position: DerivedPosition, freeMargin: number): Array<{ label: string; amount: number }> {
  const maxAdd = maxMarginAdd(position, freeMargin);
  return [
    { label: "25%", amount: Math.min(maxAdd, position.margin * 0.25) },
    { label: "50%", amount: Math.min(maxAdd, position.margin * 0.5) },
    { label: "Max", amount: maxAdd },
  ];
}

function effectiveLeverage(notional: number, margin: number): number {
  if (!Number.isFinite(notional) || !Number.isFinite(margin) || margin <= 0) return 1;
  return Math.max(1, notional / margin);
}

function formatLeverage(value: number): string {
  if (!Number.isFinite(value)) return "0x";
  if (value >= 100) return `${value.toFixed(0)}x`;
  if (value >= 10) return `${value.toFixed(1)}x`;
  return `${value.toFixed(2)}x`;
}

function liquidationBufferPct(position: DerivedPosition): number {
  if (position.markPrice <= 0 || position.liqPrice <= 0) return 0;
  return liquidationBufferFromPrices(position.side, position.markPrice, position.liqPrice);
}

function liquidationBufferFromPrices(side: DerivedPosition["side"], markPrice: number, liqPrice: number): number {
  if (markPrice <= 0 || liqPrice <= 0) return 0;
  const gap = side === "long" ? markPrice - liqPrice : liqPrice - markPrice;
  return Math.max(0, (gap / markPrice) * 100);
}

function liquidationRisk(bufferPct: number): { label: string; color: string; barColor: string } {
  if (bufferPct <= 1.5) return { label: "Critical risk", color: "text-short", barColor: "var(--short)" };
  if (bufferPct <= 4) return { label: "Tight risk", color: "text-brand", barColor: "var(--brand)" };
  return { label: "Room to move", color: "text-long", barColor: "var(--long)" };
}

function riskBarWidth(bufferPct: number): number {
  return Math.max(6, Math.min(100, Math.round((bufferPct / 8) * 100)));
}

function formatAverageLeverage(totalExposure: number, totalMargin: number): string {
  if (!Number.isFinite(totalExposure) || !Number.isFinite(totalMargin) || totalMargin <= 0) return "0";
  const leverage = totalExposure / totalMargin;
  return leverage >= 100 ? leverage.toFixed(0) : leverage.toFixed(1);
}

function closeConfirmationMarkup(position: DerivedPosition, fraction: number): string {
  const safeFraction = Math.min(1, Math.max(0.1, fraction));
  const closePercent = Math.round(safeFraction * 100);
  const closeLabel = `${closePercent}%`;
  const estimatedPnl = position.unrealizedPnl * safeFraction;
  const marginReturned = position.margin * safeFraction;
  const closeNotional = position.notional * safeFraction;
  const closeSize = position.size * safeFraction;
  const closeFee = calculateFee(closeNotional);
  const estimatedCredit = marginReturned + estimatedPnl - closeFee;
  const remainingFraction = Math.max(0, 1 - safeFraction);
  const remainingMargin = position.margin * remainingFraction;
  const remainingNotional = position.notional * remainingFraction;
  const positive = estimatedPnl >= 0;
  const presets = [10, 25, 50, 75, 100];
  const closeDescription =
    safeFraction >= 1
      ? "Full market close. The position will leave the open book."
      : `${formatCurrency(remainingMargin)} margin and ${formatCurrency(remainingNotional)} exposure remain open.`;

  return `<div class="rounded-xl border border-brand/35 bg-[#0b0f13]/95 p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)]" data-close-confirmation aria-live="polite">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm font-black">Reduce / close position</div>
        <div class="mt-1 text-xs font-semibold text-secondary">Market close at current mark. PnL can move before confirm.</div>
      </div>
      <div class="rounded border border-brand/30 px-2 py-1 text-[10px] font-black text-brand">PREVIEW</div>
    </div>
    <div class="mt-3 rounded-xl border border-line/80 bg-[#10151a] p-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-[10px] font-black uppercase text-secondary">Close size</div>
          <div class="mt-1 text-xs font-semibold text-secondary">${escapeHtml(closeDescription)}</div>
        </div>
        <div class="font-mono text-2xl font-black text-primary">${escapeHtml(closeLabel)}</div>
      </div>
      <input
        class="close-size-slider mt-3"
        data-close-slider="${position.id}"
        aria-label="Close size percent"
        type="range"
        min="10"
        max="100"
        step="1"
        value="${closePercent}"
      />
      <div class="mt-3 grid grid-cols-5 gap-1.5">
        ${presets
          .map(
            (preset) =>
              `<button class="chip !min-h-9 !px-1 ${preset === closePercent ? "active" : ""}" data-close-size-position="${position.id}" data-close-size-preset="${preset}">${preset}%</button>`,
          )
          .join("")}
      </div>
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
      ${cardMetric("Close notional", formatCurrency(closeNotional), "text-primary")}
      ${cardMetric("Close size", formatSize(closeSize), "text-primary")}
      ${cardMetric("Est. PnL", formatSignedCurrency(estimatedPnl), positive ? "text-long" : "text-short")}
      ${cardMetric("Margin back", formatCurrency(marginReturned))}
      ${cardMetric("Close fee", formatCurrency(closeFee), "text-secondary")}
      ${cardMetric("Wallet credit", formatCurrency(estimatedCredit), estimatedCredit >= 0 ? "text-long" : "text-short")}
    </div>
    ${
      safeFraction < 1
        ? `<div class="mt-3 rounded-lg border border-line/80 bg-[#10151a] p-2 text-xs font-bold text-secondary">Remaining position keeps the same entry, leverage, TP / SL, and liquidation price.</div>`
        : `<div class="mt-3 rounded-lg border border-short/30 bg-short/10 p-2 text-xs font-black text-short">This closes the full position at market.</div>`
    }
    <div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      <button class="btn btn-ghost !min-h-11" data-cancel-close>Cancel</button>
      <button class="btn ${positive ? "btn-long" : "btn-short"} !min-h-11" data-confirm-close-position="${position.id}" data-close-fraction="${safeFraction}">
        Close ${escapeHtml(closeLabel)} at market
      </button>
    </div>
  </div>`;
}

function formatSize(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(value < 1 ? 6 : 3);
}

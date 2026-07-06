import { buildPosition, calculateFee, calculateLiquidationPrice, maxMarginForBalance } from "../engine/pnl";
import { deriveAccount } from "../store/selectors";
import type { OrderType, Side } from "../types";
import { formatCurrency, formatPercent, formatPrice } from "../util/format";
import { clamp, formatInputMoney, parseMoneyInput } from "../util/math";
import type { PlaceOrderInput, UIContext } from "./context";
import { escapeHtml, icon } from "./dom";

const leverageStops = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

export function mountOrderPanel(root: HTMLElement, ctx: UIContext): void {
  let margin = 100;
  let leverage = 25;
  let orderType: OrderType = "market";
  let limitRaw = "";
  let tpRaw = "";
  let slRaw = "";
  let advancedOpen = false;
  let reviewOpen = false;

  const render = () => {
    const state = ctx.store.get();
    const side = state.tradeSide;
    const derived = deriveAccount(state);
    const price = state.prices[state.selectedSymbol]?.price ?? 0;
    const parsedLimit = Number.parseFloat(limitRaw);
    const hasLimitPrice = Number.isFinite(parsedLimit) && parsedLimit > 0;
    const orderEntryPrice = orderType === "limit" && hasLimitPrice ? parsedLimit : price;
    const invalidLimit = orderType === "limit" && !hasLimitPrice;
    const limitDriftPct = price > 0 && hasLimitPrice ? ((parsedLimit - price) / price) * 100 : 0;
    const safeMargin = clamp(margin, 0, maxMarginForBalance(derived.freeMargin));
    const notional = safeMargin * leverage;
    const fee = calculateFee(notional);
    const closeFee = calculateFee(notional);
    const estimatedRoundTripFees = fee + closeFee;
    const cost = safeMargin + fee;
    const liq = orderEntryPrice > 0 ? calculateLiquidationPrice(orderEntryPrice, side, leverage) : 0;
    const liqBufferPct = liquidationBufferPct(price, liq);
    const risk = leverageRisk(leverage);
    const highLev = leverage >= 100;
    const walletUsePct = derived.equity > 0 ? (cost / derived.equity) * 100 : 0;
    const breakEvenMovePct = notional > 0 ? (estimatedRoundTripFees / notional) * 100 : 0;
    const breakEven = breakEvenPrice(orderEntryPrice, side, breakEvenMovePct);
    const parsedTp = parseOptionalPriceInput(tpRaw);
    const parsedSl = parseOptionalPriceInput(slRaw);
    const hasTp = parsedTp !== null && Number.isFinite(parsedTp);
    const hasSl = parsedSl !== null && Number.isFinite(parsedSl);
    const triggerIssue = validateOrderTriggers(side, orderEntryPrice, parsedTp, parsedSl);
    const tpMetricColor = triggerIssue?.startsWith("Take-profit") ? "text-short" : hasTp ? "text-long" : "text-secondary";
    const slMetricColor = triggerIssue?.startsWith("Stop-loss") ? "text-short" : hasSl ? "text-short" : "text-secondary";
    const sideLabel = side.toUpperCase();
    const orderTypeLabel = orderType === "limit" ? "Limit" : "Market";
    const readiness = orderReadiness({
      cost,
      freeMargin: derived.freeMargin,
      highLev,
      invalidLimit,
      limitDriftPct,
      orderType,
      price,
      safeMargin,
      triggerIssue,
      walletUsePct,
    });
    const disabled = readiness.disabled;
    const showReview = reviewOpen && readiness.action === "review";
    const ctaButtonClass = readiness.action === "deposit" ? "btn-primary" : side === "long" ? "btn-long" : "btn-short";
    const ctaActionAttr = readiness.action === "deposit" ? "data-open-deposit" : "data-place-order";

    root.innerHTML = `<section class="panel flex h-[calc(100dvh-220px)] min-w-0 flex-col overflow-hidden lg:h-full lg:min-h-[520px]">
      <div class="border-b border-line p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-black">Trade</h2>
            <div class="mt-1 text-xs font-semibold text-secondary">Wallet free: ${escapeHtml(formatCurrency(derived.freeMargin))}</div>
          </div>
          <button class="chip flex items-center gap-1 !px-2 text-brand" data-open-markets aria-label="Change market from ${escapeHtml(state.selectedSymbol)}">
            ${icon("markets")}
            <span>${escapeHtml(state.selectedSymbol)}</span>
          </button>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-auto p-4 pb-4">
        ${
          derived.freeMargin <= 0
            ? `<div class="rounded-xl border border-brand/30 bg-brand/10 p-4">
                <div class="text-lg font-black">No funds.</div>
                <div class="mt-1 text-sm font-semibold text-secondary">Time to gamble responsibly (or not).</div>
                <button class="btn btn-primary mt-4 w-full" data-open-deposit>Deposit</button>
              </div>`
            : ""
        }
        <div class="grid grid-cols-2 gap-2 ${derived.freeMargin <= 0 ? "mt-4 opacity-50" : ""}">
          <button class="btn !min-h-12 ${side === "long" ? "btn-long" : "btn-ghost"}" data-side="long">LONG</button>
          <button class="btn !min-h-12 ${side === "short" ? "btn-short" : "btn-ghost"}" data-side="short">SHORT</button>
        </div>
        <div class="mt-4 rounded-xl border border-line bg-[#0f1318] p-2.5">
          <div class="grid grid-cols-2 gap-1 rounded-lg border border-line/80 bg-[#0b0f13]/80 p-1" aria-label="Order type">
            ${orderTypeButton("market", orderType)}
            ${orderTypeButton("limit", orderType)}
          </div>
          ${
            orderType === "limit"
              ? `<div class="mt-3 grid gap-2">
                  <div class="flex items-end justify-between gap-3">
                    <label class="text-xs font-black uppercase text-secondary">Limit price</label>
                    <div class="font-mono text-[11px] font-black ${limitDriftPct === 0 ? "text-secondary" : limitDriftPct > 0 ? "text-long" : "text-short"}">${escapeHtml(hasLimitPrice ? signedPercent(limitDriftPct) : "Set price")}</div>
                  </div>
                  <input class="h-11 w-full rounded-lg px-3 font-mono text-lg font-black" data-limit-price value="${escapeHtml(limitRaw)}" placeholder="${escapeHtml(triggerInputPrice(price))}" inputmode="decimal" />
                  <div class="grid grid-cols-3 gap-2">
                    ${limitPresetButton("bid", limitPresetPrice(price, -0.1))}
                    ${limitPresetButton("mark", price)}
                    ${limitPresetButton("ask", limitPresetPrice(price, 0.1))}
                  </div>
                  ${invalidLimit ? `<div class="rounded-lg border border-short/35 bg-short/10 p-2 text-xs font-black text-short">Limit orders need a positive entry price.</div>` : ""}
                  <div class="text-[11px] font-semibold text-muted">Limit sim fills immediately at the selected entry so PnL, liquidation, and size use that price.</div>
                </div>`
              : `<div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-brand/25 bg-brand/10 p-2">
                  <div class="min-w-0">
                    <div class="text-xs font-black text-brand">Market execution</div>
                    <div class="mt-1 truncate text-[11px] font-semibold text-secondary">Instant synthetic fill at live mark.</div>
                  </div>
                  <div class="font-mono text-xs font-black text-primary">${escapeHtml(formatPrice(price))}</div>
                </div>`
          }
        </div>
        <label class="mt-5 block text-xs font-black uppercase text-secondary">USD margin</label>
        <input class="mt-2 h-12 w-full rounded-lg px-3 font-mono text-2xl font-black" data-margin value="${escapeHtml(formatInputMoney(margin))}" inputmode="decimal" ${derived.freeMargin <= 0 ? "disabled" : ""} />
        <div class="mt-3 grid grid-cols-4 gap-2">
          ${[25, 50, 75, 100]
            .map((pct) => `<button class="chip" data-margin-pct="${pct}">${pct === 100 ? "MAX" : `${pct}%`}</button>`)
            .join("")}
        </div>
        <div class="mt-5 flex items-center justify-between">
          <label class="text-xs font-black uppercase text-secondary">Leverage</label>
          <div class="font-mono text-2xl font-black ${highLev ? "text-short" : "text-brand"}">${leverage}x</div>
        </div>
        <input class="mt-2 h-3 w-full accent-brand" data-leverage type="range" min="1" max="1000" step="1" value="${leverage}" style="background: linear-gradient(90deg, #0ECB81, #F0B90B, #F6465D);" />
        <div class="scroll-rail mt-2 flex min-w-0 max-w-full gap-1 overflow-x-auto pb-1">
          ${leverageStops.map((stop) => leverageStopButton(stop, leverage)).join("")}
        </div>
        <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border ${risk.border} ${risk.bg} p-3">
          <div class="min-w-0">
            <div class="text-xs font-black ${risk.text}">${risk.label}</div>
            <div class="mt-1 text-[11px] font-semibold text-secondary">Estimated liquidation buffer</div>
          </div>
          <div class="font-mono text-lg font-black ${risk.text}">${escapeHtml(liqBufferPct > 0 ? `${liqBufferPct.toFixed(2)}%` : "--")}</div>
        </div>
        ${highLev ? `<div class="mt-2 rounded-lg border border-short/35 bg-short/10 p-3 text-xs font-black text-short">Extreme leverage leaves almost no room before liquidation.</div>` : ""}
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${impactMetric("Wallet used", formatPercent(walletUsePct), "text-brand", `Max debit ${formatCurrency(cost)}`)}
          ${impactMetric("Breakeven", breakEvenMoveLabel(side, breakEvenMovePct), side === "long" ? "text-long" : "text-short", formatPrice(breakEven))}
        </div>
        <div class="mt-5 grid grid-cols-2 gap-2 text-xs">
          ${miniMetric("TP", hasTp ? formatPrice(parsedTp) : "Not set", tpMetricColor)}
          ${miniMetric("SL", hasSl ? formatPrice(parsedSl) : "Not set", slMetricColor)}
        </div>
        <div class="mt-3 rounded-xl border border-line bg-[#0f1318]">
          <button class="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left" data-toggle-advanced>
            <span>
              <span class="block text-sm font-black">TP / SL risk controls</span>
              <span class="mt-1 block text-xs font-semibold text-secondary">${hasTp || hasSl ? "Triggers armed for this order." : "Optional, quick presets available."}</span>
            </span>
            <span class="font-mono text-lg font-black text-brand">${advancedOpen ? "-" : "+"}</span>
          </button>
          ${
            advancedOpen
              ? `<div class="border-t border-line p-4">
                  <div class="grid grid-cols-2 gap-2">
                    <button class="chip" data-trigger-preset="tp">${escapeHtml(tpPresetLabel(side))}</button>
                    <button class="chip" data-trigger-preset="sl">${escapeHtml(slPresetLabel(side))}</button>
                  </div>
                  ${triggerStatusMarkup({
                    entryPrice: orderEntryPrice,
                    issue: triggerIssue,
                    side,
                    slPrice: hasSl ? parsedSl : null,
                    tpPrice: hasTp ? parsedTp : null,
                  })}
                  <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label class="grid gap-2">
                      <span class="text-xs font-black uppercase text-secondary">TP price</span>
                      <input class="h-11 rounded-lg px-3 font-mono text-sm" data-tp value="${escapeHtml(tpRaw)}" placeholder="${escapeHtml(triggerInputPrice(side === "long" ? orderEntryPrice * 1.01 : orderEntryPrice * 0.99))}" inputmode="decimal" />
                    </label>
                    <label class="grid gap-2">
                      <span class="text-xs font-black uppercase text-secondary">SL price</span>
                      <input class="h-11 rounded-lg px-3 font-mono text-sm" data-sl value="${escapeHtml(slRaw)}" placeholder="${escapeHtml(triggerInputPrice(side === "long" ? orderEntryPrice * 0.995 : orderEntryPrice * 1.005))}" inputmode="decimal" />
                    </label>
                  </div>
                  <button class="btn btn-ghost mt-3 w-full !min-h-11" data-clear-triggers>Clear TP / SL</button>
                </div>`
              : ""
          }
        </div>
        <div class="mt-5 grid gap-2 rounded-xl border border-line bg-[#0f1318] p-4 text-sm">
          ${metric(orderType === "limit" ? "Limit entry" : "Market est.", formatPrice(orderEntryPrice))}
          ${metric("Notional", formatCurrency(notional))}
          ${metric("Position size", `${formatSize(orderEntryPrice > 0 ? notional / orderEntryPrice : 0)} units`)}
          ${metric("Open cost", formatCurrency(cost))}
          ${metric("Fees est.", formatCurrency(estimatedRoundTripFees), "text-secondary")}
          ${metric("Wallet used", formatPercent(walletUsePct), "text-brand")}
          ${metric("Breakeven", `${breakEvenMoveLabel(side, breakEvenMovePct)} / ${formatPrice(breakEven)}`, side === "long" ? "text-long" : "text-short")}
          ${metric("Liquidation", formatPrice(liq), "text-short")}
        </div>
      </div>
      <div class="sticky bottom-0 border-t border-line bg-[#11161b]/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur lg:pb-3">
        ${
          showReview
            ? `<div class="grid gap-3 rounded-xl border border-brand/35 bg-[#0b0f13] p-3 shadow-[0_-12px_30px_rgba(0,0,0,0.24)]" data-order-review>
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-sm font-black">Review ${orderTypeLabel.toLowerCase()} ${sideLabel}</div>
                    <div class="mt-1 text-xs font-semibold text-secondary">
                      ${orderType === "limit" ? `Limit sim entry ${escapeHtml(formatPrice(orderEntryPrice))}` : `${side === "long" ? "Long" : "Short"} ${escapeHtml(state.selectedSymbol)} at live mark`}
                    </div>
                  </div>
                  <div class="rounded-md bg-brand/10 px-2 py-1 font-mono text-sm font-black ${highLev ? "text-short" : "text-brand"}">${leverage}x</div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  ${reviewMetric("Type", orderType === "limit" ? "Limit sim" : "Market")}
                  ${reviewMetric("Entry", formatPrice(orderEntryPrice), orderType === "limit" ? "text-brand" : "text-primary")}
                  ${reviewMetric("Margin", formatCurrency(safeMargin))}
                  ${reviewMetric("Open fee", formatCurrency(fee))}
                  ${reviewMetric("Max debit", formatCurrency(cost))}
                  ${reviewMetric("Fees est.", formatCurrency(estimatedRoundTripFees), "text-secondary")}
                  ${reviewMetric("Wallet used", formatPercent(walletUsePct), "text-brand")}
                  ${reviewMetric("Breakeven", `${breakEvenMoveLabel(side, breakEvenMovePct)} / ${formatPrice(breakEven)}`, side === "long" ? "text-long" : "text-short")}
                  ${reviewMetric("Liquidation", formatPrice(liq), "text-short")}
                  ${reviewMetric("Take profit", hasTp ? formatPrice(parsedTp) : "Off", hasTp ? "text-long" : "text-secondary")}
                  ${reviewMetric("Stop loss", hasSl ? formatPrice(parsedSl) : "Off", hasSl ? "text-short" : "text-secondary")}
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <button class="btn btn-ghost !min-h-11" data-cancel-order-review>Cancel</button>
                  <button class="btn ${side === "long" ? "btn-long" : "btn-short"} !min-h-11" data-confirm-order>Open ${sideLabel}</button>
                </div>
              </div>`
            : `<div class="mb-2 grid grid-cols-3 gap-1" data-order-sticky-impact>
                ${footerImpact("Wallet", formatPercent(walletUsePct), "text-brand")}
                ${footerImpact("BE", breakEvenMoveLabel(side, breakEvenMovePct), side === "long" ? "text-long" : "text-short")}
                ${footerImpact("Liq gap", liqBufferPct > 0 ? `${liqBufferPct.toFixed(2)}%` : "--", risk.text)}
              </div>
              ${readinessStrip(readiness)}
              <button class="btn ${ctaButtonClass} h-12 w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-base" ${ctaActionAttr} ${disabled ? "disabled" : ""}>
                ${escapeHtml(readiness.action === "review" ? `Review ${orderTypeLabel.toLowerCase()} ${side === "long" ? "long" : "short"}` : readiness.buttonLabel)}
              </button>`
        }
        <div class="mt-2 text-center text-[11px] font-semibold text-muted">${escapeHtml(formatCurrency(cost))} max debit. Close fee estimated.</div>
      </div>
    </section>`;
  };

  const buildOrderInput = (): PlaceOrderInput => {
    const currentState = ctx.store.get();
    const tpPrice = parseOptionalPriceInput(tpRaw);
    const slPrice = parseOptionalPriceInput(slRaw);
    return {
      symbol: currentState.selectedSymbol,
      side: currentState.tradeSide,
      orderType,
      margin,
      leverage,
      limitPrice: orderType === "limit" && Number.isFinite(Number.parseFloat(limitRaw)) ? Number.parseFloat(limitRaw) : null,
      tpPrice: tpPrice !== null && Number.isFinite(tpPrice) ? tpPrice : null,
      slPrice: slPrice !== null && Number.isFinite(slPrice) ? slPrice : null,
    };
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const sideButton = target.closest<HTMLElement>("[data-side]");
    const orderTypeTarget = target.closest<HTMLElement>("[data-order-type]");
    const limitPreset = target.closest<HTMLElement>("[data-limit-preset]");
    const marginButton = target.closest<HTMLElement>("[data-margin-pct]");
    const levButton = target.closest<HTMLElement>("[data-lev-stop]");
    const triggerPreset = target.closest<HTMLElement>("[data-trigger-preset]");
    if (target.closest("[data-open-deposit]")) {
      reviewOpen = false;
      ctx.actions.openTopup();
    }
    if (target.closest("[data-open-markets]")) {
      reviewOpen = false;
      ctx.actions.setMobileTab("markets");
    }
    if (target.closest("[data-toggle-advanced]")) {
      advancedOpen = !advancedOpen;
      render();
    }
    if (sideButton) {
      reviewOpen = false;
      ctx.actions.setTradeSide(sideButton.dataset.side as Side);
    }
    if (orderTypeTarget) {
      reviewOpen = false;
      orderType = orderTypeTarget.dataset.orderType as OrderType;
      if (orderType === "limit" && !limitRaw) {
        const mark = ctx.store.get().prices[ctx.store.get().selectedSymbol]?.price ?? 0;
        limitRaw = triggerInputPrice(mark);
      }
      render();
    }
    if (limitPreset) {
      reviewOpen = false;
      limitRaw = triggerInputPrice(Number(limitPreset.dataset.limitPresetPrice ?? 0));
      render();
    }
    if (marginButton) {
      reviewOpen = false;
      const pct = Number(marginButton.dataset.marginPct ?? 25) / 100;
      margin = maxMarginForBalance(deriveAccount(ctx.store.get()).freeMargin) * pct;
      render();
    }
    if (levButton) {
      reviewOpen = false;
      leverage = Number(levButton.dataset.levStop ?? leverage);
      render();
    }
    if (triggerPreset) {
      reviewOpen = false;
      const currentState = ctx.store.get();
      const mark = currentState.prices[currentState.selectedSymbol]?.price ?? 0;
      const currentSide = currentState.tradeSide;
      const preset = triggerPreset.dataset.triggerPreset;
      if (mark > 0 && preset === "tp") {
        tpRaw = triggerInputPrice(currentSide === "long" ? mark * 1.01 : mark * 0.99);
      }
      if (mark > 0 && preset === "sl") {
        slRaw = triggerInputPrice(currentSide === "long" ? mark * 0.995 : mark * 1.005);
      }
      render();
    }
    if (target.closest("[data-clear-triggers]")) {
      reviewOpen = false;
      tpRaw = "";
      slRaw = "";
      render();
    }
    if (target.closest("[data-place-order]")) {
      reviewOpen = true;
      render();
    }
    if (target.closest("[data-cancel-order-review]")) {
      reviewOpen = false;
      render();
    }
    if (target.closest("[data-confirm-order]")) {
      const input = buildOrderInput();
      reviewOpen = false;
      render();
      ctx.actions.placeOrder(input);
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    reviewOpen = false;
    if (target.matches("[data-margin]")) margin = parseMoneyInput(target.value);
    if (target.matches("[data-limit-price]")) limitRaw = target.value;
    if (target.matches("[data-leverage]")) leverage = Number(target.value);
    if (target.matches("[data-tp]")) tpRaw = target.value;
    if (target.matches("[data-sl]")) slRaw = target.value;
    render();
  });

  ctx.store.subscribe(render);
}

function metric(label: string, value: string, color = "text-primary"): string {
  return `<div class="flex items-center justify-between gap-3">
    <span class="text-xs font-bold text-secondary">${label}</span>
    <span class="font-mono text-sm font-black ${color}">${escapeHtml(value)}</span>
  </div>`;
}

function miniMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono text-xs font-black ${color}">${escapeHtml(value)}</div>
  </div>`;
}

function impactMetric(label: string, value: string, color: string, helper: string): string {
  return `<div class="min-w-0 rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono text-sm font-black ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
    <div class="mt-1 truncate text-[10px] font-semibold text-muted" title="${escapeHtml(helper)}">${escapeHtml(helper)}</div>
  </div>`;
}

function reviewMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="rounded-lg border border-line/70 bg-[#11161b] p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${label}</div>
    <div class="mt-1 truncate font-mono text-xs font-black ${color}">${escapeHtml(value)}</div>
  </div>`;
}

function footerImpact(label: string, value: string, color: string): string {
  return `<div class="min-w-0 rounded-md border border-line/80 bg-[#0b0f13] px-1.5 py-1 text-center">
    <div class="truncate text-[9px] font-black uppercase leading-none text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono text-[11px] font-black leading-none ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

function triggerStatusMarkup(input: {
  entryPrice: number;
  issue: string | null;
  side: Side;
  slPrice: number | null;
  tpPrice: number | null;
}): string {
  if (input.issue) {
    return `<div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-short/35 bg-short/10 p-2.5" data-trigger-status>
      <div class="grid h-8 w-8 place-items-center rounded-md border border-short/30 bg-short/10 text-short">${icon("close")}</div>
      <div class="min-w-0">
        <div class="text-[10px] font-black uppercase text-short">Fix protection</div>
        <div class="mt-0.5 text-[11px] font-semibold text-secondary">${escapeHtml(input.issue)}</div>
      </div>
    </div>`;
  }

  if (input.tpPrice !== null || input.slPrice !== null) {
    return `<div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-long/30 bg-long/5 p-2.5" data-trigger-status>
      <div class="grid h-8 w-8 place-items-center rounded-md border border-long/30 bg-long/10 text-long">${icon("trade")}</div>
      <div class="min-w-0">
        <div class="text-[10px] font-black uppercase text-long">Protection armed</div>
        <div class="mt-0.5 truncate text-[11px] font-semibold text-secondary" title="${escapeHtml(triggerDistanceSummary(input.entryPrice, input.tpPrice, input.slPrice))}">
          ${escapeHtml(triggerDistanceSummary(input.entryPrice, input.tpPrice, input.slPrice))}
        </div>
      </div>
    </div>`;
  }

  return `<div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2.5" data-trigger-status>
    <div class="grid h-8 w-8 place-items-center rounded-md border border-brand/25 bg-brand/10 text-brand">${icon("history")}</div>
    <div class="min-w-0">
      <div class="text-[10px] font-black uppercase text-secondary">Protection optional</div>
      <div class="mt-0.5 text-[11px] font-semibold text-secondary">${escapeHtml(
        input.side === "long" ? "For longs, TP sits above entry and SL below." : "For shorts, TP sits below entry and SL above.",
      )}</div>
    </div>
  </div>`;
}

type OrderReadiness = {
  action: "blocked" | "deposit" | "review";
  buttonLabel: string;
  detail: string;
  disabled: boolean;
  icon: Parameters<typeof icon>[0];
  iconClass: string;
  label: string;
  labelClass: string;
  stripClass: string;
};

function readinessStrip(readiness: OrderReadiness): string {
  return `<div class="mb-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2.5 py-2 ${readiness.stripClass}" data-order-readiness aria-live="polite">
    <div class="grid h-8 w-8 place-items-center rounded-md border ${readiness.iconClass}">
      ${icon(readiness.icon)}
    </div>
    <div class="min-w-0">
      <div class="text-[10px] font-black uppercase ${readiness.labelClass}">${escapeHtml(readiness.label)}</div>
      <div class="mt-0.5 truncate text-[11px] font-semibold text-secondary" title="${escapeHtml(readiness.detail)}">${escapeHtml(readiness.detail)}</div>
    </div>
  </div>`;
}

function orderReadiness(input: {
  cost: number;
  freeMargin: number;
  highLev: boolean;
  invalidLimit: boolean;
  limitDriftPct: number;
  orderType: OrderType;
  price: number;
  safeMargin: number;
  triggerIssue: string | null;
  walletUsePct: number;
}): OrderReadiness {
  const blocked = {
    action: "blocked" as const,
    disabled: true,
    icon: "close" as const,
    iconClass: "border-short/30 bg-short/10 text-short",
    labelClass: "text-short",
    stripClass: "border-short/35 bg-short/10",
  };
  const warning = {
    action: "review" as const,
    disabled: false,
    icon: "history" as const,
    iconClass: "border-brand/30 bg-brand/10 text-brand",
    labelClass: "text-brand",
    stripClass: "border-brand/35 bg-brand/10",
  };
  const ready = {
    action: "review" as const,
    disabled: false,
    icon: "trade" as const,
    iconClass: "border-long/30 bg-long/10 text-long",
    labelClass: "text-long",
    stripClass: "border-long/30 bg-long/5",
  };

  if (!Number.isFinite(input.price) || input.price <= 0) {
    return {
      ...blocked,
      buttonLabel: "Waiting for price",
      detail: "Live mark must load before review.",
      label: "Price unavailable",
    };
  }
  if (input.freeMargin <= 0) {
    return {
      action: "deposit",
      disabled: false,
      icon: "deposit",
      iconClass: "border-brand/30 bg-brand/10 text-brand",
      labelClass: "text-brand",
      stripClass: "border-brand/35 bg-brand/10",
      buttonLabel: "Deposit funds",
      detail: "Add simulated funds before opening a position.",
      label: "Funding required",
    };
  }
  if (input.invalidLimit) {
    return {
      ...blocked,
      buttonLabel: "Set limit price",
      detail: "Enter a positive entry or use BID, MARK, ASK.",
      label: "Limit price missing",
    };
  }
  if (input.triggerIssue) {
    return {
      ...blocked,
      buttonLabel: "Fix TP / SL",
      detail: input.triggerIssue,
      label: "Protection invalid",
    };
  }
  if (input.safeMargin < 1) {
    return {
      ...blocked,
      buttonLabel: "Enter margin",
      detail: "Minimum margin is $1.",
      label: "Margin too low",
    };
  }
  if (input.cost > input.freeMargin) {
    return {
      ...blocked,
      buttonLabel: "Reduce margin",
      detail: `${formatCurrency(input.cost)} needed; ${formatCurrency(input.freeMargin)} free.`,
      label: "Not enough free margin",
    };
  }
  if (input.highLev) {
    return {
      ...warning,
      buttonLabel: "Review order",
      detail: "Extreme leverage can liquidate on a tiny move.",
      label: "High risk ticket",
    };
  }
  if (input.walletUsePct >= 50) {
    return {
      ...warning,
      buttonLabel: "Review order",
      detail: `${formatPercent(input.walletUsePct)} of equity will be committed.`,
      label: "Large wallet use",
    };
  }
  if (input.orderType === "limit" && Math.abs(input.limitDriftPct) >= 2) {
    return {
      ...warning,
      buttonLabel: "Review order",
      detail: `Entry is ${signedPercent(input.limitDriftPct)} from live mark.`,
      label: "Limit away from mark",
    };
  }
  return {
    ...ready,
    buttonLabel: "Review order",
    detail: `${formatCurrency(input.cost)} max debit; ${formatPercent(input.walletUsePct)} wallet use.`,
    label: "Ready to review",
  };
}

function orderTypeButton(type: OrderType, currentType: OrderType): string {
  const active = type === currentType;
  return `<button class="min-h-10 rounded-md border px-2 text-xs font-black transition ${
    active
      ? "border-brand bg-brand text-[#0b0e11] shadow-[0_8px_18px_rgba(240,185,11,0.16)]"
      : "border-transparent bg-[#11161b] text-secondary hover:border-brand/45 hover:text-brand"
  }" data-order-type="${type}" aria-pressed="${active ? "true" : "false"}">${type === "market" ? "Market" : "Limit"}</button>`;
}

function limitPresetButton(label: string, price: number): string {
  return `<button class="chip min-w-0 !px-2" data-limit-preset="${escapeHtml(label)}" data-limit-preset-price="${escapeHtml(String(price))}">
    <span class="block truncate">${escapeHtml(label.toUpperCase())}</span>
  </button>`;
}

function limitPresetPrice(markPrice: number, movePct: number): number {
  if (!Number.isFinite(markPrice) || markPrice <= 0) return 0;
  return markPrice * (1 + movePct / 100);
}

function signedPercent(value: number): string {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value) < 0.005) return formatPercent(0);
  return `${value > 0 ? "+" : "-"}${formatPercent(Math.abs(value))}`;
}

function parseOptionalPriceInput(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, "");
  if (!normalized) return null;
  return Number(normalized);
}

function validateOrderTriggers(
  side: Side,
  entryPrice: number,
  tpPrice: number | null,
  slPrice: number | null,
): string | null {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  if (tpPrice !== null && (!Number.isFinite(tpPrice) || tpPrice <= 0)) {
    return "Take-profit must be a positive price.";
  }
  if (slPrice !== null && (!Number.isFinite(slPrice) || slPrice <= 0)) {
    return "Stop-loss must be a positive price.";
  }
  if (tpPrice !== null && Number.isFinite(tpPrice)) {
    if (side === "long" && tpPrice <= entryPrice) return "Take-profit must be above entry for longs.";
    if (side === "short" && tpPrice >= entryPrice) return "Take-profit must be below entry for shorts.";
  }
  if (slPrice !== null && Number.isFinite(slPrice)) {
    if (side === "long" && slPrice >= entryPrice) return "Stop-loss must be below entry for longs.";
    if (side === "short" && slPrice <= entryPrice) return "Stop-loss must be above entry for shorts.";
  }
  return null;
}

function triggerDistanceSummary(entryPrice: number, tpPrice: number | null, slPrice: number | null): string {
  const parts: string[] = [];
  if (tpPrice !== null && Number.isFinite(tpPrice)) {
    parts.push(`TP ${signedPercent(((tpPrice - entryPrice) / entryPrice) * 100)} from entry`);
  }
  if (slPrice !== null && Number.isFinite(slPrice)) {
    parts.push(`SL ${signedPercent(((slPrice - entryPrice) / entryPrice) * 100)} from entry`);
  }
  return parts.length > 0 ? parts.join("; ") : "No TP / SL attached.";
}

function tpPresetLabel(side: Side): string {
  return side === "long" ? "TP +1%" : "TP -1%";
}

function slPresetLabel(side: Side): string {
  return side === "long" ? "SL -0.5%" : "SL +0.5%";
}

function leverageStopButton(stop: number, currentLeverage: number): string {
  const active = stop === currentLeverage;
  return `<button class="chip shrink-0 ${active ? "active" : ""}" data-lev-stop="${stop}" aria-pressed="${active ? "true" : "false"}">${stop}x</button>`;
}

function leverageRisk(leverage: number): { label: string; border: string; bg: string; text: string } {
  if (leverage >= 100) {
    return { label: "Extreme leverage", border: "border-short/35", bg: "bg-short/10", text: "text-short" };
  }
  if (leverage >= 50) {
    return { label: "High leverage", border: "border-brand/35", bg: "bg-brand/10", text: "text-brand" };
  }
  if (leverage >= 25) {
    return { label: "Active leverage", border: "border-brand/30", bg: "bg-brand/5", text: "text-brand" };
  }
  return { label: "Lower leverage", border: "border-long/30", bg: "bg-long/5", text: "text-long" };
}

function liquidationBufferPct(markPrice: number, liqPrice: number): number {
  if (!Number.isFinite(markPrice) || !Number.isFinite(liqPrice) || markPrice <= 0 || liqPrice <= 0) return 0;
  return Math.abs((markPrice - liqPrice) / markPrice) * 100;
}

function breakEvenPrice(markPrice: number, side: Side, movePct: number): number {
  if (!Number.isFinite(markPrice) || markPrice <= 0 || !Number.isFinite(movePct)) return 0;
  const direction = side === "long" ? 1 : -1;
  return Math.max(0.00000001, markPrice * (1 + direction * (movePct / 100)));
}

function breakEvenMoveLabel(side: Side, movePct: number): string {
  const sign = side === "long" ? "+" : "-";
  return `${sign}${formatPercent(Math.abs(movePct))}`;
}

function triggerInputPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toFixed(4);
  if (value >= 0.01) return value.toFixed(6);
  return value.toPrecision(4);
}

function formatSize(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(value < 1 ? 6 : 3);
}

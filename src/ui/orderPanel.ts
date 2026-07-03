import { buildPosition, calculateFee, calculateLiquidationPrice, maxMarginForBalance } from "../engine/pnl";
import { deriveAccount } from "../store/selectors";
import type { Side } from "../types";
import { formatCurrency, formatPrice } from "../util/format";
import { clamp, formatInputMoney, parseMoneyInput } from "../util/math";
import type { UIContext } from "./context";
import { escapeHtml } from "./dom";

const leverageStops = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

export function mountOrderPanel(root: HTMLElement, ctx: UIContext): void {
  let margin = 100;
  let leverage = 100;
  let tpRaw = "";
  let slRaw = "";

  const render = () => {
    const state = ctx.store.get();
    const side = state.tradeSide;
    const derived = deriveAccount(state);
    const price = state.prices[state.selectedSymbol]?.price ?? 0;
    const safeMargin = clamp(margin, 0, maxMarginForBalance(derived.freeMargin));
    const notional = safeMargin * leverage;
    const fee = calculateFee(notional);
    const liq = price > 0 ? calculateLiquidationPrice(price, side, leverage) : 0;
    const disabled = derived.freeMargin <= 0 || safeMargin < 1 || fee + safeMargin > derived.freeMargin;
    const highLev = leverage >= 100;

    root.innerHTML = `<section class="panel flex min-h-[calc(100dvh-164px)] flex-col overflow-hidden lg:h-full lg:min-h-[520px]">
      <div class="border-b border-line p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-black">Trade</h2>
            <div class="mt-1 text-xs font-semibold text-secondary">Wallet free: ${escapeHtml(formatCurrency(derived.freeMargin))}</div>
          </div>
          <span class="text-xs font-black text-brand">${escapeHtml(state.selectedSymbol)}</span>
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
        <div class="mt-2 flex flex-wrap gap-1">
          ${leverageStops.map((stop) => `<button class="chip" data-lev-stop="${stop}">${stop}x</button>`).join("")}
        </div>
        ${highLev ? `<div class="mt-3 rounded-lg border border-short/35 bg-short/10 p-3 text-xs font-black text-short">Warning: ${leverage}x - one tick can rek you.</div>` : ""}
        <div class="mt-5 grid gap-2 rounded-xl border border-line bg-[#0f1318] p-4 text-sm">
          ${metric("Entry", formatPrice(price))}
          ${metric("Notional", formatCurrency(notional))}
          ${metric("Position size", `${formatSize(price > 0 ? notional / price : 0)} units`)}
          ${metric("Est. fee", formatCurrency(fee))}
          ${metric("Liquidation", formatPrice(liq), "text-short")}
        </div>
        <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase text-secondary">TP price</span>
            <input class="h-10 rounded-lg px-3 font-mono text-sm" data-tp value="${escapeHtml(tpRaw)}" placeholder="Optional" />
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase text-secondary">SL price</span>
            <input class="h-10 rounded-lg px-3 font-mono text-sm" data-sl value="${escapeHtml(slRaw)}" placeholder="Optional" />
          </label>
        </div>
      </div>
      <div class="sticky bottom-0 border-t border-line bg-[#11161b]/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur lg:pb-3">
        <button class="btn ${side === "long" ? "btn-long" : "btn-short"} h-12 w-full text-base" data-place-order ${disabled ? "disabled" : ""}>
          ${side === "long" ? "Long" : "Short"} ${escapeHtml(state.selectedSymbol)} - ${escapeHtml(formatCurrency(safeMargin))} - ${leverage}x
        </button>
        <div class="mt-2 text-center text-[11px] font-semibold text-muted">Fee included. Simulation only.</div>
      </div>
    </section>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const sideButton = target.closest<HTMLElement>("[data-side]");
    const marginButton = target.closest<HTMLElement>("[data-margin-pct]");
    const levButton = target.closest<HTMLElement>("[data-lev-stop]");
    if (target.closest("[data-open-deposit]")) ctx.actions.openTopup();
    if (sideButton) {
      ctx.actions.setTradeSide(sideButton.dataset.side as Side);
    }
    if (marginButton) {
      const pct = Number(marginButton.dataset.marginPct ?? 25) / 100;
      margin = maxMarginForBalance(deriveAccount(ctx.store.get()).freeMargin) * pct;
      render();
    }
    if (levButton) {
      leverage = Number(levButton.dataset.levStop ?? leverage);
      render();
    }
    if (target.closest("[data-place-order]")) {
      const currentState = ctx.store.get();
      const tpPrice = Number.parseFloat(tpRaw);
      const slPrice = Number.parseFloat(slRaw);
      ctx.actions.placeOrder({
        symbol: currentState.selectedSymbol,
        side: currentState.tradeSide,
        margin,
        leverage,
        tpPrice: Number.isFinite(tpPrice) ? tpPrice : null,
        slPrice: Number.isFinite(slPrice) ? slPrice : null,
      });
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches("[data-margin]")) margin = parseMoneyInput(target.value);
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

function formatSize(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(value < 1 ? 6 : 3);
}

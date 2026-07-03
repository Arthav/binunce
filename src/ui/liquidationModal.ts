import type { UIContext } from "./context";
import { icon } from "./dom";
import { shareCardMarkup } from "./shareCard";
import { formatSignedCurrency, formatSignedPercent } from "../util/format";

export function mountLiquidationModal(root: HTMLElement, ctx: UIContext): void {
  const render = () => {
    const trade = ctx.store.get().liquidationTrade;
    if (!trade) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = `<div class="modal-backdrop">
      <div class="modal-panel w-[min(860px,100%)] border-short/50">
        <div class="grid gap-5 p-5 pb-[calc(20px+env(safe-area-inset-bottom))] md:grid-cols-[1fr_380px] md:pb-5">
          <div class="rounded-xl border border-short/40 bg-short/10 p-5">
            <div class="flex items-start justify-between">
              <div>
                <div class="text-sm font-black uppercase text-short">Liquidated</div>
                <div class="mt-2 text-7xl font-black leading-none text-short">REKT</div>
              </div>
              <button class="btn btn-ghost grid !h-9 !w-9 place-items-center !p-0" data-close-liquidation aria-label="Close liquidation modal">${icon("close")}</button>
            </div>
            <div class="mt-8 font-mono text-5xl font-black text-short">${formatSignedCurrency(trade.pnl)}</div>
            <div class="mt-3 font-mono text-3xl font-black text-short">${formatSignedPercent(trade.roiPct)}</div>
            <div class="mt-6 text-lg font-black">The full margin is gone. 1000x does not forgive.</div>
            <div class="mt-2 text-sm font-semibold text-secondary">Recorded as a simulated liquidation. No real funds were touched.</div>
            <button class="btn btn-short mt-8" data-close-liquidation>Back to terminal</button>
          </div>
          <div class="grid place-items-center overflow-hidden">${shareCardMarkup(trade)}</div>
        </div>
      </div>
    </div>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-close-liquidation]")) ctx.actions.closeLiquidation();
  });

  ctx.store.subscribe(render);
}

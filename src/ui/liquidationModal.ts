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
        <div class="grid min-w-0 gap-4 p-3 pb-[calc(16px+env(safe-area-inset-bottom))] sm:gap-5 sm:p-5 sm:pb-[calc(20px+env(safe-area-inset-bottom))] md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:pb-5">
          <div class="min-w-0 rounded-xl border border-short/40 bg-short/10 p-4 sm:p-5">
            <div class="flex min-w-0 items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-black uppercase text-short">Liquidated</div>
                <div class="mt-2 text-[clamp(3.5rem,18vw,4.5rem)] font-black leading-none text-short sm:text-7xl">REKT</div>
              </div>
              <button class="btn btn-ghost grid !h-9 !w-9 shrink-0 place-items-center !p-0" data-close-liquidation aria-label="Close liquidation modal">${icon("close")}</button>
            </div>
            <div class="mt-7 max-w-full whitespace-nowrap font-mono text-[clamp(2.25rem,11vw,3rem)] font-black leading-tight tracking-normal text-short sm:mt-8 sm:text-5xl">${formatSignedCurrency(trade.pnl)}</div>
            <div class="mt-3 max-w-full whitespace-nowrap font-mono text-[clamp(1.6rem,7vw,1.875rem)] font-black tracking-normal text-short sm:text-3xl">${formatSignedPercent(trade.roiPct)}</div>
            <div class="mt-6 text-lg font-black">The full margin is gone. 1000x does not forgive.</div>
            <div class="mt-2 text-sm font-semibold text-secondary">Recorded as a simulated liquidation. No real funds were touched.</div>
            <button class="btn btn-short mt-8 w-full sm:w-auto" data-close-liquidation>Back to terminal</button>
          </div>
          <div class="grid min-w-0 place-items-center overflow-hidden">${shareCardMarkup(trade)}</div>
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

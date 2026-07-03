import type { UIContext } from "./context";
import { icon } from "./dom";
import { shareCardMarkup, shareFileName, shareText } from "./shareCard";
import { copyElementPng, downloadElementPng, openXIntent, shareElementPng } from "../util/share";
import { formatSignedCurrency, formatSignedPercent } from "../util/format";
import { playSfx } from "../audio/sfx";

export function mountResultModal(root: HTMLElement, ctx: UIContext): void {
  const render = () => {
    const { resultOpen, lastClosedTrade } = ctx.store.get();
    if (!resultOpen || !lastClosedTrade) {
      root.innerHTML = "";
      return;
    }
    const trade = lastClosedTrade;
    const positive = trade.pnl >= 0;
    root.innerHTML = `<div class="modal-backdrop">
      <div class="modal-panel w-[min(920px,100%)]">
        <div class="grid gap-5 p-5 pb-[calc(20px+env(safe-area-inset-bottom))] md:grid-cols-[1fr_390px] md:pb-5">
          <div class="rounded-xl border ${positive ? "border-long/35 bg-long/10" : "border-short/35 bg-short/10"} p-5">
            <div class="flex items-start justify-between">
              <div>
                <div class="text-sm font-black uppercase ${positive ? "text-long" : "text-short"}">${positive ? "Trade closed in profit" : "Trade closed in loss"}</div>
                <div class="mt-3 font-mono text-6xl font-black leading-none ${positive ? "text-long" : "text-short"}">${formatSignedCurrency(trade.pnl)}</div>
                <div class="mt-3 font-mono text-4xl font-black ${positive ? "text-long" : "text-short"}">${formatSignedPercent(trade.roiPct)}</div>
              </div>
              <button class="btn btn-ghost grid !h-9 !w-9 place-items-center !p-0" data-close-result aria-label="Close result modal">${icon("close")}</button>
            </div>
            <div class="mt-8 text-2xl font-black">${positive ? "GG. You're basically a hedge fund now." : "Diamond hands? More like paper."}</div>
            <div class="mt-2 text-sm font-semibold text-secondary">Export the receipt, flex the simulation, then remember none of this is real money.</div>
            <div class="mt-8 grid grid-cols-2 gap-3">
              <button class="btn btn-primary flex items-center justify-center gap-2" data-download-card>${icon("download")} Download PNG</button>
              <button class="btn btn-ghost flex items-center justify-center gap-2" data-copy-card>${icon("copy")} Copy image</button>
              <button class="btn btn-ghost flex items-center justify-center gap-2" data-native-share>${icon("share")} Share</button>
              <button class="btn btn-ghost flex items-center justify-center gap-2" data-x-share>${icon("x")} Share to X</button>
            </div>
          </div>
          <div class="grid place-items-center overflow-hidden">${shareCardMarkup(trade)}</div>
        </div>
      </div>
    </div>`;
  };

  root.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const trade = ctx.store.get().lastClosedTrade;
    if (!trade) return;
    const card = root.querySelector<HTMLElement>("[data-share-card]");
    if (target.closest("[data-close-result]")) ctx.actions.closeResult();
    if (target.closest("[data-download-card]") && card) {
      playSfx("shutter");
      await downloadElementPng(card, shareFileName(trade));
      ctx.actions.toast("Trade card downloaded.", "success");
    }
    if (target.closest("[data-copy-card]") && card) {
      playSfx("shutter");
      const outcome = await copyElementPng(card);
      ctx.actions.toast(outcome === "copied" ? "Trade card copied." : "Copy unsupported - downloaded instead.", "success");
    }
    if (target.closest("[data-native-share]") && card) {
      playSfx("shutter");
      const outcome = await shareElementPng(card, shareText(trade));
      ctx.actions.toast(outcome === "shared" ? "Share sheet opened." : "Share unavailable - downloaded PNG.", "info");
    }
    if (target.closest("[data-x-share]")) {
      openXIntent(shareText(trade));
    }
  });

  ctx.store.subscribe(render);
}

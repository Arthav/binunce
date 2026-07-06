import type { UIContext } from "./context";
import { escapeHtml, icon } from "./dom";
import { deriveAccount } from "../store/selectors";
import { formatCurrency, formatPercent, formatSignedCurrency, formatTime } from "../util/format";

export function mountSettingsDrawer(root: HTMLElement, ctx: UIContext): void {
  let confirmingReset = false;
  let resetPhrase = "";

  const render = () => {
    const state = ctx.store.get();
    if (!state.settingsOpen) {
      root.innerHTML = "";
      return;
    }
    const derived = deriveAccount(state);
    const marginUsagePct = derived.equity > 0 ? (derived.marginUsed / derived.equity) * 100 : 0;
    const resetReady = resetPhrase === "RESET";
    root.innerHTML = `<div class="fixed inset-0 z-[65] bg-black/50" data-settings-backdrop></div>
      <aside class="fixed bottom-0 left-0 right-0 z-[66] flex max-h-[calc(100dvh-env(safe-area-inset-top))] flex-col overflow-hidden rounded-t-2xl border-t border-line bg-[#11161b] shadow-2xl md:left-auto md:top-0 md:h-full md:w-[min(420px,100vw)] md:rounded-none md:border-l md:border-t-0">
        <div class="flex items-start justify-between border-b border-line bg-[#11161b]/95 p-5 backdrop-blur">
          <div>
            <div class="text-xl font-black">Settings</div>
            <div class="mt-1 text-sm font-semibold text-secondary">Profile, risk, and local save controls.</div>
          </div>
          <button class="btn btn-ghost grid !h-9 !w-9 place-items-center !p-0" data-close-settings aria-label="Close settings">${icon("close")}</button>
        </div>
        <div class="grid min-h-0 flex-1 gap-4 overflow-auto p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <section class="rounded-xl border border-brand/25 bg-brand/10 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-lg font-black">${escapeHtml(state.account.displayName)}</div>
                <div class="mt-1 text-xs font-semibold text-secondary">Local account - created ${escapeHtml(formatTime(state.account.createdAt))}</div>
              </div>
              <div class="shrink-0 rounded border border-brand/30 bg-[#0b0f13]/80 px-2 py-1 font-mono text-[10px] font-black text-brand">SIM</div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
              ${settingsMetric("Wallet", formatCurrency(derived.walletBalance), "text-primary")}
              ${settingsMetric("Equity", formatCurrency(derived.equity), derived.equity >= state.account.balance ? "text-long" : "text-short")}
              ${settingsMetric("Open margin", formatCurrency(derived.marginUsed), derived.marginUsed > 0 ? "text-brand" : "text-secondary")}
              ${settingsMetric("Risk used", formatPercent(marginUsagePct), marginUsagePct >= 70 ? "text-short" : marginUsagePct > 0 ? "text-brand" : "text-secondary")}
            </div>
          </section>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase text-secondary">Display name</span>
            <input class="h-11 rounded-lg px-3 font-bold" data-display-name value="${escapeHtml(state.account.displayName)}" />
          </label>
          <section class="rounded-xl border border-line bg-[#0f1318] p-4">
            <div class="text-sm font-black">Terminal behavior</div>
            <label class="mt-3 flex items-center justify-between gap-4">
              <span>
                <span class="block text-sm font-black">Sound effects</span>
                <span class="text-xs font-semibold text-secondary">Initialized only after your first gesture.</span>
              </span>
              <input class="sr-only" type="checkbox" data-sound-toggle ${state.settings.soundEnabled ? "checked" : ""} />
              <span class="grid h-8 w-14 shrink-0 items-center rounded-full border ${state.settings.soundEnabled ? "border-brand bg-brand/20" : "border-line bg-[#0b0e11]"} p-1 transition" aria-hidden="true">
                <span class="h-5 w-5 rounded-full ${state.settings.soundEnabled ? "translate-x-6 bg-brand" : "bg-secondary"} transition"></span>
              </span>
            </label>
          </section>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase text-secondary">Chart type</span>
            <select class="h-11 rounded-lg px-3 font-bold" data-chart-type>
              <option value="candles" ${state.settings.chartType === "candles" ? "selected" : ""}>Candles</option>
              <option value="area" ${state.settings.chartType === "area" ? "selected" : ""}>Area</option>
            </select>
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase text-secondary">Volatility mode</span>
            <select class="h-11 rounded-lg px-3 font-bold" data-volatility-mode>
              <option value="normal" ${state.settings.volatilityMode === "normal" ? "selected" : ""}>Normal</option>
              <option value="insane" ${state.settings.volatilityMode === "insane" ? "selected" : ""}>Insane</option>
            </select>
          </label>
          <section class="rounded-xl border border-line bg-[#0f1318] p-4">
            <div class="text-sm font-black">Session stats</div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              ${settingsMetric("Trades", String(state.account.totalTrades))}
              ${settingsMetric("Win rate", formatPercent(derived.winRate), derived.winRate >= 50 ? "text-long" : "text-secondary")}
              ${settingsMetric("Realized PnL", formatSignedCurrency(derived.totalRealizedPnl), derived.totalRealizedPnl >= 0 ? "text-long" : "text-short")}
              ${settingsMetric("Liquidations", String(state.account.totalLiquidations), state.account.totalLiquidations > 0 ? "text-short" : "text-secondary")}
            </div>
          </section>
          <div class="rounded-xl border border-short/35 bg-short/10 p-4">
            <div class="text-sm font-black text-short">Reset account</div>
            <div class="mt-1 text-xs font-semibold text-secondary">Wipes this device save: wallet, deposits, open positions, history, and settings.</div>
            ${
              confirmingReset
                ? `<div class="mt-4 rounded-lg border border-short/40 bg-[#0b0f13] p-3">
                    <div class="text-xs font-black text-short">Confirm reset</div>
                    <div class="mt-1 text-xs font-semibold leading-5 text-secondary">Type RESET to unlock. This clears ${state.account.totalTrades} trades, ${state.positions.length} open positions, and ${state.deposits.length} deposits on this device.</div>
                    <input class="mt-3 h-11 w-full rounded-lg px-3 font-mono text-sm font-black uppercase" data-reset-phrase value="${escapeHtml(resetPhrase)}" placeholder="RESET" autocomplete="off" />
                    <div class="mt-3 grid grid-cols-2 gap-2">
                      <button class="btn btn-ghost !min-h-11" data-cancel-reset>Keep account</button>
                      <button class="btn btn-short !min-h-11" data-confirm-reset ${resetReady ? "" : "disabled"}>Reset now</button>
                    </div>
                  </div>`
                : `<button class="btn btn-short mt-4 w-full" data-reset-account>Reset account</button>`
            }
          </div>
        </div>
      </aside>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-close-settings]") || target.matches("[data-settings-backdrop]")) {
      confirmingReset = false;
      resetPhrase = "";
      ctx.actions.closeSettings();
    }
    if (target.closest("[data-reset-account]")) {
      confirmingReset = true;
      resetPhrase = "";
      render();
    }
    if (target.closest("[data-cancel-reset]")) {
      confirmingReset = false;
      resetPhrase = "";
      render();
    }
    if (target.closest("[data-confirm-reset]")) {
      if (resetPhrase !== "RESET") return;
      confirmingReset = false;
      resetPhrase = "";
      ctx.actions.resetAccount();
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.matches("[data-sound-toggle]")) {
      ctx.actions.updateSettings({ soundEnabled: (target as HTMLInputElement).checked });
    }
    if (target.matches("[data-chart-type]")) {
      ctx.actions.updateSettings({ chartType: target.value as "candles" | "area" });
    }
    if (target.matches("[data-volatility-mode]")) {
      ctx.actions.updateSettings({ volatilityMode: target.value as "normal" | "insane" });
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches("[data-reset-phrase]")) {
      resetPhrase = target.value.toUpperCase().slice(0, 5);
      target.value = resetPhrase;
      const confirmButton = root.querySelector<HTMLButtonElement>("[data-confirm-reset]");
      if (confirmButton) confirmButton.disabled = resetPhrase !== "RESET";
      return;
    }
    if (target.matches("[data-display-name]")) {
      ctx.actions.updateDisplayName(target.value.slice(0, 32) || "Degen");
    }
  });

  ctx.store.subscribe(render);
}

function settingsMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="min-w-0 rounded-lg border border-line/80 bg-[#0b0f13]/75 p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono text-xs font-black ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

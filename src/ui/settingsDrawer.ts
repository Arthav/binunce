import type { UIContext } from "./context";
import { escapeHtml, icon } from "./dom";

export function mountSettingsDrawer(root: HTMLElement, ctx: UIContext): void {
  const render = () => {
    const state = ctx.store.get();
    if (!state.settingsOpen) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = `<div class="fixed inset-0 z-[65] bg-black/50" data-settings-backdrop></div>
      <aside class="fixed bottom-0 left-0 right-0 z-[66] max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-auto rounded-t-2xl border-t border-line bg-[#11161b] p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl md:left-auto md:top-0 md:h-full md:w-[min(420px,100vw)] md:rounded-none md:border-l md:border-t-0 md:pb-5">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xl font-black">Settings</div>
            <div class="mt-1 text-sm font-semibold text-secondary">Local simulation controls.</div>
          </div>
          <button class="btn btn-ghost grid !h-9 !w-9 place-items-center !p-0" data-close-settings aria-label="Close settings">${icon("close")}</button>
        </div>
        <div class="mt-6 grid gap-5">
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase text-secondary">Display name</span>
            <input class="h-11 rounded-lg px-3 font-bold" data-display-name value="${escapeHtml(state.account.displayName)}" />
          </label>
          <label class="flex items-center justify-between rounded-xl border border-line bg-[#0f1318] p-4">
            <span>
              <span class="block text-sm font-black">Sound effects</span>
              <span class="text-xs font-semibold text-secondary">Initialized only after your first gesture.</span>
            </span>
            <input type="checkbox" data-sound-toggle ${state.settings.soundEnabled ? "checked" : ""} />
          </label>
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
          <div class="rounded-xl border border-short/35 bg-short/10 p-4">
            <div class="text-sm font-black text-short">Reset account</div>
            <div class="mt-1 text-xs font-semibold text-secondary">Wipes the local SQLite save and returns wallet to $0.</div>
            <button class="btn btn-short mt-4" data-reset-account>Reset account</button>
          </div>
        </div>
      </aside>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-close-settings]") || target.matches("[data-settings-backdrop]")) {
      ctx.actions.closeSettings();
    }
    if (target.closest("[data-reset-account]")) {
      if (window.confirm("Reset Binunce? This wipes your simulated wallet, positions, and history.")) {
        ctx.actions.resetAccount();
      }
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
    if (target.matches("[data-display-name]")) {
      ctx.actions.updateDisplayName(target.value.slice(0, 32) || "Degen");
    }
  });

  ctx.store.subscribe(render);
}

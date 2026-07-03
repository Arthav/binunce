import type { UIContext } from "./context";
import { escapeHtml } from "./dom";

export function mountToastHost(root: HTMLElement, ctx: UIContext): void {
  root.className = "fixed right-4 top-16 z-[95] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2";
  ctx.store.subscribe((state) => {
    root.innerHTML = state.toasts
      .map((toast) => {
        const toneClass =
          toast.tone === "success"
            ? "border-long/40 text-long"
            : toast.tone === "error"
              ? "border-short/40 text-short"
              : toast.tone === "warning"
                ? "border-brand/50 text-brand"
                : "border-line text-primary";
        return `<div class="rounded-lg border bg-[#11161b]/95 px-3 py-2 text-sm font-semibold shadow-lg backdrop-blur ${toneClass}">
          ${escapeHtml(toast.message)}
        </div>`;
      })
      .join("");
  });
}

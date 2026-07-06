import type { AppState } from "../types";
import type { UIContext } from "./context";
import { escapeHtml, icon } from "./dom";

type ToastTone = AppState["toasts"][number]["tone"];

export function mountToastHost(root: HTMLElement, ctx: UIContext): void {
  ctx.store.subscribe((state) => {
    const mobilePlacement = "bottom-[calc(82px+env(safe-area-inset-bottom))] flex-col-reverse";
    root.className = `pointer-events-none fixed left-3 right-3 z-[95] flex gap-2 sm:bottom-auto sm:left-auto sm:right-4 sm:top-16 sm:w-[min(360px,calc(100vw-32px))] ${mobilePlacement}`;
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "true");
    root.innerHTML = state.toasts
      .map((toast) => {
        const tone = toastTone(toast.tone);
        return `<div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border bg-[#11161b]/96 px-3 py-2.5 text-sm font-semibold shadow-[0_14px_34px_rgba(0,0,0,0.38)] backdrop-blur ${tone.border}" role="status">
          <div class="grid h-9 w-9 place-items-center rounded-lg border ${tone.iconBox}">
            ${icon(tone.icon)}
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-black uppercase ${tone.labelColor}">${escapeHtml(tone.label)}</div>
            <div class="mt-0.5 truncate text-primary">${escapeHtml(toast.message)}</div>
          </div>
        </div>`;
      })
      .join("");
  });
}

function toastTone(tone: ToastTone): {
  border: string;
  iconBox: string;
  label: string;
  labelColor: string;
  icon: Parameters<typeof icon>[0];
} {
  if (tone === "success") {
    return {
      border: "border-long/40",
      iconBox: "border-long/30 bg-long/10 text-long",
      label: "Confirmed",
      labelColor: "text-long",
      icon: "deposit",
    };
  }
  if (tone === "error") {
    return {
      border: "border-short/40",
      iconBox: "border-short/30 bg-short/10 text-short",
      label: "Action blocked",
      labelColor: "text-short",
      icon: "close",
    };
  }
  if (tone === "warning") {
    return {
      border: "border-brand/50",
      iconBox: "border-brand/30 bg-brand/10 text-brand",
      label: "Attention",
      labelColor: "text-brand",
      icon: "history",
    };
  }
  return {
    border: "border-line",
    iconBox: "border-brand/25 bg-brand/10 text-brand",
    label: "Ready",
    labelColor: "text-brand",
    icon: "trade",
  };
}

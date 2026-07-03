import { escapeHtml } from "./dom";

const lastValues = new WeakMap<HTMLElement, string>();

export function tickerMarkup(value: string, className = ""): string {
  return `<span class="rolling-ticker ${className}">${[...value]
    .map((char) =>
      /\d/.test(char)
        ? `<span class="ticker-digit"><span>${escapeHtml(char)}</span></span>`
        : `<span>${escapeHtml(char)}</span>`,
    )
    .join("")}</span>`;
}

export function renderTicker(target: HTMLElement, value: string, className = ""): void {
  const previous = lastValues.get(target) ?? "";
  target.innerHTML = `<span class="rolling-ticker ${className}">${[...value]
    .map((char, index) => {
      const changed = /\d/.test(char) && previous[index] !== char ? " changed" : "";
      return /\d/.test(char)
        ? `<span class="ticker-digit${changed}"><span>${escapeHtml(char)}</span></span>`
        : `<span>${escapeHtml(char)}</span>`;
    })
    .join("")}</span>`;
  lastValues.set(target, value);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function icon(
  name:
    | "deposit"
    | "settings"
    | "close"
    | "download"
    | "copy"
    | "share"
    | "x"
    | "markets"
    | "chart"
    | "trade"
    | "positions"
    | "history",
): string {
  const common = `width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const paths: Record<typeof name, string> = {
    deposit: `<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>`,
    settings: `<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.03.03a2 2 0 1 1-2.83 2.83l-.03-.03a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.65V21a2 2 0 1 1-4 0v-.05a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-1.98.36l-.03.03a2 2 0 1 1-2.83-2.83l.03-.03A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.1H3a2 2 0 1 1 0-4h.05A1.8 1.8 0 0 0 4.7 8.8a1.8 1.8 0 0 0-.36-1.98l-.03-.03a2 2 0 1 1 2.83-2.83l.03.03A1.8 1.8 0 0 0 9 4.6 1.8 1.8 0 0 0 10.1 3H10a2 2 0 1 1 4 0v.05A1.8 1.8 0 0 0 15.1 4.7a1.8 1.8 0 0 0 1.98-.36l.03-.03a2 2 0 1 1 2.83 2.83l-.03.03a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.1H21a2 2 0 1 1 0 4h-.05A1.8 1.8 0 0 0 19.4 15Z"/>`,
    close: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
    download: `<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>`,
    copy: `<rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/>`,
    share: `<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6 12 2 8 6"/><path d="M12 2v13"/>`,
    x: `<path d="M4 4l16 16"/><path d="M20 4 4 20"/>`,
    markets: `<path d="M4 19V5"/><path d="M8 17V9"/><path d="M12 19V7"/><path d="M16 15V4"/><path d="M20 19v-9"/>`,
    chart: `<path d="M4 19h16"/><path d="m5 14 4-4 3 3 6-7"/><path d="M18 6h-4"/><path d="M18 6v4"/>`,
    trade: `<path d="M7 7h11"/><path d="m14 3 4 4-4 4"/><path d="M17 17H6"/><path d="m10 13-4 4 4 4"/>`,
    positions: `<path d="M6 7h12"/><path d="M6 12h12"/><path d="M6 17h12"/><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/>`,
    history: `<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>`,
  };
  return `<svg ${common}>${paths[name]}</svg>`;
}

export function mountHtml(target: HTMLElement, html: string): void {
  target.innerHTML = html;
}

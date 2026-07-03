const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return currency.format(Number.isFinite(value) ? value : 0);
}

export function formatSignedCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : safe < 0 ? "-" : "";
  return `${sign}${currency.format(Math.abs(safe))}`;
}

export function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${percent.format(safe)}%`;
}

export function formatSignedPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : safe < 0 ? "-" : "";
  return `${sign}${percent.format(Math.abs(safe))}%`;
}

export function formatPrice(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe >= 1000) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  }
  if (safe >= 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(safe);
  }
  if (safe >= 0.01) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(safe);
  }
  return safe.toPrecision(4);
}

export function formatCompact(value: number): string {
  return compact.format(Number.isFinite(value) ? value : 0);
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function formatTime(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

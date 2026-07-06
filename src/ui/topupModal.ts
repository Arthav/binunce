import qrcode from "qrcode-generator";
import type { DepositMethod } from "../types";
import { formatCurrency } from "../util/format";
import { formatInputMoney, parseMoneyInput } from "../util/math";
import type { UIContext } from "./context";
import { escapeHtml, icon } from "./dom";

const quickAmounts = [100, 1000, 10000, 100000, 1000000];

export function mountTopupModal(root: HTMLElement, ctx: UIContext): void {
  let method: DepositMethod = "card";
  let amount = 10000;
  let processing = false;
  let cardNumber = "";
  let expiry = "";
  let cvc = "";

  const render = () => {
    const state = ctx.store.get();
    if (!state.topupOpen) {
      root.innerHTML = "";
      return;
    }

    const qr = qrcode(0, "M");
    qr.addData(`binunce-usdt-bep20:${state.account.displayName}:${amount}`);
    qr.make();
    const disabledReason = depositDisabledReason(method, amount, cardNumber, expiry, cvc);
    const canConfirm = !disabledReason;

    root.innerHTML = `<div class="modal-backdrop" data-topup-backdrop>
      <div class="modal-panel flex h-[calc(100dvh-env(safe-area-inset-top))] w-full flex-col md:h-auto md:w-[min(760px,100%)]">
        <div class="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-[#12161b]/95 px-5 py-4 backdrop-blur">
          <div>
            <div class="text-xl font-black">Deposit funds</div>
            <div class="mt-1 text-sm font-semibold text-secondary">Simulated funding ticket. Balance posts after mock settlement.</div>
          </div>
          <button class="btn btn-ghost grid !h-9 !w-9 place-items-center !p-0" data-close-topup aria-label="Close deposit modal">${icon("close")}</button>
        </div>
        <div class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_260px] md:grid-rows-none">
          <div class="min-h-0 overflow-auto p-5 pb-5 md:overflow-visible">
            <div class="grid grid-cols-4 gap-2">
              ${(["card", "crypto", "bank", "instant"] as DepositMethod[])
                .map(
                  (item) =>
                    `<button class="chip ${method === item ? "active" : ""}" data-method="${item}">${item.toUpperCase()}</button>`,
                )
                .join("")}
            </div>
            <label class="mt-5 block text-xs font-black uppercase text-secondary">Amount</label>
            <input class="mt-2 h-12 w-full rounded-lg px-3 text-2xl font-black" data-amount value="${escapeHtml(formatInputMoney(amount))}" inputmode="decimal" />
            <div class="scroll-rail mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1">
              ${quickAmounts
                .map((value) => `<button class="chip shrink-0" data-quick-amount="${value}">${formatCurrency(value)}</button>`)
                .join("")}
            </div>
            <div class="mt-5">${methodBody(method, qr.createSvgTag({ cellSize: 3, margin: 1 }), cardNumber, expiry, cvc)}</div>
            <div class="mt-5 md:hidden">${settlementChecklist(method, processing)}</div>
            <div class="mt-5 md:hidden">${depositTicket(method, amount, state.account.displayName)}</div>
          </div>
          <div class="border-t border-line bg-[#0f1318]/98 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-16px_36px_rgba(0,0,0,0.35)] backdrop-blur md:border-l md:border-t-0 md:bg-[#0f1318] md:pb-4 md:shadow-none">
            <div class="hidden md:block">${depositPreview(method, amount, cardNumber, expiry, state.account.displayName)}</div>
            <div class="hidden md:mt-5 md:block">${settlementChecklist(method, processing)}</div>
            <div class="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:block">
              <div class="min-w-0">
                <div class="text-xs font-black uppercase text-secondary">You receive</div>
                <div class="mt-1 truncate font-mono text-2xl font-black text-long md:text-3xl">+${escapeHtml(formatCurrency(amount))}</div>
                <div class="mt-1 text-[11px] font-semibold text-muted md:mt-2 md:text-xs">${escapeHtml(confirmationCopy(method))}</div>
              </div>
              <div class="rounded-lg border border-brand/25 bg-brand/10 px-2 py-1 text-right text-[10px] font-black text-brand md:mt-3 md:text-left">
                ${escapeHtml(methodSummary(method))}
              </div>
            </div>
            <button class="btn btn-primary mt-5 flex w-full items-center justify-center gap-2 !h-12 text-base" data-confirm-deposit ${processing || !canConfirm ? "disabled" : ""}>
              ${
                processing
                  ? `<span class="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black"></span> ${escapeHtml(processingLabel(method))}`
                  : !canConfirm
                    ? `${icon("deposit")} ${escapeHtml(disabledReason)}`
                    : `${icon("deposit")} Confirm deposit`
              }
            </button>
            <div class="mt-3 text-center text-[11px] font-semibold text-muted">Simulation only - no real funds are processed.</div>
          </div>
        </div>
      </div>
    </div>`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const methodButton = target.closest<HTMLElement>("[data-method]");
    const quickButton = target.closest<HTMLElement>("[data-quick-amount]");
    if (target.closest("[data-close-topup]")) ctx.actions.closeTopup();
    if (methodButton) {
      method = methodButton.dataset.method as DepositMethod;
      render();
    }
    if (quickButton) {
      amount = Number(quickButton.dataset.quickAmount ?? amount);
      render();
    }
    if (target.closest("[data-confirm-deposit]") && !processing) {
      processing = true;
      render();
      window.setTimeout(() => {
        processing = false;
        ctx.actions.deposit(amount, method);
        amount = 10000;
        render();
      }, method === "crypto" ? 2800 : 2200);
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches("[data-amount]")) amount = parseMoneyInput(target.value);
    if (target.matches("[data-card-number]")) cardNumber = target.value.replace(/\D/g, "").slice(0, 16);
    if (target.matches("[data-expiry]")) expiry = formatExpiryInput(target.value);
    if (target.matches("[data-cvc]")) cvc = target.value.replace(/\D/g, "").slice(0, 4);
    render();
  });

  ctx.store.subscribe(render);
}

function methodBody(
  method: DepositMethod,
  qrSvg: string,
  cardNumber: string,
  expiry: string,
  cvc: string,
): string {
  if (method === "card") {
    const cardReady = cardNumber.length === 16;
    const expiryReady = isExpiryReady(expiry);
    const cvcReady = cvc.length >= 3;
    return `<div class="grid gap-3">
      <label class="block text-xs font-black uppercase text-secondary">Card number</label>
      <input class="h-11 w-full min-w-0 rounded-lg px-3 font-mono" data-card-number value="${escapeHtml(formatCard(cardNumber))}" placeholder="4242 4242 4242 4242" inputmode="numeric" />
      <div class="grid grid-cols-2 gap-3">
        <label class="grid min-w-0 gap-1">
          <span class="text-[10px] font-black uppercase text-secondary">Expiry</span>
          <input class="h-11 w-full min-w-0 rounded-lg px-3 font-mono" data-expiry value="${escapeHtml(expiry)}" placeholder="MM/YY" inputmode="numeric" />
        </label>
        <label class="grid min-w-0 gap-1">
          <span class="text-[10px] font-black uppercase text-secondary">CVC</span>
          <input class="h-11 w-full min-w-0 rounded-lg px-3 font-mono" data-cvc value="${escapeHtml(cvc)}" placeholder="CVC" inputmode="numeric" />
        </label>
      </div>
      <div class="grid grid-cols-3 gap-2 text-[10px] font-black uppercase">
        ${cardCheck("Card", cardReady)}
        ${cardCheck("Expiry", expiryReady)}
        ${cardCheck("CVC", cvcReady)}
      </div>
      <div class="rounded-lg border ${cardReady && expiryReady && cvcReady ? "border-long/30 bg-long/10 text-long" : "border-brand/25 bg-brand/10 text-brand"} p-2 text-xs font-bold">
        ${cardReady && expiryReady && cvcReady ? "Sim card authorization is ready." : "Use any 16 digits, a future MM/YY, and 3+ CVC digits."}
      </div>
    </div>`;
  }
  if (method === "crypto") {
    return `<div class="flex gap-4 rounded-xl border border-line bg-[#0f1318] p-4">
      <div class="grid h-[112px] w-[112px] shrink-0 place-items-center rounded-xl bg-white p-2">${qrSvg}</div>
      <div class="min-w-0">
        <div class="text-sm font-black">Send USDT (BEP20)</div>
        <div class="mt-2 break-all rounded-lg bg-[#080b0e] p-2 font-mono text-xs text-secondary">0xB1NUNCE000000000SIMULATIONDEGEN777</div>
        <div class="mt-3 rounded-lg border border-brand/25 bg-brand/10 p-2 text-xs font-bold text-brand">Use the confirmation bar below after the fake transfer.</div>
      </div>
    </div>`;
  }
  if (method === "bank") {
    return `<div class="rounded-xl border border-line bg-[#0f1318] p-4">
      <div class="text-sm font-black">Fake bank transfer</div>
      <div class="mt-2 grid grid-cols-2 gap-3 text-xs font-bold text-secondary">
        <span>Bank</span><span class="text-right text-primary">BINUNCE TRUST</span>
        <span>Account</span><span class="text-right font-mono text-primary">777-000-DEGEN</span>
        <span>Reference</span><span class="text-right font-mono text-brand">SIM-${Date.now().toString().slice(-6)}</span>
      </div>
    </div>`;
  }
  return `<div class="rounded-xl border border-brand/30 bg-brand/10 p-4">
    <div class="text-sm font-black text-brand">Instant dopamine rail</div>
    <div class="mt-2 text-sm font-semibold text-secondary">One tap fake settlement. The balance ticker will count up when processing finishes.</div>
  </div>`;
}

function depositPreview(
  method: DepositMethod,
  amount: number,
  cardNumber: string,
  expiry: string,
  displayName: string,
): string {
  return `<div class="relative overflow-hidden rounded-xl border border-brand/30 bg-gradient-to-br from-[#241c03] via-[#11161b] to-[#0b0e11] p-4 shadow-lg">
    <div class="absolute right-[-30px] top-[-30px] h-28 w-28 rounded-full bg-brand/20 blur-2xl"></div>
    <div class="relative flex items-center justify-between">
      <div>
        <div class="text-lg font-black text-brand">Binunce</div>
        <div class="text-[10px] font-black text-secondary">${escapeHtml(methodSummary(method))}</div>
      </div>
      <div class="rounded-full border border-brand/30 px-2 py-1 text-[10px] font-black text-brand">SIM</div>
    </div>
    <div class="relative mt-8 font-mono text-lg font-black tracking-[0.08em] text-primary">
      ${escapeHtml(method === "card" ? maskCard(cardNumber) : `SIM ${formatCurrency(amount)}`)}
    </div>
    <div class="relative mt-5 flex justify-between gap-3 text-xs font-bold text-secondary">
      <span class="truncate">${escapeHtml(displayName.toUpperCase())}</span>
      <span>${escapeHtml(method === "card" ? expiry || "MM/YY" : "PENDING")}</span>
    </div>
  </div>`;
}

function depositTicket(method: DepositMethod, amount: number, displayName: string): string {
  return `<div class="rounded-xl border border-line bg-[#0f1318] p-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm font-black">Funding ticket</div>
        <div class="mt-1 text-xs font-semibold text-secondary">${escapeHtml(methodSummary(method))} - ${escapeHtml(methodEta(method))}</div>
      </div>
      <div class="rounded border border-brand/30 bg-brand/10 px-2 py-1 text-[10px] font-black text-brand">SIM</div>
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
      ${ticketMetric("Amount", formatCurrency(amount), "text-long")}
      ${ticketMetric("Reference", depositReference(method, amount, displayName), "text-brand")}
      ${ticketMetric("Route", methodRoute(method))}
      ${ticketMetric("Fee", "$0.00")}
    </div>
  </div>`;
}

function ticketMetric(label: string, value: string, color = "text-primary"): string {
  return `<div class="min-w-0 rounded-lg border border-line/80 bg-[#0b0f13]/70 p-2">
    <div class="text-[10px] font-black uppercase text-secondary">${escapeHtml(label)}</div>
    <div class="mt-1 truncate font-mono text-xs font-black ${color}" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
  </div>`;
}

function settlementChecklist(method: DepositMethod, processing: boolean): string {
  const stepTwo = processing ? "Confirming" : "Ready";
  return `<div class="rounded-xl border border-line bg-[#0b0f13] p-3">
    <div class="flex items-center justify-between gap-3">
      <div class="text-xs font-black uppercase text-secondary">Settlement path</div>
      <div class="font-mono text-[10px] font-black text-brand">${escapeHtml(methodEta(method))}</div>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-1 text-center">
      ${settlementStep("1", "Ticket", true)}
      ${settlementStep("2", stepTwo, processing)}
      ${settlementStep("3", "Wallet", false)}
    </div>
  </div>`;
}

function settlementStep(index: string, label: string, active: boolean): string {
  return `<div class="min-w-0 rounded-lg border ${active ? "border-brand/45 bg-brand/10 text-brand" : "border-line bg-[#11161b] text-secondary"} px-1.5 py-2">
    <div class="mx-auto grid h-5 w-5 place-items-center rounded-full border border-current font-mono text-[10px] font-black">${escapeHtml(index)}</div>
    <div class="mt-1 truncate text-[10px] font-black">${escapeHtml(label)}</div>
  </div>`;
}

function cardCheck(label: string, ready: boolean): string {
  return `<div class="rounded-lg border ${ready ? "border-long/30 bg-long/10 text-long" : "border-line bg-[#11161b] text-secondary"} px-2 py-2 text-center">
    ${escapeHtml(label)}
  </div>`;
}

function methodSummary(method: DepositMethod): string {
  if (method === "card") return "Sim card";
  if (method === "crypto") return "USDT BEP20";
  if (method === "bank") return "Bank wire";
  return "Instant rail";
}

function methodEta(method: DepositMethod): string {
  if (method === "card") return "2s auth";
  if (method === "crypto") return "3 block sim";
  if (method === "bank") return "same-day sim";
  return "instant";
}

function methodRoute(method: DepositMethod): string {
  if (method === "card") return "Card auth";
  if (method === "crypto") return "BEP20";
  if (method === "bank") return "Wire";
  return "Instant";
}

function depositReference(method: DepositMethod, amount: number, displayName: string): string {
  const seed = `${method}-${Math.round(amount)}-${displayName}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `SIM-${String(seed).padStart(6, "0").slice(-6)}`;
}

function confirmationCopy(method: DepositMethod): string {
  if (method === "card") return "Posts after a fake card authorization.";
  if (method === "crypto") return "Posts after a fake chain confirmation.";
  if (method === "bank") return "Posts after a fake bank confirmation.";
  return "Posts after instant simulated settlement.";
}

function processingLabel(method: DepositMethod): string {
  if (method === "card") return "Authorizing...";
  if (method === "crypto") return "Confirming blocks...";
  if (method === "bank") return "Clearing wire...";
  return "Settling...";
}

function depositDisabledReason(
  method: DepositMethod,
  amount: number,
  cardNumber: string,
  expiry: string,
  cvc: string,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter amount";
  if (method !== "card") return null;
  if (cardNumber.length !== 16) return "Enter card";
  if (!isExpiryReady(expiry)) return "Enter expiry";
  if (cvc.length < 3) return "Enter CVC";
  return null;
}

function isExpiryReady(value: string): boolean {
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  return month >= 1 && month <= 12;
}

function formatExpiryInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCard(value: string): string {
  return value.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function maskCard(value: string): string {
  const padded = value.padEnd(16, "X");
  return padded.replace(/(.{4})(?=.)/g, "$1 ");
}

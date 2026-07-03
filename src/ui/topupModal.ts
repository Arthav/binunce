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

    root.innerHTML = `<div class="modal-backdrop" data-topup-backdrop>
      <div class="modal-panel w-[min(760px,100%)]">
        <div class="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-[#12161b]/95 px-5 py-4 backdrop-blur">
          <div>
            <div class="text-xl font-black">Deposit funds</div>
            <div class="mt-1 text-sm font-semibold text-secondary">Fake top-up, real dopamine. No real funds are processed.</div>
          </div>
          <button class="btn btn-ghost grid !h-9 !w-9 place-items-center !p-0" data-close-topup aria-label="Close deposit modal">${icon("close")}</button>
        </div>
        <div class="grid gap-5 p-5 pb-[calc(20px+env(safe-area-inset-bottom))] md:grid-cols-[1fr_260px] md:pb-5">
          <div>
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
            <div class="mt-3 flex flex-wrap gap-2">
              ${quickAmounts
                .map((value) => `<button class="chip" data-quick-amount="${value}">${formatCurrency(value)}</button>`)
                .join("")}
            </div>
            <div class="mt-5">${methodBody(method, qr.createSvgTag({ cellSize: 3, margin: 1 }), cardNumber, expiry, cvc)}</div>
          </div>
          <div class="sticky bottom-0 rounded-xl border border-line bg-[#0f1318] p-4 md:static">
            <div class="relative h-40 overflow-hidden rounded-xl border border-brand/30 bg-gradient-to-br from-[#241c03] via-[#11161b] to-[#0b0e11] p-4 shadow-lg">
              <div class="absolute right-[-30px] top-[-30px] h-28 w-28 rounded-full bg-brand/20 blur-2xl"></div>
              <div class="relative flex items-center justify-between">
                <div class="text-lg font-black text-brand">Binunce</div>
                <div class="text-[10px] font-black text-secondary">SIM CARD</div>
              </div>
              <div class="relative mt-11 font-mono text-lg font-black tracking-[0.08em] text-primary">
                ${escapeHtml(maskCard(cardNumber))}
              </div>
              <div class="relative mt-5 flex justify-between text-xs font-bold text-secondary">
                <span>${escapeHtml(ctx.store.get().account.displayName.toUpperCase())}</span>
                <span>${escapeHtml(expiry || "MM/YY")}</span>
              </div>
            </div>
            <div class="mt-5 rounded-xl border border-line bg-[#11161b] p-4">
              <div class="text-xs font-black uppercase text-secondary">You receive</div>
              <div class="mt-1 font-mono text-3xl font-black text-long">+${escapeHtml(formatCurrency(amount))}</div>
              <div class="mt-2 text-xs font-semibold text-muted">Simulation credit posts after a 2-3 second fake confirmation.</div>
            </div>
            <button class="btn btn-primary mt-5 flex w-full items-center justify-center gap-2 !h-12 text-base" data-confirm-deposit ${processing || amount <= 0 ? "disabled" : ""}>
              ${processing ? `<span class="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black"></span> Processing...` : `${icon("deposit")} Confirm deposit`}
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
    if (target.matches("[data-expiry]")) expiry = target.value.slice(0, 5);
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
    return `<div class="grid gap-3">
      <label class="block text-xs font-black uppercase text-secondary">Card number</label>
      <input class="h-11 rounded-lg px-3 font-mono" data-card-number value="${escapeHtml(formatCard(cardNumber))}" placeholder="4242 4242 4242 4242" inputmode="numeric" />
      <div class="grid grid-cols-2 gap-3">
        <input class="h-11 rounded-lg px-3 font-mono" data-expiry value="${escapeHtml(expiry)}" placeholder="MM/YY" />
        <input class="h-11 rounded-lg px-3 font-mono" data-cvc value="${escapeHtml(cvc)}" placeholder="CVC" inputmode="numeric" />
      </div>
      <div class="text-xs font-bold ${cardNumber.length === 16 ? "text-long" : "text-secondary"}">${cardNumber.length === 16 ? "Card shape accepted." : "Any 16 digits will pass in simulation."}</div>
    </div>`;
  }
  if (method === "crypto") {
    return `<div class="flex gap-4 rounded-xl border border-line bg-[#0f1318] p-4">
      <div class="grid h-[112px] w-[112px] shrink-0 place-items-center rounded-xl bg-white p-2">${qrSvg}</div>
      <div>
        <div class="text-sm font-black">Send USDT (BEP20)</div>
        <div class="mt-2 break-all rounded-lg bg-[#080b0e] p-2 font-mono text-xs text-secondary">0xB1NUNCE000000000SIMULATIONDEGEN777</div>
        <button class="chip mt-3" data-confirm-deposit>I've sent it</button>
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

function formatCard(value: string): string {
  return value.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function maskCard(value: string): string {
  const padded = value.padEnd(16, "X");
  return padded.replace(/(.{4})(?=.)/g, "$1 ");
}

import type { Database, QueryExecResult, SqlValue } from "sql.js";
import type {
  Account,
  Deposit,
  DepositMethod,
  Position,
  Settings,
  Trade,
} from "../types";
import { roundMoney } from "../util/math";
import { resetSchema } from "./schema";

export interface RepoSnapshot {
  account: Account;
  deposits: Deposit[];
  positions: Position[];
  trades: Trade[];
  settings: Settings;
}

export interface BinunceRepo {
  load(): RepoSnapshot;
  addDeposit(deposit: Deposit): RepoSnapshot;
  openPosition(position: Position, debit: number): RepoSnapshot;
  closePosition(positionId: string, trade: Trade, credit: number, highWatermark: number): RepoSnapshot;
  partialClosePosition(
    currentPositionId: string,
    remaining: Position,
    trade: Trade,
    credit: number,
    highWatermark: number,
  ): RepoSnapshot;
  addMarginToPosition(position: Position, debit: number): RepoSnapshot;
  updatePositionTriggers(positionId: string, tpPrice: number | null, slPrice: number | null): RepoSnapshot;
  updateSettings(settings: Partial<Settings>): RepoSnapshot;
  updateDisplayName(displayName: string): RepoSnapshot;
  reset(): RepoSnapshot;
}

export class SqliteRepo implements BinunceRepo {
  constructor(
    private readonly db: Database,
    private readonly markDirty: () => void,
  ) {}

  load(): RepoSnapshot {
    return {
      account: this.account(),
      deposits: this.deposits(),
      positions: this.positions(),
      trades: this.trades(),
      settings: this.settings(),
    };
  }

  addDeposit(deposit: Deposit): RepoSnapshot {
    this.transaction(() => {
      this.db.run(
        `INSERT INTO deposit (id, amount, method, created_at) VALUES (?, ?, ?, ?);`,
        [deposit.id, deposit.amount, deposit.method, deposit.createdAt],
      );
      this.db.run(
        `UPDATE account
         SET balance = balance + ?,
             total_deposited = total_deposited + ?,
             high_watermark = MAX(high_watermark, balance + ?)
         WHERE id = 1;`,
        [deposit.amount, deposit.amount, deposit.amount],
      );
    });
    return this.afterMutation();
  }

  openPosition(position: Position, debit: number): RepoSnapshot {
    this.transaction(() => {
      this.db.run(
        `UPDATE account SET balance = MAX(0, balance - ?) WHERE id = 1;`,
        [roundMoney(debit)],
      );
      this.db.run(
        `INSERT INTO position (
          id, symbol, side, margin, leverage, notional, size, entry_price,
          liq_price, tp_price, sl_price, opened_at, fee_open
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          position.id,
          position.symbol,
          position.side,
          position.margin,
          position.leverage,
          position.notional,
          position.size,
          position.entryPrice,
          position.liqPrice,
          position.tpPrice,
          position.slPrice,
          position.openedAt,
          position.feeOpen,
        ],
      );
    });
    return this.afterMutation();
  }

  closePosition(positionId: string, trade: Trade, credit: number, highWatermark: number): RepoSnapshot {
    this.transaction(() => {
      this.db.run(`DELETE FROM position WHERE id = ?;`, [positionId]);
      this.insertTrade(trade);
      this.updateAccountAfterTrade(trade, credit, highWatermark);
    });
    return this.afterMutation();
  }

  partialClosePosition(
    currentPositionId: string,
    remaining: Position,
    trade: Trade,
    credit: number,
    highWatermark: number,
  ): RepoSnapshot {
    this.transaction(() => {
      this.db.run(`DELETE FROM position WHERE id = ?;`, [currentPositionId]);
      this.db.run(
        `INSERT INTO position (
          id, symbol, side, margin, leverage, notional, size, entry_price,
          liq_price, tp_price, sl_price, opened_at, fee_open
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          remaining.id,
          remaining.symbol,
          remaining.side,
          remaining.margin,
          remaining.leverage,
          remaining.notional,
          remaining.size,
          remaining.entryPrice,
          remaining.liqPrice,
          remaining.tpPrice,
          remaining.slPrice,
          remaining.openedAt,
          remaining.feeOpen,
        ],
      );
      this.insertTrade(trade);
      this.updateAccountAfterTrade(trade, credit, highWatermark);
    });
    return this.afterMutation();
  }

  updatePositionTriggers(positionId: string, tpPrice: number | null, slPrice: number | null): RepoSnapshot {
    this.db.run(`UPDATE position SET tp_price = ?, sl_price = ? WHERE id = ?;`, [
      tpPrice,
      slPrice,
      positionId,
    ]);
    return this.afterMutation();
  }

  addMarginToPosition(position: Position, debit: number): RepoSnapshot {
    this.transaction(() => {
      this.db.run(`UPDATE account SET balance = MAX(0, balance - ?) WHERE id = 1;`, [
        roundMoney(debit),
      ]);
      this.db.run(
        `UPDATE position
         SET margin = ?,
             leverage = ?,
             liq_price = ?
         WHERE id = ?;`,
        [position.margin, position.leverage, position.liqPrice, position.id],
      );
    });
    return this.afterMutation();
  }

  updateSettings(settings: Partial<Settings>): RepoSnapshot {
    const current = this.settings();
    const next: Settings = { ...current, ...settings };
    const entries: Array<[string, unknown]> = [
      ["sound_enabled", next.soundEnabled],
      ["chart_type", next.chartType],
      ["theme", next.theme],
      ["has_onboarded", next.hasOnboarded],
      ["volatility_mode", next.volatilityMode],
    ];
    this.transaction(() => {
      entries.forEach(([key, value]) => {
        this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`, [
          key,
          JSON.stringify(value),
        ]);
      });
    });
    return this.afterMutation();
  }

  updateDisplayName(displayName: string): RepoSnapshot {
    this.db.run(`UPDATE account SET display_name = ? WHERE id = 1;`, [displayName]);
    return this.afterMutation();
  }

  reset(): RepoSnapshot {
    resetSchema(this.db);
    return this.afterMutation();
  }

  private afterMutation(): RepoSnapshot {
    this.markDirty();
    return this.load();
  }

  private transaction(work: () => void): void {
    this.db.run("BEGIN;");
    try {
      work();
      this.db.run("COMMIT;");
    } catch (error) {
      this.db.run("ROLLBACK;");
      throw error;
    }
  }

  private insertTrade(trade: Trade): void {
    this.db.run(
      `INSERT INTO trade (
        id, symbol, side, margin, leverage, notional, size, entry_price, exit_price,
        pnl, pnl_pct, roi_pct, fee_total, close_reason, opened_at, closed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        trade.id,
        trade.symbol,
        trade.side,
        trade.margin,
        trade.leverage,
        trade.notional,
        trade.size,
        trade.entryPrice,
        trade.exitPrice,
        trade.pnl,
        trade.pnlPct,
        trade.roiPct,
        trade.feeTotal,
        trade.closeReason,
        trade.openedAt,
        trade.closedAt,
        trade.durationMs,
      ],
    );
  }

  private updateAccountAfterTrade(trade: Trade, credit: number, highWatermark: number): void {
    this.db.run(
      `UPDATE account
       SET balance = MAX(0, balance + ?),
           high_watermark = MAX(high_watermark, ?),
           total_trades = total_trades + 1,
           total_wins = total_wins + ?,
           total_liquidations = total_liquidations + ?,
           biggest_win = MAX(biggest_win, ?),
           biggest_loss = MIN(biggest_loss, ?)
       WHERE id = 1;`,
      [
        roundMoney(credit),
        roundMoney(highWatermark),
        trade.pnl > 0 ? 1 : 0,
        trade.closeReason === "liquidation" ? 1 : 0,
        trade.pnl,
        trade.pnl,
      ],
    );
  }

  private account(): Account {
    const row = this.first(
      `SELECT id, display_name, balance, total_deposited, total_withdrawn,
              created_at, high_watermark, total_trades, total_wins,
              total_liquidations, biggest_win, biggest_loss
       FROM account WHERE id = 1;`,
    );
    return {
      id: 1,
      displayName: String(row.display_name ?? "Degen"),
      balance: number(row.balance),
      totalDeposited: number(row.total_deposited),
      totalWithdrawn: number(row.total_withdrawn),
      createdAt: number(row.created_at),
      highWatermark: number(row.high_watermark),
      totalTrades: number(row.total_trades),
      totalWins: number(row.total_wins),
      totalLiquidations: number(row.total_liquidations),
      biggestWin: number(row.biggest_win),
      biggestLoss: number(row.biggest_loss),
    };
  }

  private deposits(): Deposit[] {
    return this.rows(
      `SELECT id, amount, method, created_at FROM deposit ORDER BY created_at DESC;`,
    ).map((row) => ({
      id: String(row.id),
      amount: number(row.amount),
      method: String(row.method) as DepositMethod,
      createdAt: number(row.created_at),
    }));
  }

  private positions(): Position[] {
    return this.rows(
      `SELECT id, symbol, side, margin, leverage, notional, size, entry_price,
              liq_price, tp_price, sl_price, opened_at, fee_open
       FROM position ORDER BY opened_at ASC;`,
    ).map((row) => ({
      id: String(row.id),
      symbol: String(row.symbol),
      side: String(row.side) as Position["side"],
      margin: number(row.margin),
      leverage: number(row.leverage),
      notional: number(row.notional),
      size: number(row.size),
      entryPrice: number(row.entry_price),
      liqPrice: number(row.liq_price),
      tpPrice: nullableNumber(row.tp_price),
      slPrice: nullableNumber(row.sl_price),
      openedAt: number(row.opened_at),
      feeOpen: number(row.fee_open),
    }));
  }

  private trades(): Trade[] {
    return this.rows(
      `SELECT id, symbol, side, margin, leverage, notional, size, entry_price, exit_price,
              pnl, pnl_pct, roi_pct, fee_total, close_reason, opened_at, closed_at, duration_ms
       FROM trade ORDER BY closed_at DESC LIMIT 250;`,
    ).map((row) => ({
      id: String(row.id),
      symbol: String(row.symbol),
      side: String(row.side) as Trade["side"],
      margin: number(row.margin),
      leverage: number(row.leverage),
      notional: number(row.notional),
      size: number(row.size),
      entryPrice: number(row.entry_price),
      exitPrice: number(row.exit_price),
      pnl: number(row.pnl),
      pnlPct: number(row.pnl_pct),
      roiPct: number(row.roi_pct),
      feeTotal: number(row.fee_total),
      closeReason: String(row.close_reason) as Trade["closeReason"],
      openedAt: number(row.opened_at),
      closedAt: number(row.closed_at),
      durationMs: number(row.duration_ms),
    }));
  }

  private settings(): Settings {
    const raw = this.rows(`SELECT key, value FROM settings;`);
    const map = new Map(raw.map((row) => [String(row.key), parseSetting(row.value)]));
    return {
      soundEnabled: Boolean(map.get("sound_enabled") ?? true),
      chartType: (map.get("chart_type") as Settings["chartType"]) ?? "candles",
      theme: "binunce-dark",
      hasOnboarded: Boolean(map.get("has_onboarded") ?? false),
      volatilityMode: (map.get("volatility_mode") as Settings["volatilityMode"]) ?? "normal",
    };
  }

  private first(sql: string): Record<string, SqlValue> {
    const rows = this.rows(sql);
    if (!rows[0]) throw new Error(`No row returned for query: ${sql}`);
    return rows[0];
  }

  private rows(sql: string): Array<Record<string, SqlValue>> {
    return resultsToRows(this.db.exec(sql));
  }
}

export class MemoryRepo implements BinunceRepo {
  private snapshot: RepoSnapshot;

  constructor() {
    const createdAt = Date.now();
    this.snapshot = {
      account: {
        id: 1,
        displayName: "Degen",
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        createdAt,
        highWatermark: 0,
        totalTrades: 0,
        totalWins: 0,
        totalLiquidations: 0,
        biggestWin: 0,
        biggestLoss: 0,
      },
      deposits: [],
      positions: [],
      trades: [],
      settings: {
        soundEnabled: true,
        chartType: "candles",
        theme: "binunce-dark",
        hasOnboarded: false,
        volatilityMode: "normal",
      },
    };
  }

  load(): RepoSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  addDeposit(deposit: Deposit): RepoSnapshot {
    this.snapshot.deposits = [deposit, ...this.snapshot.deposits];
    this.snapshot.account.balance = roundMoney(this.snapshot.account.balance + deposit.amount);
    this.snapshot.account.totalDeposited = roundMoney(
      this.snapshot.account.totalDeposited + deposit.amount,
    );
    this.snapshot.account.highWatermark = Math.max(
      this.snapshot.account.highWatermark,
      this.snapshot.account.balance,
    );
    return this.load();
  }

  openPosition(position: Position, debit: number): RepoSnapshot {
    this.snapshot.account.balance = roundMoney(Math.max(0, this.snapshot.account.balance - debit));
    this.snapshot.positions = [...this.snapshot.positions, position];
    return this.load();
  }

  closePosition(positionId: string, trade: Trade, credit: number, highWatermark: number): RepoSnapshot {
    this.snapshot.positions = this.snapshot.positions.filter((position) => position.id !== positionId);
    this.snapshot.trades = [trade, ...this.snapshot.trades].slice(0, 250);
    this.applyTrade(trade, credit, highWatermark);
    return this.load();
  }

  partialClosePosition(
    currentPositionId: string,
    remaining: Position,
    trade: Trade,
    credit: number,
    highWatermark: number,
  ): RepoSnapshot {
    this.snapshot.positions = this.snapshot.positions
      .filter((position) => position.id !== currentPositionId)
      .concat(remaining);
    this.snapshot.trades = [trade, ...this.snapshot.trades].slice(0, 250);
    this.applyTrade(trade, credit, highWatermark);
    return this.load();
  }

  updatePositionTriggers(positionId: string, tpPrice: number | null, slPrice: number | null): RepoSnapshot {
    this.snapshot.positions = this.snapshot.positions.map((position) =>
      position.id === positionId ? { ...position, tpPrice, slPrice } : position,
    );
    return this.load();
  }

  addMarginToPosition(position: Position, debit: number): RepoSnapshot {
    this.snapshot.account.balance = roundMoney(Math.max(0, this.snapshot.account.balance - debit));
    this.snapshot.positions = this.snapshot.positions.map((item) =>
      item.id === position.id ? { ...item, margin: position.margin, leverage: position.leverage, liqPrice: position.liqPrice } : item,
    );
    return this.load();
  }

  updateSettings(settings: Partial<Settings>): RepoSnapshot {
    this.snapshot.settings = { ...this.snapshot.settings, ...settings };
    return this.load();
  }

  updateDisplayName(displayName: string): RepoSnapshot {
    this.snapshot.account.displayName = displayName;
    return this.load();
  }

  reset(): RepoSnapshot {
    this.snapshot = new MemoryRepo().load();
    return this.load();
  }

  private applyTrade(trade: Trade, credit: number, highWatermark: number): void {
    this.snapshot.account.balance = roundMoney(Math.max(0, this.snapshot.account.balance + credit));
    this.snapshot.account.totalTrades += 1;
    this.snapshot.account.totalWins += trade.pnl > 0 ? 1 : 0;
    this.snapshot.account.totalLiquidations += trade.closeReason === "liquidation" ? 1 : 0;
    this.snapshot.account.biggestWin = Math.max(this.snapshot.account.biggestWin, trade.pnl);
    this.snapshot.account.biggestLoss = Math.min(this.snapshot.account.biggestLoss, trade.pnl);
    this.snapshot.account.highWatermark = Math.max(
      this.snapshot.account.highWatermark,
      roundMoney(highWatermark),
    );
  }
}

function resultsToRows(results: QueryExecResult[]): Array<Record<string, SqlValue>> {
  const rows: Array<Record<string, SqlValue>> = [];
  results.forEach((result) => {
    result.values.forEach((values) => {
      rows.push(
        Object.fromEntries(result.columns.map((column, index) => [column, values[index] ?? null])),
      );
    });
  });
  return rows;
}

function number(value: SqlValue | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nullableNumber(value: SqlValue | undefined): number | null {
  if (value === null || value === undefined) return null;
  return number(value);
}

function parseSetting(value: SqlValue): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    return value;
  }
}

function cloneSnapshot(snapshot: RepoSnapshot): RepoSnapshot {
  return {
    account: { ...snapshot.account },
    deposits: snapshot.deposits.map((deposit) => ({ ...deposit })),
    positions: snapshot.positions.map((position) => ({ ...position })),
    trades: snapshot.trades.map((trade) => ({ ...trade })),
    settings: { ...snapshot.settings },
  };
}

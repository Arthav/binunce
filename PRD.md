## Goal

Build **Binunce** — a single-page, browser-only fake trading platform whose entire purpose is to deliver a visceral dopamine hit. The user "tops up" imaginary money (with a flow that *feels* like a real deposit), then trades real-world asset names (BTC, ETH, SOL, AAPL, TSLA, NVDA, etc.) whose price charts are **fully synthetic and generated client-side**. The user can go **long or short** with leverage up to **x1000**, watch a **live, visibly-moving candlestick + line chart tick every second**, and feel their unrealized PnL swing violently in real time. When they close a position, the outcome (big green win or brutal red loss) is celebrated or mourned with animation, sound, and haptic-style feedback. Every win/loss can be exported as a **shareable "trade card" image** (Binance-style receipt) that they can download or copy.

There is **no server**. All persistence is **SQLite compiled to WebAssembly** (`sql.js`) with the database serialized into IndexedDB so state survives reloads. The whole thing runs from static files. This is a toy/parody — it must be visually indistinguishable from a real exchange in polish, but must never involve real money and must carry a subtle "SIMULATION" watermark.

The emotional target: **the chart must never sit still**, the PnL number must **flicker and roll**, and closing a winning trade must feel *rewarding*.

## Mobile-first product stance

Binunce must be designed **mobile first**. The primary target is a phone in portrait orientation, starting at **360px wide** and scaling cleanly through modern iPhone/Android sizes before desktop is considered. Desktop is an expanded power-user layout; it must not define the product shape.

The mobile experience should feel like a real exchange app: fast thumb navigation, dense but readable price data, sticky critical numbers, bottom-sheet trade flows, and zero horizontal scrolling. The user should be able to deposit, pick a market, open a 1000x position, watch live PnL, close/share the result, and reset the account using one hand.

All major feature requirements below apply to mobile first. When a section mentions desktop panels, sidebars, or tables, implement the mobile version as the canonical interaction and adapt upward to tablet/desktop.

## Tech stack

- **Build tool:** Vite (vanilla TypeScript template — no React needed, keep it fast and dependency-light; if you prefer React that is acceptable, but the spec below assumes vanilla TS + a thin component pattern).
- **Language:** TypeScript, strict mode.
- **Styling:** Tailwind CSS (configured via `tailwind.config.js`) plus a small `globals.css` for keyframes and font-face. Dark theme only.
- **Responsive baseline:** CSS and DOM structure must be authored mobile-first with `min-width` breakpoints. Avoid desktop-only grid assumptions, fixed panel widths on the base layout, hover-only controls, and any required horizontal scroll.
- **Charting:** [`lightweight-charts`](https://www.npmjs.com/package/lightweight-charts) (TradingView's open-source library) for the candlestick + line/area series. This gives real exchange feel.
- **Database:** `sql.js` (SQLite compiled to WASM). The serialized DB (`Uint8Array`) is persisted to **IndexedDB** under key `binunce_db`. No backend, no network calls except loading the WASM binary and fonts.
- **Icons:** `lucide` (vanilla icon set) or inline SVG.
- **Sound:** Web Audio API (generate tones programmatically — no audio asset files) plus optional tiny base64 sfx.
- **Image export:** `html-to-image` (or `dom-to-image-more`) to rasterize the share card DOM node to PNG, plus Clipboard API for copy.
- **State:** A tiny hand-rolled observable store (`createStore<T>()`) — publish/subscribe. No Redux.
- **Number formatting:** `Intl.NumberFormat` for currency; custom rolling-digit animation for the PnL ticker.
- **IDs:** `crypto.randomUUID()`.
- **Persistence cadence:** debounced save-to-IndexedDB every 750ms after any mutation, plus a forced save on `visibilitychange`/`beforeunload`.

Assume the agent owns the environment. Do not include install or run commands.

## File / module layout

```
binunce/
├─ index.html
├─ public/
│  ├─ sql-wasm.wasm            # sql.js wasm binary (copied into public)
│  └─ favicon.svg
├─ src/
│  ├─ main.ts                  # entry: boot db, mount app, start engine loop
│  ├─ styles/
│  │  ├─ globals.css           # font-face, keyframes, base resets
│  │  └─ tokens.css            # CSS custom properties for the palette
│  ├─ db/
│  │  ├─ sqlite.ts             # init sql.js, load/save from IndexedDB, run migrations
│  │  ├─ schema.ts             # CREATE TABLE statements + seed
│  │  ├─ idb.ts                # thin IndexedDB get/set for the serialized db blob
│  │  └─ repo.ts               # typed CRUD: accounts, positions, trades, deposits, settings
│  ├─ store/
│  │  ├─ store.ts              # createStore observable primitive
│  │  ├─ appState.ts           # global reactive app state (balance, equity, openPositions…)
│  │  └─ selectors.ts          # derived values (equity, marginUsed, freeMargin, totalPnL)
│  ├─ engine/
│  │  ├─ priceEngine.ts        # synthetic price generation per asset, 1s tick loop
│  │  ├─ assets.ts             # asset registry (symbol, name, class, seed, vol, startPrice)
│  │  ├─ randomWalk.ts         # GBM + regime/spike/pump-dump model
│  │  ├─ pnl.ts               # position PnL, liquidation, margin math
│  │  └─ liquidation.ts        # margin call + liquidation detection
│  ├─ ui/
│  │  ├─ layout.ts             # mobile app shell, bottom tabs, desktop expansion grid
│  │  ├─ chart.ts              # lightweight-charts wrapper, live series updates
│  │  ├─ ticker.ts             # rolling-digit animated number component
│  │  ├─ marketList.ts         # mobile Markets tab / desktop watchlist with live blinking prices
│  │  ├─ orderPanel.ts         # mobile Trade tab / desktop order panel
│  │  ├─ positionsPanel.ts     # mobile position cards / desktop positions table
│  │  ├─ historyPanel.ts       # mobile history cards / desktop closed trades history
│  │  ├─ topupModal.ts         # fake deposit flow (feels real)
│  │  ├─ resultModal.ts        # win/loss celebration + share card
│  │  ├─ shareCard.ts          # renders the exportable trade receipt
│  │  ├─ liquidationModal.ts   # the "REKT" moment
│  │  ├─ toast.ts              # transient notifications
│  │  └─ confetti.ts           # canvas confetti + green rain / red rain
│  ├─ audio/
│  │  └─ sfx.ts                # Web Audio tones: cash, win, loss, liquidate, tick, click
│  ├─ util/
│  │  ├─ format.ts             # currency, percent, compact, signed formatting
│  │  ├─ math.ts               # clamp, lerp, seededRandom (mulberry32), gaussian
│  │  └─ share.ts              # dom->png export + clipboard + web share API
│  └─ types.ts                 # shared TS interfaces/enums
├─ tailwind.config.js
├─ tsconfig.json
└─ vite.config.ts
```

## Data model

Persisted in SQLite (WASM), serialized to IndexedDB. All money stored as **REAL** (USD). Use integer cents only if you prefer; otherwise clamp/round on display. Foreign keys enabled.

### Table `account`
Single-row table (id always `1`).
| column | type | notes |
|---|---|---|
| `id` | INTEGER PK | always 1 |
| `display_name` | TEXT | default `"Degen"`, editable in settings |
| `balance` | REAL | realized wallet cash (USD). Starts `0`. |
| `total_deposited` | REAL | sum of all fake deposits. |
| `total_withdrawn` | REAL | for parity; deposits only in v1. |
| `created_at` | INTEGER | epoch ms |
| `high_watermark` | REAL | peak equity ever reached (for "ATH" bragging) |
| `total_trades` | INTEGER | closed trade count |
| `total_wins` | INTEGER | closed profitable trades |
| `total_liquidations` | INTEGER | times rekt |
| `biggest_win` | REAL | max single realized PnL |
| `biggest_loss` | REAL | min single realized PnL (negative) |

### Table `deposit`
| column | type | notes |
|---|---|---|
| `id` | TEXT PK | uuid |
| `amount` | REAL | > 0 |
| `method` | TEXT | `"card" \| "crypto" \| "bank" \| "instant"` (all fake) |
| `created_at` | INTEGER | epoch ms |

### Table `position` (open positions only)
| column | type | notes |
|---|---|---|
| `id` | TEXT PK | uuid |
| `symbol` | TEXT | e.g. `"BTCUSDT"` |
| `side` | TEXT | `"long" \| "short"` |
| `margin` | REAL | user's collateral committed (USD) |
| `leverage` | INTEGER | 1..1000 |
| `notional` | REAL | `margin * leverage` |
| `size` | REAL | `notional / entry_price` (units of asset) |
| `entry_price` | REAL | price at open |
| `liq_price` | REAL | computed liquidation price |
| `tp_price` | REAL NULL | optional take-profit trigger |
| `sl_price` | REAL NULL | optional stop-loss trigger |
| `opened_at` | INTEGER | epoch ms |
| `fee_open` | REAL | cosmetic fee (0.04% of notional) deducted at open |

### Table `trade` (closed history)
| column | type | notes |
|---|---|---|
| `id` | TEXT PK | uuid (reuse position id) |
| `symbol` | TEXT | |
| `side` | TEXT | long/short |
| `margin` | REAL | |
| `leverage` | INTEGER | |
| `notional` | REAL | |
| `size` | REAL | |
| `entry_price` | REAL | |
| `exit_price` | REAL | |
| `pnl` | REAL | realized PnL (already net of fees) |
| `pnl_pct` | REAL | pnl / margin * 100 (ROI on margin) |
| `roi_pct` | REAL | same as pnl_pct, aliased for share card |
| `fee_total` | REAL | open+close fees |
| `close_reason` | TEXT | `"manual" \| "tp" \| "sl" \| "liquidation"` |
| `opened_at` | INTEGER | |
| `closed_at` | INTEGER | |
| `duration_ms` | INTEGER | closed_at - opened_at |

### Table `settings`
| column | type | notes |
|---|---|---|
| `key` | TEXT PK | |
| `value` | TEXT | JSON-encoded |
Keys: `sound_enabled` (bool, default true), `chart_type` (`"candles" \| "area"`, default `"candles"`), `theme` (`"binunce-dark"`), `has_onboarded` (bool), `volatility_mode` (`"normal" \| "insane"`, default `"normal"`).

### In-memory (not persisted) — synthetic price state
Held in `priceEngine`, rebuilt on load from a deterministic seed so the "history" candles are stable across reloads until new ticks arrive:
- Per asset: current price, last candle OHLC, rolling array of ~500 candles (1s each), 24h open, 24h high/low, direction bias, current market "regime".

### Derived selectors (computed, never stored)
- `equity = balance + Σ(open position unrealized PnL)`
- `marginUsed = Σ(position.margin)`
- `freeMargin = balance - marginUsed` (balance already excludes committed margin? — see note)
- `totalUnrealizedPnL = Σ(unrealized PnL of open positions)`

> **Money accounting rule (important, implement exactly):** When a position opens, deduct `margin + fee_open` from `account.balance` immediately. `balance` therefore represents *free cash not tied up*. On close, credit back `margin + realizedPnL - fee_close`. On liquidation, credit back `0` (the full margin is lost) — realized pnl == `-margin`. This keeps `equity = balance + Σ margin + Σ unrealizedPnL` intuitive; expose both `walletBalance` (the stored `balance`) and `equity` in the UI, and label them like Binance ("Wallet" vs "Equity/Margin Balance").

## Behavior & features

### 1. Boot sequence
1. Show a full-screen **Binunce splash** (logo + animated loading bar) while `sql.js` WASM loads and the DB is hydrated from IndexedDB.
2. If no DB exists, run migrations, seed `account` (balance 0), seed `settings`, mark `has_onboarded=false`.
3. Start `priceEngine`: build ~500 seconds of synthetic history per asset from a per-asset deterministic seed so the initial chart looks lived-in, then begin the **1-second live tick loop**.
4. If `has_onboarded=false`, show a 3-step onboarding overlay ("Welcome to Binunce", "This is a simulation — no real money", "Top up to start") ending on the top-up modal.

### 2. Synthetic price engine (the heartbeat)
- **Tick cadence:** every **1000ms**, generate a new price for **every** asset (so the watchlist blinks live even for assets you're not viewing). Additionally, do **intra-second micro-updates every ~250ms** for the *currently viewed* symbol so the active chart's last candle visibly wiggles up/down between full ticks — this is critical to the "chart must visibly move" requirement.
- **Model — geometric brownian motion with regimes:**
  - Base: `nextPrice = price * exp((drift - 0.5*vol²)*dt + vol*sqrt(dt)*gaussian())`.
  - Each asset has base `vol` (crypto higher than stocks; meme coins highest) and a slow-moving `drift` bias that randomly flips every 20–120 ticks (bull/bear regimes) so trends form.
  - **Volatility_mode "insane"** multiplies vol by ~2.5 and increases spike frequency.
  - **Event injections** (rare, weighted): sudden **pump** (+2–8% over a few ticks) or **dump** (−2–8%), and single-tick **wicks** (spike then partial retrace). These create adrenaline and can trigger liquidations/TP/SL. Bias event probability slightly *against* the user's open position occasionally (house-edge feel) but keep it subtle — the platform should feel winnable so dopamine keeps flowing.
  - Prices are clamped to stay positive; a soft mean-reversion pulls extreme deviations back so charts never flatline at 0 or moon to infinity within a session.
- **Candle aggregation:** the live chart uses 1s candles. Every real 1s tick closes the current candle and opens a new one; the 250ms micro-updates mutate the *forming* candle's close/high/low so the wick grows in real time.
- **Chart-timeframe selector** (1s, 5s, 15s, 1m) that re-aggregates the in-memory 1s buffer client-side.
- **24h stats** derived from the buffer: 24h change %, high, low, volume (fabricate a plausible volume via `notional-ish` random walk).

### 3. Assets (registry in `assets.ts`)
Ship at least these, each with `symbol`, `displayName`, `class` (`crypto`/`stock`), `startPrice`, `vol`, `seed`, `logo` (emoji or SVG letter tile):
- Crypto: `BTCUSDT` Bitcoin (~$64,000), `ETHUSDT` Ethereum (~$3,200), `SOLUSDT` Solana (~$150), `BNBUSDT` Binunce Coin (~$580), `DOGEUSDT` Dogecoin (~$0.13, high vol), `PEPEUSDT` Pepe (~$0.0000098, extreme vol), `XRPUSDT`, `ADAUSDT`.
- Stocks: `AAPL` Apple (~$225), `TSLA` Tesla (~$250, high vol), `NVDA` Nvidia (~$130), `AMZN`, `MSFT`, `GME` GameStop (~$25, meme vol).
Include a small "not affiliated / prices simulated" disclaimer near the market list.

### 4. Fake top-up flow (must FEEL real)
Trigger from the prominent sticky mobile **"Deposit"** action in the top account strip, the wallet card, or the empty-wallet CTA. On desktop this can also appear in the top nav.
On phones, present the flow as a full-height bottom sheet with safe-area padding, a sticky amount/confirm footer, and inputs that remain visible above the virtual keyboard.
1. Modal titled **"Deposit funds"** with method tabs: **Card**, **Crypto**, **Bank**, **Instant**.
2. **Amount input** with quick-chips: `$100`, `$1,000`, `$10,000`, `$100,000`, `$1,000,000`, and a custom field. Live-format with thousands separators.
3. **Card tab:** fake card-number field (auto-format `#### #### #### ####`, accept any input, mask with a Binunce-branded card visual that flips), expiry, CVC. Luhn is NOT enforced but show a green check when 16 digits entered.
4. **Crypto tab:** show a fake deposit address + QR (generate a QR of a dummy string), "Send USDT (BEP20)"; a **"I've sent it"** button.
5. On **Confirm**: show a **2–3 second processing animation** ("Verifying payment…", spinner → "Confirming on-chain…" for crypto → progress bar), then a **success burst**: cash-register sound, green **+$amount** count-up added to the wallet ticker with a coin-shower confetti. Insert a `deposit` row, increment `account.balance` and `total_deposited`.
6. Subtly watermark the modal footer: *"Simulation only — no real funds are processed."*

### 5. Order placement (long/short + leverage)
Mobile **Trade** tab / bottom sheet, always reflecting the currently selected symbol. On desktop this expands into the right-side **Order panel**.
- The mobile Trade view opens from the bottom nav, the chart header CTA, or a long/short quick action. It must preserve context: selected symbol, live mark price, wallet/free margin, and current side.
- Keep the primary action sticky at the bottom above the device safe area. Advanced fields (TP/SL, fee details) can collapse into an expandable section, but leverage, margin, liq price, and notional must remain immediately visible.
- **Side toggle:** big **LONG (green)** / **SHORT (red)** segmented control.
- **Margin/size input:** enter USD margin to commit; quick-chips 25% / 50% / 75% / MAX of free wallet balance.
- **Leverage slider:** `1x → 1000x`, with notch stops at 1, 5, 10, 25, 50, 100, 250, 500, 1000. Live-updates the displayed **notional** (`margin × leverage`), **liquidation price**, and **position size in units**. Color-shift the slider from calm teal at low leverage to alarming red at 1000x, with a small "⚠ 1000x — one tick can rek you" warning above 100x.
- **Live entry price** shown (uses current tick), plus estimated **fee** (0.04% of notional).
- **Optional TP / SL** inputs (price or %), validated relative to side.
- **Liquidation price math:** for a long, `liq_price ≈ entry * (1 - 1/leverage + feeBuffer)`; for a short, `liq_price ≈ entry * (1 + 1/leverage - feeBuffer)`. At 1000x the liq price sits ~0.1% away → thrilling.
- **Place order button** label reflects side & symbol: *"Long BTCUSDT · $500 · 100x"*. On click: validate free balance ≥ margin+fee, deduct, insert `position`, draw an **entry marker line** and a **liquidation line** on the chart, play a click/whoosh, toast "Position opened", and immediately begin showing live unrealized PnL.

### 6. Live positions & PnL (the dopamine core)
Mobile **Positions** tab uses stacked live position cards; desktop can render the same data as a dense table.
- Each mobile card must show Symbol, Side badge, leverage, Margin, Entry, Mark (live), **Liq price**, **Unrealized PnL ($ and ROI%)**, TP/SL, and a sticky row of **Close** / **Close 50%** actions. The PnL and ROI must be the most visually dominant values on each card.
- **PnL updates every micro-tick (250ms) for viewed symbol and every 1s for others.** Numbers use the **rolling-digit ticker** and flash green on increase / red on decrease. A thin sparkline or a pulsing dot conveys "live".
- PnL math (long): `unrealizedPnL = (mark - entry) * size`; short: `(entry - mark) * size`. ROI% = `unrealizedPnL / margin * 100`. At 1000x a 0.1% price move ≈ ±100% ROI — make sure the numbers swing hard.
- Row background subtly tints green/red proportional to ROI (heat).
- A **global equity/PnL header ticker** at the top aggregates all positions + wallet, and is the single most prominent number on screen — big, animated, color-reactive, with a subtle glow that intensifies with magnitude.

### 7. TP / SL / Liquidation automation
On each tick, evaluate every open position:
- If **long** mark ≤ `liq_price` (or short mark ≥ liq_price) → **liquidate**: realizedPnL = `-margin`, close reason `"liquidation"`, increment `total_liquidations`, show the **REKT modal** (screen-shake, red flash, "LIQUIDATED", loss sound), record the trade.
- If TP hit → auto-close at tp_price, reason `"tp"`, celebratory close.
- If SL hit → auto-close at sl_price, reason `"sl"`.
- Manual close uses current mark.
- On any close: move row from `position` → `trade`, credit wallet, update `account` aggregates (wins, biggest_win/loss, high_watermark), remove chart lines, and pop the **result modal**.

### 8. Result modal + share card
On every manual/TP close (and optionally liquidation), show a mobile-first **result sheet** that can expand to full screen for the share card. Desktop can center this as a modal.
- **Win:** green gradient, up-arrow, confetti/green-rain, coin sound, big **+$PnL** and **+ROI%** count-up. Copy like "GG. You're basically a hedge fund now."
- **Loss:** muted red, down-arrow, sad tone, "Diamond hands? More like paper. −$X". No confetti.
- Embedded **share card** (`shareCard.ts`) styled exactly like a Binance futures PnL receipt: Binunce logo + "Futures", **big ROI% in green/red**, symbol · side badge · leverage (e.g. `BTCUSDT Long 100x`), entry price, exit/mark price, a faint referral code (`Referral: DEGEN777`), a QR to the (fake) app, timestamp, and a subtle "SIMULATED" watermark diagonally.
- Actions: **Download PNG** (via html-to-image), **Copy image** (Clipboard API `write` with `image/png`), **Web Share** (`navigator.share` where available, else fallback copy link/toast), and **Share to X** (opens an intent URL with prefilled text). Play a shutter sound on capture.

### 9. History panel
Mobile History lives inside the **Positions** tab behind Open/History segmented tabs. Render closed trades as compact cards, not a cramped table: symbol, side, leverage, PnL (colored), ROI%, duration, close reason icon (🎯 tp / 🛑 sl / 💀 liq / ✋ manual), and a "Share" button re-opening the share card for that trade. A sticky stats strip shows **win rate**, **total realized PnL**, **biggest win/loss**, and **liquidation count**.

### 10. Watchlist / market list
Mobile **Markets** tab: searchable list of all assets with live blinking last price (green/red flash per tick), 24h change %, tiny sparkline, and a compact disclaimer. Tap switches the active chart and primes the Trade tab for that symbol with a smooth crossfade. A "Movers" toggle sorts by |24h change|. On desktop this becomes the left watchlist column.

### 11. Settings / misc
- Settings drawer: on mobile, a bottom sheet reachable from the account strip; on desktop, a side drawer. Include display name, sound toggle, chart type (candles/area), volatility mode (normal/insane), and a **"Reset account"** (wipe DB → fresh $0 wallet) with a confirm dialog.
- Persistent **"SIMULATION — no real money"** badge in the footer/top bar.
- A cheeky **"Get rich" quick-action** that opens top-up.

## UX & visual design

**Overall vibe:** a pixel-faithful, parody Binance-futures dark UI — dense, financial, glowing, alive. Everything moves.

**Color palette (define in `tokens.css`):**
- Background base `#0B0E11` (Binance black), panel `#161A1E`, elevated `#1E2329`, border `#2B3139`.
- Text primary `#EAECEF`, secondary `#848E9C`, muted `#5E6673`.
- **Brand yellow** (Binunce accent) `#F0B90B` (logo, primary highlights, deposit-adjacent accents).
- **Long/green** `#0ECB81` (bg tint `rgba(14,203,129,0.12)`), **Short/red** `#F6465D` (bg tint `rgba(246,70,93,0.12)`).
- Warning `#F0B90B` → danger gradient `#F0B90B → #F6465D` for the high-leverage slider.
- Success glow `0 0 24px rgba(14,203,129,0.45)`, loss glow `0 0 24px rgba(246,70,93,0.45)`.

**Typography:**
- UI font: **Inter** (or system-ui fallback). Numbers/prices: a tabular-figures font — Inter with `font-variant-numeric: tabular-nums` (or **IBM Plex Mono** / **JetBrains Mono** for the big PnL ticker) so digits don't jitter width during rolling animation.
- Scale: display 40/48, h1 28, h2 20, body 14, caption 12, micro 11. The global equity ticker is the largest element (≈48–64px).

**Spacing scale:** 4-px base — `4, 8, 12, 16, 24, 32, 48`. Panels: 12px radius, 1px `#2B3139` borders, subtle inner shadow. Consistent 16px gutters in the main grid.

**Layout (mobile-first, 360px+):**
- Mobile app shell: sticky top account strip with Binunce logo, compact **Equity/PnL ticker**, wallet/free margin, **Deposit** action, settings icon, and persistent "SIMULATION" pill.
- Bottom tab bar: **Markets**, **Chart**, **Trade**, **Positions**. It must respect `env(safe-area-inset-bottom)`, keep 44px+ touch targets, and never cover critical buttons.
- **Markets tab:** searchable watchlist, movers filter, live prices, 24h change, tiny sparklines, and disclaimer. Tapping an asset switches the active symbol and lands the user on Chart.
- **Chart tab:** symbol header, 24h stats, timeframe tabs, full-width chart, entry/liq markers, and a sticky Long/Short action rail that opens Trade with the selected side.
- **Trade tab:** focused order ticket with side toggle, margin, leverage, liq price, notional, optional TP/SL accordion, and sticky Place Order button above the safe area.
- **Positions tab:** Open/History segmented control; open positions are live cards, history is compact trade cards, and close/share actions are thumb reachable.
- Tablet (≥768px): allow split surfaces where useful, such as Chart over Trade or Markets beside Chart, but keep the bottom navigation available.
- Desktop (≥1280px): expand into the trading terminal layout: left **Watchlist** (280px), center **Chart** with symbol header + stats + timeframe tabs, right **Order panel** (320px), and a lower **Positions/History** band. Desktop is an enhancement of the mobile IA, not a separate product.

**Motion & microinteractions (make it feel alive):**
- **Rolling-digit ticker:** each digit column animates vertically (transform translateY) when it changes; brief green/red glow flash on change; 180–260ms ease-out.
- Price flashes: background of a price cell flashes its direction color at ~35% opacity then fades over 400ms on each tick.
- Chart last-candle wiggle every 250ms; smooth series updates (no full redraw).
- Leverage slider: thumb scales on drag, track gradient shifts, subtle haptic-style pulse animation at 100x/500x/1000x notches.
- Order placed: button ripple + whoosh, entry & liq lines slide in.
- Deposit success: coin-shower confetti + wallet count-up + brand-yellow shimmer.
- Win close: green confetti burst + upward glow pulse on equity ticker + optional screen edge green vignette.
- Liquidation: red screen-shake (translate keyframes), full-screen red flash, "REKT" stamp scale-in.
- All transitions honor `prefers-reduced-motion` (disable shake/confetti, keep instant updates).

**Sound (Web Audio, toggleable):** short click on buttons, ascending arpeggio on win, descending minor tone on loss, cash-register on deposit, low buzz + noise on liquidation, faint tick on price flips. Never autoplay before a user gesture; init AudioContext on first click.

**Empty / loading / error states:**
- Wallet $0 → big empty-state in the Trade tab/order ticket: "No funds. Time to gamble responsibly (or not)." + Deposit CTA. Trading controls disabled until funded.
- No open positions → Positions tab shows "No open positions. Pick your poison." illustration.
- No history → "Your legend hasn't started yet."
- Chart loading → skeleton shimmer.
- IndexedDB/WASM failure → non-blocking toast + fall back to in-memory-only mode with a warning banner ("Storage unavailable — progress won't be saved").

## Edge cases & error handling

- **Insufficient balance:** block order, shake the amount field, toast "Not enough balance — deposit more." Never allow negative wallet.
- **Zero/negative/NaN inputs:** clamp; disable place-order until valid; leverage clamped 1..1000; margin ≥ minimum ($1).
- **MAX button** must account for open fee so the order still fits (`maxMargin = balance / (1 + feeRate)`).
- **Simultaneous liq + TP/SL on same tick:** liquidation takes precedence (worst outcome), then SL, then TP.
- **Extreme leverage instant liquidation:** if the entry tick already breaches liq (rare with wicks), still open then liquidate next tick — or reject with "Too volatile to open safely" toast; pick reject to avoid feel-bad instant loss.
- **Very small prices (PEPE):** format with adaptive decimals (up to 8 sig figs); size can be huge — display with compact notation (e.g. `1.2B PEPE`).
- **Rolling ticker with changing digit count** (e.g. equity crosses from 999 → 1,000): re-layout digit columns smoothly without jump.
- **Tab backgrounded:** throttle the engine (use timestamp deltas, not naive intervals) so returning doesn't produce a 10,000-tick catch-up spike; cap catch-up to a sane number of ticks and jump forward.
- **DB corruption / version mismatch:** wrap load in try/catch; on failure, back up the bad blob, run fresh migrations, toast "Save reset."
- **Persistence race:** debounce saves; serialize DB on a single writer; flush on `beforeunload`/`visibilitychange:hidden`.
- **Clipboard image copy unsupported (Firefox/Safari quirks):** fall back to auto-download PNG and toast "Copy not supported — downloaded instead."
- **navigator.share absent:** hide native share, keep download + X intent.
- **Reduced motion:** skip shake/confetti/screen-flash but keep numeric updates.
- **Mobile safe areas:** top account strip, bottom nav, sticky order buttons, modals, and toasts must respect iOS/Android safe-area insets.
- **Virtual keyboard:** deposit and order inputs must not be hidden by the keyboard; sticky confirm/place-order buttons must remain reachable or intentionally move above the keyboard.
- **Touch accuracy:** all mobile interactive targets must be at least 44px tall/wide with enough spacing to avoid accidental close/order/deposit actions.
- **Orientation:** portrait is the primary target. Landscape must remain usable without broken layout, but it can simplify to chart-first with tab access to secondary panels.
- **Multiple tabs open:** last-writer-wins on save; on focus, reload DB from IndexedDB to reduce divergence (best-effort).
- **Liq/TP/SL evaluation must not double-close** a position mid-loop — guard with a `closing` set / flag.
- **Chart series memory:** cap in-memory candle buffer (e.g. 1500 candles) with FIFO trimming.
- **Number precision:** round money to cents on persist/display but keep full precision in-memory for PnL math.

## Definition of done

- [ ] App boots from static files with **no backend**; `sql.js` WASM loads and DB hydrates from IndexedDB; state survives reload.
- [ ] Mobile portrait is the primary finished experience at 360px, 390px, and 430px widths: no horizontal scroll, no clipped controls, no unreachable primary actions, and safe-area-aware sticky UI.
- [ ] Splash + first-run onboarding + auto-open top-up appear on fresh install.
- [ ] SQLite schema created via migrations with all tables (`account`, `deposit`, `position`, `trade`, `settings`); FKs on; seed row inserted.
- [ ] Price engine ticks **every 1s for all assets** and **every ~250ms for the viewed symbol**, using GBM + regimes + occasional pump/dump/wick events; prices stay positive and realistic.
- [ ] The **active chart visibly moves continuously** (forming candle wicks grow between ticks) using `lightweight-charts`; candle & area modes both work; timeframe tabs (1s/5s/15s/1m) re-aggregate correctly.
- [ ] Mobile **Markets** tab shows all assets with live blinking prices, 24h change %, and sparklines; tapping switches chart + primes Trade for that symbol. Desktop can expand this into a watchlist column.
- [ ] Fake **deposit flow** works as a mobile bottom sheet with Card/Crypto/Bank/Instant tabs, quick-amount chips, keyboard-safe inputs, a processing animation, success confetti + cash sound, and wallet count-up; deposit persisted and balance increased.
- [ ] Mobile **Trade** tab supports **long/short**, USD margin with %/MAX chips, **leverage slider 1x–1000x** with live notional/size/liq-price and escalating-danger visuals; optional TP/SL; fee shown; validation enforced; desktop can expand it into an order panel.
- [ ] Placing an order deducts margin+fee, persists the position, and draws **entry + liquidation lines** on the chart.
- [ ] Mobile position cards show **live unrealized PnL & ROI% updating every micro-tick**, with rolling-digit animation, green/red flashes, heat-tinted cards, and Close / Close-50% actions. Desktop can render the same data as a table.
- [ ] A prominent **global equity/PnL ticker** aggregates wallet + positions, is the largest on-screen element, animates, and glows proportional to magnitude.
- [ ] **Liquidation** triggers correctly at the computed liq price (thrilling at 1000x), plays the REKT modal with screen-shake/red-flash, loses full margin, and records the trade.
- [ ] **TP/SL** auto-close at their triggers with correct precedence (liq > SL > TP); manual close uses current mark; wallet credited correctly; account aggregates updated (wins, high_watermark, biggest win/loss, liq count).
- [ ] **Result modal** shows on close with win-celebration or loss states, count-up PnL/ROI, sound, and confetti for wins only.
- [ ] **Share card** renders as a Binance-style PnL receipt (logo, big ROI%, symbol/side/leverage, entry/exit, referral, QR, SIMULATED watermark) and can be **downloaded as PNG, copied to clipboard, and shared** (Web Share + X intent) with graceful fallbacks.
- [ ] Mobile **History** inside the Positions tab lists closed trade cards with reason icons, colors, durations, per-trade re-share, and a sticky stats strip (win rate, total PnL, biggest win/loss, liquidations).
- [ ] Settings opens as a mobile bottom sheet and desktop drawer: display name, sound toggle, chart type, volatility mode (normal/insane), and **Reset account** with confirm.
- [ ] Sound effects via Web Audio (click/win/loss/deposit/liquidate/tick), globally toggleable, initialized on first gesture, never autoplaying.
- [ ] Money accounting is consistent: wallet never goes negative; margin committed on open and returned±PnL on close; equity math correct.
- [ ] All listed **edge cases** handled (insufficient funds, tiny prices, backgrounded-tab throttling, DB failure fallback, clipboard/share fallbacks, double-close guard, reduced-motion).
- [ ] Visual design matches the specified **dark Binance-style palette, typography (tabular numerals), spacing scale, and motion**; mobile bottom navigation, sticky account strip, chart/trade/positions surfaces, and desktop expansion all remain consistent.
- [ ] A persistent **"SIMULATION / no real money"** disclaimer is visible and present on the share card; parody name "Binunce" used throughout.
- [ ] TypeScript strict passes with no type errors; no runtime console errors during a full deposit → trade → win → share → liquidate → reset cycle.
- [ ] The experience delivers the intended **dopamine hit**: the chart never sits still, PnL swings hard and visibly, wins feel rewarding, and losses sting — all without a single real dollar.

Do not ask me any questions. Build this out end to end ready for production. Add in anything additional that you believe would be useful to have in an application like this. If you were to have any questions for me or need my input on anything just go with whatever your recommendations are. Use whatever plugins or skills you have available, like brainstorming to help you complete this build if necessary.

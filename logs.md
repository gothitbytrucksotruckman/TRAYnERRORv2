# Tray & Error — Development Log

Last updated: Oct 24, 2026

This document tracks all implemented features, active work, and planned mechanics. It is the living companion to `TRAYnERROR PRD.md` and serves as the source of truth for what exists in the codebase today.

---

## 1. Completed Features

### 1.1 Core Engine & Renderer
- **HTML5 Canvas 2D renderer** with nearest-neighbor scaling (`imageSmoothingEnabled = false`), 32px tile grid.
- **Fixed-timestep simulation** at 30 ticks/sec. Game speeds 1x, 2x, 4x scale accumulator steps and async delays.
- **Modular wall rendering:** inner wall top, outer wall bottom, side walls left/right. Side walls overlap inner walls at corners.
- **Wood floor tiles** covering a 14×10 grid.
- **Interactive camera:** drag-to-pan, mouse-wheel zoom (0.8x–4.5x), double-click recenter.
- **Outer wall transparency:** fades to 35% opacity when any robot is behind it, togglable via settings checkbox.

### 1.2 Restaurant Layout
- **6 tables:** 4 small (2-seat) and 2 vertical long (4-seat), arranged with wall spacing.
- **Entrance tile** at left wall `(0, 4)`.
- **Kitchen pickup counter** at right wall `(13, 4)` with stove icon (🍳 idle / 🔥 cooking).
- **Charger station #1** at `(1, 0)` for Waiter Robot #1.
- **Charger station #2** at `(2, 0)` for Hired Waiter Robot #2 (visible only when hired).
- **Ready dish counter** with red badge showing unclaimed dish count.

### 1.3 Robot Waiter #1
- **4-directional BFS pathfinding** with strict Manhattan movement and obstacle avoidance (tables, chairs).
- **4-directional sprite rendering** using `front-view.png`, `back-view.png`, `left-side-view.png`, `right-side-view.png`.
- **Battery system:** drains during movement, recharges at charger station. Drain rate halved with battery upgrade.
- **Tray system:** carries 1 dish (upgradable to 2 with Double Tray Module).
- **0.7s order delay** when taking orders at a table.
- **Waiter Terminal** with Run, Pause/Resume, Step, Stop controls.

### 1.4 Hired Waiter Robot #2
- **Purchasable** from Shop for $320.
- **Cyan-tinted sprite** via `hue-rotate(160deg) saturate(1.4)` CSS filter.
- **Independent terminal** (`win-waiter2`) with full Run/Pause/Step/Stop and line-by-line execution highlight.
- **Shared API factory** (`createWaiterAPI`) generates per-robot APIs keyed to correct robot state, charger, and interrupt flag.
- **Atomic `claim(dish)`:** returns `true` only for the first robot to call it, preventing plate contention.
- **Concurrent race check** on `take_order()`: if two robots approach the same table, only the first succeeds.

### 1.5 Chef Terminal
- **Dual operation mode:** automatic background cooking when idle (`chefMode: 'auto'`), manual Python scripting when run (`chefMode: 'scripted'`).
- **Recipe cards** in Recipes tab: Omelette ($10), Pancake Stack ($12), Midnight Ramen ($16).
- **Ticket processing:** `tickets()`, `next_ticket()`, `grab()`, `cook()`, `plate()`.
- **Stove visual feedback:** icon switches between 🍳 and 🔥 based on cooking state.
- **Independent script runner** with execution highlighting.

### 1.6 Python-to-JS Transpiler & Script Runner
- **Async sandboxed transpiler** converting Python syntax (`while True:`, `if/elif/else`, `for`, function calls, variable assignment) to async JS functions.
- **Loop execution watchdog:** every transpiled loop iteration awaits a macrotask and checks a per-runner generation token, so runaway loops cannot freeze the browser.
- **Zombie-run cancellation:** Stop or a new Run bumps the runner's generation; any still-in-flight loop from the previous run aborts instead of racing the new one.
- **Line-by-line execution highlighting** via `Runner.setLine(lineNum)` injection, synced with textarea scrolling at 20px line height.
- **Per-terminal `ScriptRunner` class** with configurable API, editor, highlight, status, and interrupt key.
- **Tab key indentation** (4 spaces) and scroll-sync for all code editors.

### 1.7 Customer System
- **4 archetypes:** Regular (patience: 85, tip: $2), Businessman (patience: 55, tip: $5), Critic (patience: 45, tip: $7), Night Owl (patience: 70, tip: $4, night-only).
- **Party spawning:** 11–18s base interval, 7–11s during rush hours. Cap of 4 waiting parties.
- **Party sizes:** 65% chance of 2-person, 35% chance of 4-person.
- **Customer lifecycle:** arrive → wait at door → seated → thinking (3s) → order ready → order taken → waiting for food → eating (12s) → pay & leave.
- **Contextual complaints:** plain-language messages for seating delays (*"Nobody seated us!"*), food delays (*"Where is our food?!"*), and stock failures (*"Out of stock!"*).
- **Customer emotes:** 💭 (thinking), 📝 (ready to order), ⏳ (waiting for food), 😠 (impatient), 🍽️ (eating).

### 1.8 Day/Night Cycle & Rush Hours
- **24-hour clock** with configurable day length (default 600s real time = 24 game hours).
- **4 rush hour periods:** Breakfast (7:30–9:30), Lunch (12:00–14:00), Dinner (18:00–20:30), Late Night (23:00–1:30).
- **Rush hour HUD banner** with animated glow badge.
- **Night detection** (`isNight()`: 20:00–06:00) for menu switching and customer archetype filtering.
- **Night atmosphere rendering:** dark overlay (`rgba(10, 15, 30, 0.38)`) with warm radial lamp glow over each table and kitchen stove.

### 1.9 Economy & Balance (Rebalanced Oct 20)
- **Starting cash:** $50.
- **Daily rent:** $35.
- **Menu prices (revenue nerfed):**
  - Day: Sunny Toast $8, Omelette $10, Pancake Stack $12.
  - Night: Black Coffee & Pie $12, Midnight Ramen $16.
- **Tips:** $2–$7 per archetype. Seat bonus: +$1/seat.
- **Typical table bill:** $11–$24.
- **Ingredient restock:** $20 for 10 portions.
- **Reputation:** 1.0–5.0 stars, boosted by successful service, penalized by complaints.
- **Central `BalanceConfig` object** for all tunable values.

### 1.10 Shop & Upgrades (Prices raised Oct 20)
| Upgrade | Cost | Effect |
| --- | --- | --- |
| Ingredients Restock (+10) | $20 | Adds 10 stock portions |
| Fast Servos | $140 | Robot moves 50% faster |
| High-Capacity Battery | $180 | Battery drain halved |
| Double Tray Module | $240 | Carry 2 dishes (both robots) |
| Hire Waiter Robot #2 | $320 | Deploys cyan unit with own terminal |

### 1.11 Achievements System
- **7 achievements** with progress tracking, progress bars, and unlock notifications:
  - 🌱 First Shift — serve 5 parties.
  - 📦 Stockpile Specialist — store 30+ portions.
  - 🦉 Night Owl — serve 3 night customers.
  - ⭐ Five-Star Standard — reach 5.0 reputation.
  - 🤖 Automation Fleet — hire Waiter #2.
  - 💰 Profitable Kitchen — accumulate $500 cash.
  - ⚡ Speed Demon — buy Fast Servos.
- **No cash rewards.** Achievements are purely milestone-based trophies.
- **Gold highlight + Locked/Unlocked badges** with animated progress bar fill.
- **Persisted in save data.**

### 1.12 Save/Load & Persistence
- **Autosave** every 60 seconds real time + on day rollover.
- **Manual save** from Settings modal.
- **Data persisted:** cash, reputation, day, time, stock, all upgrades, hired waiter flag, totalServed, totalNightServed, achievement unlock states, all terminal code.
- **Account-scoped keys:** player and developer saves are stored separately (`traynerror_savedata_player`, `traynerror_savedata_dev`); the legacy single-key save migrates into the player account.
- **Load** restores UI state (disabled shop buttons, waiter #2 HUD visibility).
- **Reset save** with confirmation dialog; resets only the active account's save.

### 1.13 Audio
- **Web Audio API synth** (no external audio files needed).
- **Sound effects:** beepServe (seating/delivery), beepPay (payment), beepComplaint (complaints), beepCharge (recharge complete).
- **Volume slider** in Settings modal.

### 1.14 UI & Windows
- **Main menu** with Start Game, Load Game, Settings buttons, plus a hidden bottom-right developer-account button.
- **Two accounts:** Player (default, empty editors) and Developer (default scripts pre-filled, separate save).
- **HUD bar:** reputation stars, cash, day counter, game time, battery %, rush hour badge.
- **Draggable window panels** for Waiter, Waiter #2, Chef, Shop, Achievements, Settings.
- **Tab system** per terminal: Code, Log, API/Recipes.
- **Speed controls:** Pause, 1x, 2x, 4x with active state highlighting.

### 1.15 Special Request Handling
- **Chef-side validation:** `handle_note(ticket)` marks a ticket's note as handled before plating.
- **Ignored-note consequences:** if a noted order is served without `handle_note()`, the customer complains in plain language, the tip is forfeited, and reputation drops 0.3 (0.5 for Critics).
- **Auto-chef fallback** marks every plated dish as note-handled.
- **Five complaint strings** mapped per request in `src/mechanics.js`.

### 1.16 Firmware Shop & Code Storage
- **Firmware unlocks:** `nearest_table(status)` ($50) and `order_stock(qty)` ($85), persisted in saves.
- **Locked-call guard:** calling locked firmware logs a plain-language warning and returns `null` / `false` instead of crashing.
- **`nearest_table()`** resolves the closest `"free"`, `"order"` or `"served"` table from the calling robot's position.
- **`order_stock()`** buys portions from code at $2 each, using the same stock as manual restock.
- **Code storage:** one shared 25-line budget applied to every terminal (comments/blanks free), enforced before Run. RAM Expansion adds 15 lines for $80 (repeatable).
- **Shop affordability:** buy buttons grey out automatically when cash is below the listed price, and re-enable when the player can afford them.

### 1.17 Handbook Window
- **Dedicated draggable window** opened from `📖 Handbook` in the HUD.
- **4 pages:** Terminal Basics, Waiter Robot, Chef & Special Requests, Firmware & Fleet.
- **Prev / Next navigation** with page counter.
- Waiter terminal keeps a compact API cheat-sheet tab; chef keeps recipe cards.

### 1.18 Robot Wear & Repair
- **Wear:** each grid tile moved costs 0.4 durability (`BalanceConfig.wearPerTile`).
- **Degradation:** at 20% health or below, movement speed drops 40%.
- **API:** `health()` returns 0–100; `repair()` walks to the charger, takes 4s, and restores full health.
- **Repair cost:** $15 during day, $5 at night (`BalanceConfig.repairCostDay/Night`). Full-health calls are free no-ops; insufficient cash fails cleanly.
- **HUD:** `DUR` gauge turns red at 20% or below.
- **Persistence:** both robots' health saved and restored.
- **Default scripts (developer account only):** all three editor scripts check `health() < 20` and call `repair()`, staying within the 25-line budget. Player editors ship empty.
- **Transpiler:** `repair` is in the async-call list, so the script actually waits for the charger trip and repair timer.

### 1.19 Script Runner Freeze & Zombie Loop Fix (Oct 20)
- **Generational run guard:** `State.scriptGen[interruptKey]` increments on every Run/Stop. Transpiled loop headers call `Runner.cancelled(gen)` and break when superseded, killing the old ghost loop instead of running two scripts on one robot.
- **Macrotask yield:** each loop iteration awaits `Runner.tick()` (a 0ms `setTimeout`). A user script whose calls all fail synchronously (for example `seat()` on an occupied table, `repair()` without cash) can no longer starve the event loop and brick the UI.
- **Async helpers honour cancellation:** `robotMoveTo()`, `scriptWait()`, `sleepTick()`, `go_charge()`, `repair()`, `seat()`, `take_order()` and `deliver()` capture the run generation and bail on mismatch, so a cancelled robot stops mid-walk.
- **Chef interrupt key fixed:** `cook()` and `wait()` now use `chefScriptInterrupt`, so the Chef Stop/Pause controls actually take effect; `chefScriptPaused` added.
- **Race guards:** `take_order()` re-checks occupancy after the 0.7s delay (previously a customer walking out crashed the script), `seat()` re-checks the table and returns the party to the queue if cancelled, `deliver()` releases a claimed dish back to the counter on cancellation and discards it if the table emptied.

### 1.20 In-Terminal Debugger (Oct 24)
- **Breakpoints:** click a line number in the gutter to toggle a red breakpoint dot; the transpiled runner pauses right before that line.
- **Transpiler hook:** every statement now awaits `Runner.checkLine(line)`, which updates the highlight, handles stepping and breakpoints, and waits while paused. Loop headers keep `Runner.tick()` and the generation guard.
- **Live watch panel:** collapsible panel on the right of each code tab shows local variables (captured via transpiled `Runner.snapshot({...})`) plus robot `battery`, `health`, `tray` (chef shows `stock` and `tickets`).
- **Auto-expand / collapse:** the panel opens itself on a breakpoint or Step and collapses to a narrow strip via the ◂ / ▸ button.
- **Step:** Step resumes exactly one transpiled line, refreshes the watch panel, and pauses again.

### 1.21 Table Reservations (Oct 24)
- **Bookings:** one table at a time is reserved every ~90s for a party matching its seat count, arriving after a ~25s countdown with a tent-card badge on the canvas. Walk-in arrivals slow by 35% per active hold so the floor never shrinks to a couple of free tables.
- **API:** `free_tables()` skips reserved tables; `is_reserved(table)` reports a hold; `waiting_parties()` exposes `is_reserved` and `table` for booked guests.
- **Seating rules:** only the booked party may take its table. Seating a walk-in on a reserved table despawns both parties, clears the booking, logs a plain-language complaint and costs 0.6 reputation.
- **Timeouts:** a reserved party that waits 45s clears its hold and leaves.

### 1.22 Refund System (Oct 24)
- **Triggers:** ignored special request, wrong dish delivered, or a party walking out while waiting for food.
- **Effect:** the menu price is deducted from cash (can go negative with a warning), no payment is collected, and the refund is logged as a complaint.
- **Wrong-dish tracking:** `deliver()` flags a mismatch between the ticket dish and the table's order.

### 1.23 Player & Developer Accounts (Oct 24)
- **Player account is the default.** Opening the game boots into the player account; all three code editors start empty so the player writes their own programs from zero.
- **Hidden developer entry.** A near-invisible dot button (`#btn-dev-login`) sits in the bottom-right corner of the title screen. Clicking it enters the developer account with `DEV_DEFAULT_SCRIPTS` pre-filled in all three editors (waiter, chef, waiter #2), ready to Run immediately.
- **Dev defaults stay inside the code budget:** 21 waiter lines, 13 chef lines, 21 waiter #2 lines (comments/blanks free, 25-line limit). Verified by `tests/accounts.test.js`.
- **Separate saves per account:** `traynerror_savedata_player` and `traynerror_savedata_dev`, resolved by `SAVE_KEY(State.account)`. Test edits never overwrite player progress. The legacy `traynerror_savedata` key migrates once into the player account.
- **Dev visibility:** `DEV` badge in the HUD while in the developer account.
- **Autosave gating:** autosave (60s and day rollover) only runs after the game is started (`State.started`), so sitting on the title screen no longer overwrites a save with default state.

### 1.24 Dynamic Tutorial (Oct 24)
- **Player-account only.** Developer account never sees tutorial cards, so test scripts run uninterrupted.
- **11 milestones:** welcome, first customer, first ready order, first plated dish, low battery (≤40%), low wear (≤60%), first payment, night shift, chef terminal opened, table reservation, Waiter #2 hired.
- **World pause:** opening a card sets `State.isPaused`, restoring the previous pause state on close; HUD speed buttons re-sync. A 6s cooldown separates cards.
- **Card window:** a draggable, minimizable panel like the terminals, so the player can keep reading while editing code. Closing it resumes the world (or keeps the player's own pause choice); seen cards can be reopened from Handbook → Tutorial Reference.
- **Pacing:** first party is delayed 45s, spawns run at half rate until the first payment, each card buys 25 quiet seconds, and a card never interrupts someone typing in an editor. Welcome card explains ⏸ / 1x / 2x / 4x and that pausing is safe.
- **Card content:** situation explanation, API list, copyable Python snippet. "Don't show tutorials again" opt-out.
- **Trigger + persistence:** `Mechanics.nextTutorial()` picks the first uncompleted milestone whose trigger holds; `tutorialCompleted` / `tutorialsDisabled` persist in player save data. Handbook gained a 5th Tutorial Reference page.
- **Verified by** `tests/mechanics.test.js` (milestone ordering and once-only behaviour).

---

## 2. In Development

*No features are actively in development at this moment. The codebase is stable and ready for the next planned feature.*

---

## 3. Planned Features

Features listed below are sourced from the PRD and design discussions. Priority order is approximate; items will be added and reordered as development continues.

### 3.1 High Priority (Prototype Scope)

| Feature | PRD Section | Notes |
| --- | --- | --- |
| Firmware Shop & API Unlocks | §9 | ✅ `nearest_table()` ($50), `order_stock()` ($85), RAM Expansion (+15 lines, $80). |
| Special Request Handling | §7, §8 | ✅ `handle_note(ticket)`; ignored notes forfeit tip and cost reputation. |
| Handbook Pages | §10 | ✅ 4-page Handbook window (basics, waiter, chef, firmware). |

### 3.2 Medium Priority (Should / Polish)

| Feature | PRD Section | Notes |
| --- | --- | --- |
| ~~Table Reservations~~ | §7 | ✅ Booked parties arrive after a countdown; `is_reserved(table)`, `free_tables()` skips holds, walk-in theft loses both parties. |
| ~~Step-Through Debugging Enhancement~~ | §5, §10 | ✅ Gutter breakpoints plus collapsible live variable watch panel. |
| More Customer Archetypes | §7 | Family (group with child, may order toys), Shift Worker, Mystery Regular. |
| Obstacle Avoidance (spills) | §6 | Dynamic floor obstacles that block pathfinding temporarily. |
| ~~Refund System~~ | §7 | ✅ Menu price refunded on ignored notes, wrong dishes or walkouts. |

### 3.3 Low Priority (Later / Final Version)

| Feature | PRD Section | Notes |
| --- | --- | --- |
| Replay & Ghost System | §11 | Deterministic replay of shifts, ghost overlays of top players' runs. |
| Daily Challenge Seeds | §11 | Shared seed for competitive scoring on revenue/time/line count. |
| Code-Golf Scoring | §11 | Rank solutions by line count or instruction budget. |
| Sandbox Shifts | §11 | Practice shifts without risking save data. |
| Script Sharing & Import | §11 | Share/import player scripts (requires sanitization). |
| Random Events | §18 | Blackout, health inspector visit, delivery delays. |
| Night Visibility & Power Tariff | §4 | Reduced vision radius at night, cheaper power costs. |
| Modular Robot Parts | §18 | Swappable wheels, arms, trays, sensors. |
| Restaurant Tiers & Ending | §18 | Small cafe → flagship progression with final inspection event. |
| Accessibility Options | §18 | Colorblind mode, font size scaling, localization. |

---

## 4. Economy Balance History

| Date | Change | Reason |
| --- | --- | --- |
| Oct 19 | Initial economy: $150 start, $14–$28 dish prices, $60–$120 upgrades | First playable build |
| Oct 20 | Rebalanced: $50 start, $8–$16 dish prices, tips $2–$7, upgrades $140–$320, rent $35 | Revenue too easy, upgrades felt unrewarding |

---

## 5. File Reference

| File | Purpose |
| --- | --- |
| `index.html` | DOM structure, canvas viewport, HUD, all draggable window containers |
| `style.css` | Pixel-art styling, day/night gradients, window styles, achievement cards, execution highlight |
| `src/game.js` | Core simulation loop, renderer, pathfinder, customer state machine, Chef/Waiter APIs, transpiler, script runner |
| `src/mechanics.js` | Pure helpers: nearest-table selection, code-line counting, special-request checks and complaint text |
| `tests/mechanics.test.js` | Assert-based checks for `src/mechanics.js` (`node tests/mechanics.test.js`) |
| `tests/accounts.test.js` | Assert-based checks for account defaults, editor emptiness and dev entry (`node tests/accounts.test.js`) |
| `TRAYnERROR PRD.md` | Full game design document and requirements specification |
| `logs.md` | This file — development progress tracker |
| `assets/restaurant/` | Wall, floor, and furniture pixel art sprites |
| `assets/robot-waiter/` | 4-directional robot sprites |
| `assets/gui/` | Menu buttons and title logo |

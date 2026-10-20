# Tray & Error — Development Log

Last updated: Oct 20, 2026

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
- **Loop execution watchdog** to prevent infinite loops from freezing the game.
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
- **Load** restores UI state (disabled shop buttons, waiter #2 HUD visibility).
- **Reset save** with confirmation dialog.

### 1.13 Audio
- **Web Audio API synth** (no external audio files needed).
- **Sound effects:** beepServe (seating/delivery), beepPay (payment), beepComplaint (complaints), beepCharge (recharge complete).
- **Volume slider** in Settings modal.

### 1.14 UI & Windows
- **Main menu** with Start Game, Load Game, Settings buttons.
- **HUD bar:** reputation stars, cash, day counter, game time, battery %, rush hour badge.
- **Draggable window panels** for Waiter, Waiter #2, Chef, Shop, Achievements, Settings.
- **Tab system** per terminal: Code, Log, API/Recipes.
- **Speed controls:** Pause, 1x, 2x, 4x with active state highlighting.

---

## 2. In Development

*No features are actively in development at this moment. The codebase is stable and ready for the next planned feature.*

---

## 3. Planned Features

Features listed below are sourced from the PRD and design discussions. Priority order is approximate; items will be added and reordered as development continues.

### 3.1 High Priority (Prototype Scope)

| Feature | PRD Section | Notes |
| --- | --- | --- |
| Firmware Shop & API Unlocks | §9 | Progressive command unlocks: `nearest_table()` ($50), `order_stock()` ($85), code storage line limit upgrades. Extends Shop panel. |
| Handbook Pages | §10 | 3–5 in-game Python lesson pages unlocked by restaurant progression. Teaches variables, loops, functions, lists. |
| Special Request Handling | §7, §8 | Chef terminal interprets `ticket.note` strings (e.g. "no onions"). Wrong interpretation triggers specific complaint. |

### 3.2 Medium Priority (Should / Polish)

| Feature | PRD Section | Notes |
| --- | --- | --- |
| Table Reservations | §7 | Booked parties arrive at set times. Waiter code must hold tables with `is_reserved(table)`. |
| Code Storage Limits | §9 | Per-terminal line cap, upgradable in shop. Rewards concise code. |
| Step-Through Debugging Enhancement | §5, §10 | Current step button exists but could be improved with breakpoints and variable watch. |
| More Customer Archetypes | §7 | Family (group with child, may order toys), Shift Worker, Mystery Regular. |
| Obstacle Avoidance (spills) | §6 | Dynamic floor obstacles that block pathfinding temporarily. |
| Refund System | §7 | Wrong orders trigger partial refunds; complaint severity determines refund amount. |
| Robot Wear & `repair()` | §6 | Wear accumulates over time, `repair()` call takes robot offline. Cheaper during quiet hours. |

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
| `TRAYnERROR PRD.md` | Full game design document and requirements specification |
| `logs.md` | This file — development progress tracker |
| `assets/restaurant/` | Wall, floor, and furniture pixel art sprites |
| `assets/robot-waiter/` | 4-directional robot sprites |
| `assets/gui/` | Menu buttons and title logo |

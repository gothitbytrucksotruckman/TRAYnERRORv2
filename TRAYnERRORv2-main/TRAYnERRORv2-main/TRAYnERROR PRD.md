# Tray & Error — PRD v1.1

Oct 12, 2026 · @Rangga Arsandy
Updated Oct 20, 2026 · Prototype implementation status synced with `logs.md`

## 1. Vision and design pillars

Tray & Error is a programming-and-management game where the player writes Python to run a 24-hour restaurant staffed by robots. It takes the "program your worker" idea from The Farmer Was Replaced and adds people: customers with moods, requests and complaints, and two robots (waiter and chef) that must cooperate through code.

Four pillars guide every decision:

1. **Code is the gameplay.** Doing a job by hand never beats automating it.
2. **Customers are people, not crops.** They vary and surprise, so a lazy script that worked yesterday can fail today.
3. **Idle never wins.** A static script slowly loses reputation and money as the restaurant grows.
4. **Learn by doing.** Every system teaches a Python concept, and an in-game handbook explains it when it unlocks.

## 2. Target players

The game serves complete beginners and experienced programmers at the same time, as The Farmer Was Replaced does.

| Player | What they need | How the game serves them |
| --- | --- | --- |
| Beginner | A gentle start and readable errors | Low customer volume early, in-game handbook and recipe cards, 1x speed, complaint log as plain-language hints |
| Experienced | Depth and a ceiling to chase | 4x speed, code storage limits, optimization targets, leaderboards, advanced Python unlocks |

The handbook (guide books) teaches each Python concept at the moment the restaurant needs it.

## 3. Phases and scope

Development has two stages: a web prototype built in one week (deadline Sunday 25 October 2026) by a team of 8, then a final version in Unity or Godot.

| Phase | Goal | Contents |
| --- | --- | --- |
| Prototype (web, 1 week) | Prove the core loop: write code, watch it run, read complaints, improve | Runtime, waiter terminal, seating and delivery, chef terminal, hired waiter #2, complaint log, day/night, speed control, achievements |
| Final (Unity/Godot) | Full game | Full chef terminal, reservations, refunds, firmware shop, code limits, replay features |

The full feature list is larger than a 1-week build. Section 13 sorts every feature into Must, Should and Later.

## 4. Core loop and time

The restaurant never closes: robots do not sleep, so it runs 24 hours a day, and one full day lasts 10 real minutes at 1x speed. The length of a day is a config value, not a hardcoded constant.

| Speed | Real time per day | One game hour | Night (12 h) |
| --- | --- | --- | --- |
| 1x | 10 min | 25 s | 5 min |
| 2x | 5 min | 12.5 s | 2.5 min |
| 4x | 2.5 min | about 6 s | about 1.25 min |

The player's loop: write or fix code, press Run, watch the robots work, read the complaint log, and improve the code. Pausing freezes the whole world, so thinking costs nothing, and all scoring and timers use game time.

**Night works like day.** There is no forced downtime and no separate management phase. Night differs through its customers and menu, and in the final version through lower visibility and a cheaper power tariff.

- Night customers: night owls, shift workers, sleepy customers with garbled orders, mystery regulars with rare orders.
- Night-only menu items, readable in code through `is_night()`.
- Prototype scope: day/night tint, `is_night()`, night-only menu items (Black Coffee & Pie, Midnight Ramen), warm table/stove lighting overlay during night hours, and Night Owl archetype.

**Mini-cycles inside the day.** Meal rushes (breakfast, lunch, dinner, a late-night peak) and costs charged per game hour give a rhythm every couple of minutes, since a playtest session at 1x only covers a few days.

## 5. Code runtime and controls

Players write full Python syntax and logic with no imports; the game supplies the robot API and shared objects, and nothing reaches outside it (no file, network or system access).

Original syntax or game-specific logic is allowed only where it cannot confuse a player, and every existing Python rule must keep working with the game.

**Controls (per terminal).** All three terminals (Waiter, Chef, Hired Waiter #2) share the same control layout.

| Control | Effect |
| --- | --- |
| Run | Starts the script from line 1 |
| Pause / Resume | Freezes the script and the whole world; resuming continues from the same point |
| Stop | Ends the script; the world keeps running, so an idle robot costs the restaurant |
| Step | Runs one action at a time when paused, or starts in stepping mode |

**Rules**

- Edits apply on the next Run. The player pauses, edits, then presses Stop and Run. The script restarts from line 1, and the robot keeps its physical state (for example, still carrying a tray).
- Robot actions take game time, so a script pauses at each action such as `move()` and resumes when the action finishes.
- A watchdog stops infinite loops from freezing the game: if a script runs too long in real time without an action, it is interrupted and the log says so in plain language. In the final version this becomes an instruction budget per game tick, which the processor upgrade raises.
- The simulation uses a fixed timestep. At 2x and 4x it runs more steps per frame, so a script behaves identically at every speed.
- A `wait(seconds)` function is available so players do not busy-loop.
- Errors show as friendly messages in the terminal and in the event log, with the line number.

**Debug tools:** step-through (implemented), line-by-line execution highlighting (implemented), event log (implemented), slow motion, and a recorder of the last 30 seconds before a failure (final version).

## 6. Robots and terminals

The restaurant has two robot roles, the waiter and the chef, and every robot, including each one the player later hires, has its own terminal and its own script.

| Robot | Job | Terminal | Prototype Status |
| --- | --- | --- | --- |
| Waiter | Seat customers, take orders, send tickets to the kitchen, carry food from the counter to the table | Waiter terminal | ✅ Implemented |
| Chef | Cook each ticket step by step with the right ingredients, plate it at the counter | Chef terminal | ✅ Implemented (auto-cook fallback + scripted mode) |
| Hired Waiter #2 | Extra waiter sharing the floor, cyan-tinted | Waiter #2 terminal | ✅ Implemented (purchasable for $320) |
| Additional hired waiters | Further extra waiters | One terminal per hired robot | Later |

**Order lifecycle**

1. Customers arrive and wait for a seat.
2. The waiter seats the party at a fitting table.
3. The waiter takes the order, including any special request, and sends the ticket to the kitchen.
4. The chef cooks the ticket and plates it at the counter.
5. A waiter claims the dish and delivers it to the right table.
6. Customers eat, pay and leave, or complain.

**Robot stats and upkeep**

- Battery is finite. Charging costs time away from the floor, so it is a trade-off and not a chore.
- Wear builds up, and a `repair()` call takes the robot out of service for a while. Repairs are cheaper in quiet hours.
- Upgradable stats: battery life, speed, tray capacity, endurance, processor (instruction budget), and looks.
- Each terminal has its own code storage limit, so one robot cannot starve another.
- Hiring extra waiters is capped early and costs real money. The counter is shared, so waiters use `claim(dish)`, which returns `True` only for the first robot that calls it. **Prototype note:** Waiter #2 costs $320 and uses atomic `claim(dish)` plus a concurrent race check on `take_order()` to prevent contention.

Obstacles such as spills and other customers can block paths in the final version.

**Robot appearance.** The robot has a rectangular body and a very simple face, so the design team can draw it quickly. It is pixel art at 32 pixels and is delivered as a character sheet showing the robot from several views and angles.

## 7. Customers

Customers are the main source of variety and pressure. There is no visible patience timer, because players spend most of their time typing and debugging; a hidden wait time exists, and slow service shows up only as complaints and lost reputation.

**Archetypes** are customer types with their own behavior rules, so code cannot treat everyone the same. Each one is effectively a new `if` branch for the player.

| Archetype | Behavior | Prototype |
| --- | --- | --- |
| Regular | Patient, modest tip | ✅ patience: 85, tip: $2 |
| Businessman | Orders fast, wants quick service | ✅ patience: 55, tip: $5 |
| Critic | Picky, one mistake hits reputation hard | ✅ patience: 45, tip: $7 |
| Night owl | Odd orders at night, tips well | ✅ patience: 70, tip: $4, night-only |
| Family | A group with a child, may order toys | Later |

**Groups and parties.** Parties of different sizes arrive together and place split orders, which teaches lists.

**Seating.** The waiter's code must match each party to a table with enough seats, and must not give away a reserved table. This teaches matching and packing.

**Reservations.** Booked parties arrive at set times, so the code must hold tables ahead (final version).

**Special requests as strings.** An order can carry a note such as "no onions, extra ice". The waiter reads the note and attaches it to the ticket, and the chef's code interprets it when cooking.

**Orders beyond the menu.** Customers can also ask for desserts, toys and other miscellaneous items, not only the standard dishes.

**Complaints, refunds and reputation.** A wrong order, a wrong table, a long wait or a bad dish produces a complaint. Complaints lower the reputation stars, and some trigger a refund (refunds are final-version scope). Reputation unlocks better customers and menu tiers, and customer volume rises with it.

**Rush hours.** Meal rushes raise arrival rates at set hours, so hardcoded timing breaks.

## 8. Kitchen, recipes and stock

Every dish is a recipe, and every recipe is a step-by-step procedure the player writes in the chef terminal. A new dish or ingredient means the chef's program must be updated before the dish pays off.

```python
def make_omelette(ticket):
    if not grab("egg", 2):
        return False          # out of eggs: the code decides what to do
    crack_into_bowl()
    whisk()
    heat("pan", 180)
    pour_and_cook(60)
    plate(ticket)
```

This teaches functions (one per dish), parameters (quantities and times), order of operations, and branching on special requests such as `if ticket.note == "no onions"`. Later, players can optimize by cooking on several stations in parallel.

**Recipe cards.** Unlocking a menu item also unlocks a recipe card in the handbook listing the steps. The player's job is to turn the card into code.

**Wrong recipe, clear hint.** A badly cooked dish produces a complaint that points at the mistake, such as "my omelette was raw" or "the soup was cold".

**Stock is manual.** The player buys and restocks ingredients by hand from a shop panel, and no robot handles it. There is no spoilage.

- Code can read stock with `stock("egg")` but cannot buy it, so the waiter can stop offering sold-out dishes and the chef can skip tickets it cannot cook.
- `grab("egg")` returns `False` when the ingredient is out of stock, and the script keeps running; the player's code decides whether to skip, substitute or flag it.
- A recipe that fails halfway loses the ingredients already taken, so checking stock before starting is a real optimization.
- The shop offers bulk buying and a low-stock warning so restocking stays a decision and not a chore at 4x speed.
- Optional later reward: a firmware unlock such as `order_stock()` that automates restocking.

## 9. Economy, upgrades and firmware

Revenue from satisfied customers funds two competing upgrade paths, so the player must decide whether to grow the restaurant or the robots. More tables and menu items mean more code to write, while faster robots leave less room for sloppy code.

| Path | Upgrades | Prototype Status |
| --- | --- | --- |
| Restaurant | Menu variety, table count, restaurant size and layout, kitchen stations | Later (menu and tables exist but are not purchasable) |
| Robot | Battery life, speed, tray capacity, endurance, processor, looks | ✅ Fast Servos ($140), Battery ($180), Double Tray ($240) |
| Staff | Hire extra waiters, each with its own terminal | ✅ Waiter #2 ($320) |

**Firmware unlocks.** Progression equals getting new commands. API functions are bought in the shop, so each unlock gives the player a new capability to program with. Python concepts (functions, lists, dicts, classes, recursion) unlock tied to restaurant needs, and the handbook teaches each one. **Prototype status:** ✅ `nearest_table(status)` ($50), `order_stock(qty)` ($85), RAM Expansion (+15 lines, $80).

**Code storage limit.** Each terminal has a line limit that can be upgraded, which rewards short, reusable code.

**Running costs.** Rent ($35/day), ingredients ($20/restock) and upkeep are charged per game day, so a static script slowly loses money as volume grows. The upgrade shop opens at any time.

The shop's prices, costs and customer volume all live in one central `BalanceConfig` object so the team can tune them quickly. See `logs.md` §4 for balance change history.

## 10. Feedback and teaching

The game teaches through consequences: customers' complaints double as the error log, so players learn what broke by reading how the restaurant reacted.

- **Complaint log as error feedback.** Complaints read like customer remarks but hint at the bug: "Table 3 waited forever" (seating or delivery too slow), "I got someone else's dish" (wrong table), "my omelette had no egg" (unchecked `grab()`). **Prototype status:** ✅ Implemented with contextual plain-language complaints and customer emotes (💭📝⏳😠🍽️).
- **Handbook and recipe cards.** Short Python lessons unlock when the restaurant needs them, written for beginners with analogies and examples. **Prototype status:** Recipe cards implemented; 4-page Handbook window implemented (basics, waiter, chef, firmware).
- **Event log and friendly errors.** Plain-language messages with line numbers, plus a log of every robot action. **Prototype status:** ✅ Implemented.
- **Step-through and slow motion.** Players can watch a script run one action at a time. **Prototype status:** ✅ Step button implemented; slow motion planned.
- **Black-box recorder (final version).** Replays the last 30 seconds before a failure.
- **Achievements.** Milestone-based progression trophies with no cash rewards. **Prototype status:** ✅ 7 achievements implemented with progress bars and unlock notifications. See `logs.md` §1.11 for full list.

## 11. Replayability

After the main progression, replay features give experienced players a ceiling to chase. All of them depend on the deterministic fixed-timestep simulation and on scoring in game time.

- **Daily challenge seed.** Everyone plays the same shift and is scored on revenue, time or fewest lines of code.
- **Ghost replays.** Watch a top player's robots run the same shift.
- **Code-golf scoring.** Rank solutions by line count or instruction use.
- **Sandbox shifts.** Test code on a practice shift without risking the save.
- **Share and import scripts** between players (future).

## 12. API reference (draft)

This draft lists the functions each terminal can call. Names and signatures are proposals to settle before the first sprint, and the API spec must stay independent of the engine so it carries over to Unity or Godot.

**Waiter terminal**

| Function | Purpose |
| --- | --- |
| `waiting_parties()` | Parties waiting at the door, with size and archetype |
| `free_tables()` | Tables that are free and not reserved, with seat counts |
| `seat(party, table)` | Lead a party to a table |
| `take_order(table)` | Get the order and any special request note |
| `send_to_kitchen(order)` | Post a ticket to the chef |
| `ready_dishes()` | Dishes waiting at the counter |
| `claim(dish)` | Reserve a dish; `True` only for the first robot to call it |
| `deliver(dish, table)` | Carry a claimed dish to a table |
| `stock(item)` | Read stock level |

**Chef terminal**

| Function | Purpose |
| --- | --- |
| `tickets()` / `next_ticket()` | Read pending tickets |
| `grab(item, qty)` | Take ingredients; `False` if out of stock |
| `heat`, `whisk`, `chop` and similar | Recipe steps (set depends on unlocked firmware) |
| `plate(ticket)` | Put the finished dish at the counter |
| `stock(item)` | Read stock level |

**Shared by every terminal:** `battery()`, `repair()`, `go_charge()`, `wait(seconds)`, `is_night()`, `time()`.

Most functions beyond the basics are firmware unlocks bought in the shop.

Alongside `battery()`, code can read `health()`, so a script can decide when to recharge or repair.

**Tray.** Tray capacity limits how many dishes a waiter can hold: it can claim up to that many before delivering. A draft function, `tray()`, lists what the robot is carrying.

## 13. Prototype scope, team and milestones

The prototype ships only the Must items, which are enough to play the whole core loop. Should items follow if time allows, and everything else waits for the final version.

**Status.** The previous week went mainly into art and asset preparation. The code build starts Monday 19 October 2026 with the day-1 spike described in section 14. The deadline is Sunday 25 October, and the target is to finish by Saturday 24 October, so the plan below covers 7 days.

| Priority | Features |
| --- | --- |
| Must | ~~Code editor and interpreter~~ ✅; ~~Run / Pause / Stop~~ ✅; ~~fixed-timestep simulation~~ ✅; ~~game speed 1x / 2x / 4x~~ ✅; ~~waiter terminal~~ ✅; ~~seating and delivery~~ ✅; ~~customer arrival and orders with a hidden wait time~~ ✅; ~~2-3 archetypes~~ ✅ (4 implemented); ~~reputation stars~~ ✅; ~~complaint log~~ ✅; ~~battery~~ ✅; ~~day/night tint with `is_night()`~~ ✅; ~~2-3 upgrades~~ ✅ (4 upgrades); ~~central balance config~~ ✅; ~~main menu with Start Game, Load Game and Settings~~ ✅; ~~autosave~~ ✅; ~~asset manifest with placeholder art and audio~~ ✅ |
| Should | ~~Chef terminal with 2-3 simple recipes~~ ✅; ~~special requests as strings~~ ✅ (40% chance on orders, chef must call `handle_note`); ~~manual stock panel~~ ✅; ~~groups and parties~~ ✅ (2 or 4 person); ~~step-through debugging~~ ✅; ~~3-5 handbook pages~~ ✅ (4-page Handbook window); ~~meal-rush mini-cycles~~ ✅ (4 rush periods); ~~two night customer types and one night-only item~~ ✅ |
| Later | Reservations, refunds, ~~firmware shop~~ ✅ (`nearest_table`, `order_stock`), ~~code storage limits~~ ✅ (25 lines + RAM Expansion), ~~hired robots~~ ✅ (Waiter #2), ~~achievements~~ ✅ (7 milestones), ~~robot wear & `repair()`~~ ✅, obstacles, replay features, night visibility and tariffs, random events, ending and final reward |

**Suggested team split (8 people)**

| People | Workstream |
| --- | --- |
| 2 | Interpreter and runtime (pause, resume, instruction budget) |
| 2 | Game simulation (customers, tables, robot actions, economy) |
| 1 | UI and code editor, terminal and controls |
| 1 | Art and animation |
| 1 | Game design and balancing (config, archetypes, upgrades) |
| 1 | Handbook, tutorial content and QA |

&#91;embedded content: prototype milestones · 5 phases, 5 gates\]

If a gate slips, cut Should items first. If that is not enough, cut Must items in this order (proposed): day/night tint, upgrades beyond one, the Load Game list (keep the autosave), the third archetype.

## 14. Technical notes

The prototype is a web app. **Implementation note:** The prototype uses a custom async transpiler (Python-subset → async JS) instead of Pyodide/Skulpt to keep the build dependency-free and fast-loading. The transpiler handles `while`, `if/elif/else`, `for`, function calls, and variable assignment, injecting `Runner.setLine()` for line-by-line execution highlighting. Each terminal runs its own `ScriptRunner` instance. The Pyodide/Skulpt notes below are preserved for the final version.

- **Interpreter.** Robot actions take game time, so scripts must pause at every action and resume later. For the final version, Pyodide (real CPython in WebAssembly) is the recommended runtime because it matches the full-Python decision. Each terminal would run in its own Web Worker, and action calls block that worker until the simulation finishes the action. Stop uses Pyodide's interrupt buffer, which needs a SharedArrayBuffer and therefore cross-origin isolation headers on the host. Skulpt is the fallback: it suspends natively but supports only a subset of Python 3.7.
- **Multi-terminal ready from day 1.** ✅ Each terminal is an independent script that pauses and resumes on its own. Three terminals implemented: Waiter, Chef, Hired Waiter #2.
- **Fixed-timestep simulation.** ✅ The world advances in fixed steps (30 ticks/sec). At 2x and 4x it runs more steps per frame, so scripts behave identically at every speed and replays stay possible.
- **Performance at 4x.** Test the interpreter and simulation at 4x speed in the first technical spike, not at the end.
- **Sandbox.** No imports and no outside access; infinite loops are stopped by the watchdog described in the interpreter architecture below.
- **Engine-independent spec.** Write the language rules and API as their own document, because the Unity or Godot version will likely need its own interpreter.
- **Central balance config.** ✅ Day length, prices, customer volume, patience, cooking times and costs live in one `BalanceConfig` object. Economy rebalanced Oct 20 (see `logs.md` §4).

### Interpreter architecture

The prototype runs real Python (Pyodide) in one Web Worker per terminal, and the simulation is the only keeper of time. Think of each terminal as a person giving orders to a robot over a walkie-talkie: the script gives one order, waits for "done", then gives the next. Pausing the game means the robot never says "done" while the world is frozen.

&#91;embedded content: runtime architecture · 1 clock, 1 worker per terminal\]

**How it works**

1. The simulation owns time. It runs in fixed steps: pausing stops the steps, and 2x or 4x runs more steps per frame.
2. Each terminal is a worker with its own Python. Game functions such as `seat()` or `grab()` send a command to the simulation and block that worker until the simulation reports the action done. Read-only functions such as `free_tables()` return immediately from a snapshot.
3. Pause needs no extra logic: a paused simulation never completes the action, so the script stays blocked exactly where it was.
4. Stop uses Pyodide's interrupt buffer, which needs a worker and a SharedArrayBuffer. The blocking call checks for interrupts periodically, so a robot waiting on a long action can still be stopped.
5. A watchdog catches runaway loops: if a script runs too long in real time without an action, it is interrupted and a friendly message appears in the log. For the final version, consider charging game time per executed line so replays and leaderboards stay deterministic.
6. Firmware locks: only unlocked functions exist for the script, and using a locked name produces a friendly "not unlocked yet, buy it in the shop" message.
7. No imports: `import` and risky builtins are disabled, and the bridge from Python to JavaScript is blocked. This matters most before share-and-import scripts are added.
8. A syntax check runs before Run, so mistakes show with a line number before the robot moves, and common errors are rewritten in plain language.
9. Step-through uses a line-by-line trace that blocks until the player presses Step.

**Pyodide versus Skulpt**

|  | Pyodide (recommended) | Skulpt (fallback) |
| --- | --- | --- |
| Language | Real CPython, full syntax | A subset of Python 3.7 |
| Pausing per action | Blocking calls inside a worker; JSPI is optional | Suspensions, similar to yield |
| Stopping | Interrupt buffer, needs a worker and a SharedArrayBuffer | Timer-based limits |
| Download size | Larger (to be measured) | Smaller |

JSPI is a browser feature that lets a blocking call wait without freezing the page. It ships in Chrome 137+ and Firefox 153+, was in Safari 27 beta as of mid-2026, and per compatibility data is not available on Chrome for Android. The design therefore relies on shared-buffer blocking and treats JSPI as optional.

**Hosting requirement.** Shared buffers need cross-origin isolation, so the host must send the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. Netlify and Cloudflare Pages can set headers with a `_headers` file, while GitHub Pages cannot set custom headers (check this) and would need a service-worker workaround. Confirm the host before day 1.

**Day-1 spike checklist**

- [ ] Pyodide loads inside a worker.
- [ ] A blocking `move()` round trip works.
- [ ] Pausing the simulation freezes the script.
- [ ] Stop interrupts a running script.
- [ ] Two workers run at the same time.
- [ ] Action calls per second at 4x speed are acceptable.
- [ ] `while True: pass` is caught by the watchdog.

If a check fails because of hosting or headers, Skulpt is the fallback, which fits the Day 2 gate.

**Final version.** Unity and Godot do not ship a Python runtime, so the final game needs an embedded interpreter or its own. Keep the language spec engine-independent and collect test scripts with their expected results now, so they can check the new interpreter later.

**Not yet verified:** Pyodide's download size, memory per worker, round-trip speed, the cost of line tracing, and Safari's current stable status.

**References:** [Pyodide: interrupting execution](https://pyodide.readthedocs.io/en/latest/usage/keyboard-interrupts.html), [Pyodide: JSPI](https://blog.pyodide.org/posts/jspi/), [Anvil: client-side Python (Skulpt)](https://anvil.works/docs/client/the-python-environment).

## 15. Risks and mitigations

The two largest risks are the Python runtime eating the week and scope far larger than a 1-week build.

| Risk | Mitigation |
| --- | --- |
| Interpreter work consumes the week | Start it first, keep the API small, test Skulpt and Pyodide in a day-1 spike |
| Scope creep from the accepted feature list | Only items marked Must ship in the prototype; everything else waits |
| Prototype interpreter does not port to Unity/Godot | Keep the language spec and API engine-independent |
| Beginners overwhelmed at 1x | Very low customer volume early, handbook, speed control, pause |
| Battery feels like a chore | Make charging a real trade-off with costs and benefits |
| Hired robots contend for the counter | Atomic `claim(dish)` in the API |
| Stuck loops waste a turn | Watchdog, `wait()`, plain-language log message |
| Manual restocking becomes tedious at 4x | Bulk buy and low-stock warnings |
| Idle play still wins | Running costs, rising volume, reputation loss from complaints |

## 16. Main menu, saves and settings

The game opens on a title menu with three buttons: Start Game, Load Game and Settings. Exit is skipped because the prototype runs in a web browser.

| Button | What it does |
| --- | --- |
| Start Game | Begins a new restaurant with the gentle early game and the first handbook pages |
| Load Game | Lists the available save files, including the autosave, and loads the one the player picks |
| Settings | Sets music volume and sound effect volume |

**Saves**

- Autosave runs automatically (every 60 real seconds + on day rollover) so progress is never lost, and it appears as its own entry in Load Game. ✅ Implemented.
- A save holds each terminal's script (waiter, chef, waiter #2), money, reputation, stock, upgrades, hired robot state, achievement unlock states, totalServed, totalNightServed, and the day count. ✅ Implemented.
- In the web prototype, saves and settings live in the browser, so they belong to one browser unless export is added later.

**Still to decide**

- [x] How often autosave runs (for example once per in-game day). **Resolved:** Every 60 real seconds + on day rollover.
- [x] Whether players can also save manually, and how many slots. **Resolved:** Manual save from Settings modal; single slot (localStorage).
- [x] Whether Settings is also reachable from inside the game (a pause menu). **Resolved:** Yes, via ⚙ HUD button.

## 17. Assets and design replaceability

Design is the most important part of the game and is not finished yet, so the prototype runs on placeholders and every asset can be swapped by dropping new files into the `src` folder, with no code changes.

Suggested layout:

```
src/
  assets/
    images/    sprites, backgrounds, UI art
    audio/     music and sound effects
    fonts/
    manifest   one file mapping each asset ID to its file
  theme/       colors, fonts, spacing and other style tokens
```

**Rules for the whole team**

- **Asset IDs, never file paths.** Code asks for an asset by a stable ID such as `robot_waiter` or `sfx_serve`. The manifest maps each ID to a file, so replacing art means replacing the file or editing one manifest line.
- **Placeholders for everything.** Every ID ships with a placeholder (a labeled colored shape, or a short beep), so the game is playable before any final art exists. A missing or broken file falls back to its placeholder and logs a warning; it never crashes the game.
- **Theme tokens.** Colors, fonts, spacing and corner radius live in one theme file, so the UI can be restyled without touching components.
- **Layout from config.** UI positions come from layout data and scale with the window, not from pixel coordinates scattered through the code.
- **Animations described in the manifest.** A sprite sheet entry states frame size, frame count and speed, so new animation art drops in without code changes.
- **An asset spec per ID.** For each asset the spec lists its size, pivot point and animation names. Final art must match the spec, and if the spec changes, only the manifest entry changes.
- **Audio by ID.** Music and sound effects are loaded the same way and follow the volume sliders in Settings.

**Pixel art rules.** The art style is pixel art, so the pipeline must keep pixels crisp.

- **One pixel grid for everything.** Pick one base tile size and one base screen resolution, and draw every sprite on that grid. Mixing pixel sizes between assets looks wrong immediately.
- **No smoothing.** Render with nearest-neighbor scaling and scale only by whole numbers (2x, 3x, 4x). In the browser this means turning off canvas image smoothing and using the pixelated image-rendering style.
- **Whole-pixel positions.** Sprites move and sit on whole pixels, and are not rotated or scaled to odd sizes.
- **Pixel font and shared palette.** UI text uses a pixel font, and the theme file holds a shared, limited palette so all art matches.
- **Spritesheets on the grid.** Frame sizes are multiples of the base tile size and are recorded in the asset spec.

**Exceptions and fixed sizes.** The logo does not have to be pixel art, so it is the one deliberate exception to these rules. The robot sprite is 32 pixels.

**Camera angle and restaurant assets.** The game is viewed as if a camera looks 45 degrees down at the map, neither entirely flat nor from the side, so walls and objects show both their top and their front faces. Restaurant assets are split into walls (4 designs that differ by angle), floors (one wood plank design for now) and interiors (table, chair, counters and accessories), each drawn at 32 by 32 pixels.

Decisions to settle with your designers before final art starts:

- [ ] Base tile size is 32 pixels for the robot and all restaurant assets (confirm it as the base tile for the whole game).
- [ ] Base screen resolution and the whole-number scales the game supports.
- [ ] Size of the shared palette.

**Handoff when the design is ready**

1. Drop the finished files into `src/assets`.
2. Update the manifest entries that changed.
3. Run an asset check that lists missing or mismatched assets.

The same IDs, manifest and spec carry over to the Unity or Godot version, like the engine-independent API spec.

## 18. Open questions and future ideas

These items are still undecided or not yet scheduled.

**Open questions**

- [x] Should the prototype include a playable chef terminal, or an automatic cook with the chef terminal added later? **Resolved:** Both. Auto-cook runs by default; scripted mode activates when the player presses Run.
- [ ] Which interpreter for the web prototype: Skulpt or Pyodide, decided by the day-1 spike? **Resolved:** Neither. A custom async Python-to-JS transpiler was built instead, keeping the prototype dependency-free. Pyodide/Skulpt remain options for the final version.
- [x] How many hired waiters at launch, and what do they cost? **Resolved:** 1 hired waiter (Waiter #2) for $320.
- [ ] Should restocking ever be automatable through a late firmware unlock such as `order_stock()`?
- [ ] How are toys and miscellaneous items fulfilled: does the waiter pick them up from a shelf, or does the chef terminal prepare them?

**Assumptions to confirm**

These were proposed during planning and have not been explicitly confirmed yet.

- [x] Stop and Pause are separate buttons (Stop ends the script while the world keeps running). ✅ Implemented.
- [x] Edits apply on the next Run, and the script restarts from line 1. ✅ Implemented.
- [x] A hidden wait time sits behind the complaint log, with no visible timer. ✅ Implemented (patience per archetype).
- [x] Tips exist alongside reputation stars. ✅ Implemented ($2–$7 per archetype).
- [x] Code can read stock with `stock()`. ✅ Implemented.
- [ ] Night extras: a night-only menu ✅, reduced visibility (later), cheaper power tariff (later).
- [ ] Slow motion and the black-box recorder (not yet implemented).
- [x] Bulk buying and a low-stock warning in the stock shop. ✅ Restock +10 for $20.
- [x] The 7-day plan and the proposed cut order for Must items if a gate slips (section 13). ✅ All Must items completed.

**Future ideas (not scheduled)**

- Modular robot parts (wheels, arms, trays, sensors).
- Random sensor glitches and firmware patch notes that change API behavior.
- Supplier market with fluctuating ingredient prices, online reviews, seasons.
- Reduced night visibility, power tariff and dine-and-dash customers.
- Random events: blackout, health inspector, delivery delay.
- Accessibility options (colorblind mode, font size) and localization.
- A light story told through customer notes and the restaurant's history.

**Ending and final reward (final version, not the prototype).** A counselor asked for an end result that pays off the player's long programming effort, since an endless game gives no finish line. Ideas to keep in mind:

- A skill-based final goal, such as a flawless week with zero complaints, or a grand inspection day with every customer archetype and a food critic.
- Restaurant tiers (small cafe to flagship) as the long road toward that goal.
- A results screen with days survived, customers served, lines of code and complaints, plus the player's final script shown as a plaque.
- The earned reward of the restaurant running itself, since idle play is blocked until then.
- Endless mode afterward, with daily seeds and leaderboards.

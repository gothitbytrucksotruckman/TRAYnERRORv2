// Tray & Error - Web Prototype Engine
// ponytail: mini Python runner for web prototype; production Unity/Godot ports to embedded CPython / engine runtime.

(function() {
  'use strict';

  // --- Audio Synth (Native Web Audio API, zero file dependencies) ---
  const AudioEngine = {
    ctx: null,
    volume: 0.7,
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
    },
    playTone(freq, type, duration, delay = 0) {
      if (!this.ctx || this.volume <= 0) return;
      try {
        const now = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(this.volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    },
    beepServe() {
      this.init();
      this.playTone(523.25, 'triangle', 0.1, 0);
      this.playTone(659.25, 'triangle', 0.15, 0.08);
    },
    beepPay() {
      this.init();
      this.playTone(784, 'sine', 0.08, 0);
      this.playTone(1046.5, 'sine', 0.15, 0.07);
    },
    beepComplaint() {
      this.init();
      this.playTone(220, 'sawtooth', 0.25, 0);
      this.playTone(180, 'sawtooth', 0.3, 0.15);
    },
    beepCharge() {
      this.init();
      this.playTone(440, 'sine', 0.08, 0);
      this.playTone(880, 'sine', 0.2, 0.08);
    }
  };

  // --- Asset Loader ---
  const ASSET_PATHS = {
    'title-logo': 'assets/gui/title-logo.png',
    'btn-start': 'assets/gui/start-button.png',
    'btn-load': 'assets/gui/load-game-button.png',
    'btn-settings': 'assets/gui/settings-button.png',
    'robot-front': 'assets/robot-waiter/front-view.png',
    'robot-back': 'assets/robot-waiter/back-view.png',
    'robot-left': 'assets/robot-waiter/left-side-view.png',
    'robot-right': 'assets/robot-waiter/right-side-view.png',
    'wall-inner': 'assets/restaurant/walls/inner-view.png',
    'wall-outer': 'assets/restaurant/walls/outer-view.png',
    'wall-side-left': 'assets/restaurant/walls/side-walls-left.png',
    'wall-side-right': 'assets/restaurant/walls/side-walls-right.png',
    'floor': 'assets/restaurant/floor-tiles.png',
    'table-small': 'assets/restaurant/chair-n-table/small-table.png',
    'table-long': 'assets/restaurant/chair-n-table/long-vertical-table.png',
    'chair-left': 'assets/restaurant/chair-n-table/wooden-chair-facing-left.png',
    'chair-right': 'assets/restaurant/chair-n-table/wooden-chair-facing-right.png'
  };

  const images = {};
  let assetsLoaded = false;

  function loadAssets(callback) {
    let loaded = 0;
    const total = Object.keys(ASSET_PATHS).length;
    for (const [key, src] of Object.entries(ASSET_PATHS)) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        images[key] = img;
        loaded++;
        if (loaded >= total) {
          assetsLoaded = true;
          if (callback) callback();
        }
      };
      img.onerror = () => {
        console.warn('Failed to load asset: ' + src);
        loaded++;
        if (loaded >= total) {
          assetsLoaded = true;
          if (callback) callback();
        }
      };
    }
  }

  // --- Central Balance Config (PRD Section 9, 13 & 14) ---
  const BalanceConfig = {
    dayLengthRealSec: 600, // 10 minutes real time = 24 game hours
    rentDaily: 35,
    cookTimeSec: 6,
    stockBatchSize: 10,
    stockBatchCost: 20,
    wearPerTile: 0.4,
    repairCostDay: 15,
    repairCostNight: 5,
    reservationIntervalSec: 90,
    reservationLeadSec: 25,
    reservationPatienceSec: 45,
    reservationPenalty: 0.6,
    reservationSpawnSlowdown: 0.35,
    rushHours: [
      { name: 'Breakfast Rush', start: 7.5, end: 9.5, spawnMult: 0.65 },
      { name: 'Lunch Rush', start: 12.0, end: 14.0, spawnMult: 0.60 },
      { name: 'Dinner Rush', start: 18.0, end: 20.5, spawnMult: 0.60 },
      { name: 'Late Night Rush', start: 23.0, end: 1.5, spawnMult: 0.70 }
    ],
    menu: {
      day: [
        { name: 'Sunny Toast', cost: 1, basePrice: 8 },
        { name: 'Omelette', cost: 1, basePrice: 10 },
        { name: 'Pancake Stack', cost: 1, basePrice: 12 }
      ],
      night: [
        { name: 'Black Coffee & Pie', cost: 1, basePrice: 12 },
        { name: 'Midnight Ramen', cost: 2, basePrice: 16 }
      ]
    },
    specialRequests: [
      'no onions',
      'extra crispy',
      'extra spicy',
      'dressing on side',
      'extra hot'
    ]
  };

  // --- Accounts ---
  // Player: empty editors, start from zero. Developer: ready-to-run defaults.
  const DEV_DEFAULT_SCRIPTS = {
    'code-editor': `# Robot Waiter Control
# PRD Loop: seat -> take_order -> send_to_kitchen -> deliver
while True:
    if battery() < 20:
        go_charge()

    # Wear builds up while walking; service at the charger
    if health() < 20:
        repair()

    dishes = ready_dishes()
    if len(dishes) > 0:
        dish = dishes[0]
        if claim(dish):
            deliver(dish, dish["table"])
            continue

    order = take_order()
    if order:
        send_to_kitchen(order)
        continue

    parties = waiting_parties()
    free = free_tables()
    if len(parties) > 0 and len(free) > 0:
        seat(parties[0], free[0])
        continue

    wait(1)
`,
    'chef-code-editor': `# Chef Robot Control Script
# Cooperates with Waiter via tickets & counter

while True:
    pending = tickets()
    if len(pending) > 0:
        ticket = pending[0]

        # Check and grab ingredients (PRD Section 8)
        if not grab("ingredients", 1):
            print("Out of stock! Pausing for restock.")
            wait(2)
            continue

        # Apply any special request (e.g. "no onions")
        handle_note(ticket)

        # Cooking time based on ticket
        cook(4)

        # Place finished dish on counter for waiter
        plate(ticket)
        continue

    wait(1)
`,
    'waiter2-code-editor': `# Hired Waiter #2 Control
# Cooperates with Waiter #1 via claim(dish)

while True:
    if battery() < 20:
        go_charge()

    # Wear builds up while walking; service at the charger
    if health() < 20:
        repair()

    # Claim & deliver ready dishes
    dishes = ready_dishes()
    if len(dishes) > 0:
        dish = dishes[0]
        # Atomic claim: returns True only for first robot!
        if claim(dish):
            deliver(dish, dish["table"])
            continue

    # Help take orders from ready tables
    order = take_order()
    if order:
        send_to_kitchen(order)
        continue

    # Seat remaining guests
    parties = waiting_parties()
    free = free_tables()
    if len(parties) > 0 and len(free) > 0:
        seat(parties[0], free[0])
        continue

    wait(1)
`
  };

  const SAVE_KEY = account => `traynerror_savedata_${account === 'developer' ? 'dev' : 'player'}`;

  // --- Game State & Configuration ---
  const TILE_SIZE = 32;
  const GRID_COLS = 14;
  const GRID_ROWS = 10;

  const State = {
    // Account
    account: 'player',
    started: false,

    // Economy & Progress
    cash: 50,
    reputation: 5.0, // 1 to 5
    day: 1,
    timeSeconds: 8 * 3600, // starts at 08:00 AM
    speed: 1,
    isPaused: false,
    dayLengthRealSec: BalanceConfig.dayLengthRealSec,
    stock: 30,

    // Upgrades
    speedUpgrade: false,
    batteryUpgrade: false,
    trayUpgrade: false,
    fadeOuterWall: true,

    // Firmware & code storage (prototype: one shared line budget)
    unlockedAPIs: { nearest_table: false, order_stock: false },
    codeLineLimit: 25,

    // Entities
    robot: {
      gridX: 1,
      gridY: 1,
      targetX: 1,
      targetY: 1,
      renderX: 1,
      renderY: 1,
      direction: 'front',
      battery: 100,
      health: 100,
      trayCapacity: 1,
      tray: [],
      carrying: null,
      isCharging: false,
      isActionActive: false,
      pathQueue: []
    },

    // Hired Waiter #2
    hasHiredWaiter: false,
    robot2: {
      gridX: 2,
      gridY: 0,
      targetX: 2,
      targetY: 0,
      renderX: 2,
      renderY: 0,
      direction: 'front',
      battery: 100,
      health: 100,
      trayCapacity: 1,
      tray: [],
      carrying: null,
      isCharging: false,
      isActionActive: false,
      pathQueue: []
    },
    charger2: { x: 2, y: 0 },
    waiter2ScriptInterrupt: false,
    waiter2ScriptPaused: false,

    // Per-runner generation counters. Bumped on every run/stop so a stale
    // (zombie) async loop can detect that it no longer owns the runner.
    scriptGen: { scriptInterrupt: 0, waiter2ScriptInterrupt: 0, chefScriptInterrupt: 0 },

    // Progression & Restaurant Achievements (PRD Section 10)
    totalServed: 0,
    totalNightServed: 0,
    achievements: [
      { id: 'ach_first_shift', icon: '🌱', title: 'First Shift', desc: 'Seat and serve 5 customer parties', target: 5, current: 0, unlocked: false },
      { id: 'ach_stock_master', icon: '📦', title: 'Stockpile Specialist', desc: 'Store at least 30 ingredient portions', target: 30, current: 30, unlocked: false },
      { id: 'ach_night_owl', icon: '🦉', title: 'Night Owl', desc: 'Serve 3 late-night customers during night hours', target: 3, current: 0, unlocked: false },
      { id: 'ach_flawless', icon: '⭐', title: 'Five-Star Standard', desc: 'Reach 5.0 stars maximum reputation rating', target: 5.0, current: 5.0, unlocked: false },
      { id: 'ach_fleet', icon: '🤖', title: 'Automation Fleet', desc: 'Hire Waiter Robot #2 for the dining floor', target: 1, current: 0, unlocked: false },
      { id: 'ach_high_roller', icon: '💰', title: 'Profitable Kitchen', desc: 'Accumulate $500 in restaurant cash reserves', target: 500, current: 50, unlocked: false },
      { id: 'ach_speed', icon: '⚡', title: 'Speed Demon', desc: 'Upgrade robots with Fast Servos', target: 1, current: 0, unlocked: false }
    ],

    // Chef simulation mode ('auto' or 'scripted')
    chefMode: 'auto',
    chefCooking: false,
    chefScriptInterrupt: false,
    chefScriptPaused: false,

    // Charging station tile
    charger: { x: 1, y: 0 },
    // Entrance tile (left wall)
    entrance: { x: 0, y: 4 },
    // Kitchen pickup tile (right wall)
    kitchenPickup: { x: 13, y: 4 },

    // Tables
    tables: [
      { id: 1, type: 'small', seats: 2, x: 2, y: 2, occupiedBy: null, orderReady: false, orderTaken: false, dishServed: false },
      { id: 2, type: 'small', seats: 2, x: 11, y: 2, occupiedBy: null, orderReady: false, orderTaken: false, dishServed: false },
      { id: 3, type: 'small', seats: 2, x: 2, y: 7, occupiedBy: null, orderReady: false, orderTaken: false, dishServed: false },
      { id: 4, type: 'small', seats: 2, x: 11, y: 7, occupiedBy: null, orderReady: false, orderTaken: false, dishServed: false },
      { id: 5, type: 'long', seats: 4, x: 5, y: 4, occupiedBy: null, orderReady: false, orderTaken: false, dishServed: false },
      { id: 6, type: 'long', seats: 4, x: 8, y: 4, occupiedBy: null, orderReady: false, orderTaken: false, dishServed: false }
    ],

    // Customers
    waitingParties: [],
    nextPartyId: 1,
    nextPartyTimer: 5, // Arrives shortly after start
    nextReservationTimer: 20, // First booking shortly after opening

    // Kitchen
    tickets: [],
    readyDishes: [],
    nextTicketId: 1,

    // Script Runner
    scriptRunning: false,
    scriptPaused: false,
    scriptInterrupt: false,

    // Tutorial (player account only)
    tutorialCompleted: [],
    tutorialsDisabled: false,
    tutorialOpen: false,
    tutorialWasPaused: false,
    tutorialIsReview: false,
    tutorialSpeedOverride: false,
    tutorialCooldown: 0,
    tutorialFlags: {}
  };

  // Archetypes (Tuned for tighter, rewarding economy)
  const ARCHETYPES = [
    { name: 'Regular', patience: 85, tip: 2, chance: 0.5 },
    { name: 'Businessman', patience: 55, tip: 5, chance: 0.25 },
    { name: 'Critic', patience: 45, tip: 7, chance: 0.15 },
    { name: 'Night Owl', patience: 70, tip: 4, chance: 0.1, nightOnly: true }
  ];

  // --- Tutorial milestones (player account) ---
  // Each fires once, on the first shift where the situation actually happens.
  // Showing a milestone pauses the whole simulation until the player resumes.
  const TUTORIALS = [
    {
      id: 'tut_welcome',
      badge: '📘 BASICS',
      title: 'Welcome to Tray & Error',
      body: 'You never serve a table by hand. You write Python, and the robots do the work.<br><br>Each terminal has <strong>Run</strong>, <strong>Pause</strong>, <strong>Step</strong> and <strong>Stop</strong>. Edits apply on the next Run. Scripts share a 25-line budget; blank lines and <code># comments</code> are free.<br><br><strong>Pace the world from the HUD:</strong> ⏸ Pause freezes everything, and 1x / 2x / 4x set how fast time moves. Pausing is always safe — rent, customers and robots hold still while you read, think or write. Tutorial cards pause the game on purpose for the same reason.<br><br>The door is on the left, the kitchen counter on the right. Keep a script running — an idle robot still costs rent.',
      api: [
        'wait(seconds) — pause the script instead of busy-looping',
        'Run / Pause / Step / Stop — control the robot in the terminal toolbar',
        'HUD ⏸ / 1x / 2x / 4x — freeze or speed up the whole restaurant',
        'Pausing is free: nothing is lost, nothing expires'
      ],
      snippet: '# Start simple: keep the script alive\nwhile True:\n    wait(1)',
      trigger: () => false
    },
    {
      id: 'tut_first_customer',
      badge: '🚪 CUSTOMERS',
      title: 'Guests Are Waiting at the Door',
      body: 'A party just arrived. Match the party size to a table with enough seats: small tables seat 2, long tables seat 4. Guests lose patience while they stand at the door — if nobody seats them, they complain and reputation drops.<br><br>Customers keep no visible timer. Watch their emote, the complaint log and your stars.',
      api: [
        'waiting_parties() — parties at the door: id, size, archetype',
        'free_tables() — empty, unreserved tables: id, seats',
        'seat(party, table) — walk the party to a table'
      ],
      snippet: 'parties = waiting_parties()\ntables = free_tables()\nif len(parties) > 0 and len(tables) > 0:\n    seat(parties[0], tables[0])',
      trigger: () => State.waitingParties.length > 0
    },
    {
      id: 'tut_order_ready',
      badge: '📝 ORDERS',
      title: 'The Party Is Ready to Order',
      body: 'A seated party shows 📝 when it has decided. Take the order, then post the ticket to the kitchen. The ticket carries the dish, the price and sometimes a special request note.<br><br>Forgetting an order is the same as forgetting the guests: they wait, then complain.',
      api: [
        'take_order() — walks to the next table with a ready order and returns it',
        'send_to_kitchen(order) — posts the ticket to the chef',
        'order["note"] — the special request string, may be empty'
      ],
      snippet: 'order = take_order()\nif order:\n    send_to_kitchen(order)',
      trigger: () => State.tables.some(t => t.orderReady && !t.orderTaken)
    },
    {
      id: 'tut_food_plated',
      badge: '🍳 KITCHEN',
      title: 'A Dish Is Plated at the Counter',
      body: 'The kitchen has plated a dish on the right-hand counter. Claim it before you carry it: <code>claim()</code> returns <code>True</code> for exactly one robot, so two waiters can never grab the same plate.<br><br>Deliver it to the table named on the dish. A wrong table wastes the dish and triggers a refund.',
      api: [
        'ready_dishes() — plated dishes: ticket_id, dish, table, note',
        'claim(dish) — locks one dish for this robot',
        'deliver(dish, table) — carries it from the counter to the table'
      ],
      snippet: 'dishes = ready_dishes()\nif len(dishes) > 0:\n    dish = dishes[0]\n    if claim(dish):\n        deliver(dish, dish["table"])',
      trigger: () => State.readyDishes.length > 0
    },
    {
      id: 'tut_low_battery',
      badge: '🔋 POWER',
      title: 'Battery Is Running Low',
      body: 'Every step drains battery. When it empties the robot stops working and the floor goes silent.<br><br>On the HUD the <strong>BAT</strong> gauge shows charge. The charger station sits at the top-left corner, tile (1, 0). Charging costs time away from the floor, so do it off-peak or between orders.',
      api: [
        'battery() — current charge, 0 to 100',
        'go_charge() — walk to the charger and refill to 100%'
      ],
      snippet: 'if battery() < 20:\n    go_charge()',
      trigger: s => s.robot.battery <= 40
    },
    {
      id: 'tut_low_health',
      badge: '🔧 UPKEEP',
      title: 'The Robot Is Wearing Down',
      body: 'Movement wears the chassis: 0.4 durability per tile. Below 20% health the robot moves 40% slower, which quietly ruins every run.<br><br><code>repair()</code> walks to the charger, takes 4 seconds and restores full health. It costs $15 during the day, $5 at night. Calling it at full health is a free no-op.',
      api: [
        'health() — durability, 0 to 100',
        'repair() — walk to the charger, pay, restore 100% health'
      ],
      snippet: 'if health() < 20:\n    repair()',
      trigger: s => s.robot.health <= 60
    },
    {
      id: 'tut_first_pay',
      badge: '💰 ECONOMY',
      title: 'First Payment Received',
      body: 'The table paid the bill plus a tip. That money is your only income; rent, ingredients and repairs come out of it.<br><br>Rent is charged once per in-game day. Open <strong>📦 Shop</strong> to buy upgrades. Robot upgrades make the same code faster; firmware unlocks add new functions your scripts can call. Code storage can be expanded with RAM Expansion.',
      api: [
        'Shop → Fast Servos, High-Capacity Battery, Double Tray Module',
        'Shop → Firmware: nearest_table(status), order_stock(qty)',
        'Shop → RAM Expansion: +15 lines, repeatable'
      ],
      snippet: '',
      trigger: s => s.totalServed >= 1
    },
    {
      id: 'tut_night_shift',
      badge: '🌙 NIGHT',
      title: 'Night Shift Begins',
      body: 'Hours 20:00–06:00 are night. The menu changes to Black Coffee & Pie and Midnight Ramen, the room dims, and Night Owl customers appear. Repairs are also cheaper at night.<br><br>Scripts that hardcode day-only dishes will start taking orders they cannot explain. Branch on <code>is_night()</code>.',
      api: [
        'is_night() — True during 20:00–06:00',
        'time() — current in-game clock for your own schedules'
      ],
      snippet: 'if is_night():\n    wait(1)',
      trigger: () => isNight()
    },
    {
      id: 'tut_chef_terminal',
      badge: '👨‍🍳 CHEF',
      title: 'Scripting the Chef',
      body: 'By default the chef cooks automatically in the background. Open the Chef terminal and press Run to take over: from then on your script must read tickets, take ingredients, cook and plate.<br><br>Special request notes are mandatory. Call <code>handle_note(ticket)</code> before plating or the customer complains and the tip is lost. A failed grab loses nothing — the stock check is your call.',
      api: [
        'tickets() — pending tickets: id, table, dish, note',
        'grab(item, qty) — take stock; False when it runs out',
        'handle_note(ticket) — acknowledge the special request',
        'cook(seconds) / plate(ticket) — finish and put the dish on the counter'
      ],
      snippet: 'pending = tickets()\nif len(pending) > 0:\n    ticket = pending[0]\n    if grab("ingredients", 1):\n        handle_note(ticket)\n        cook(4)\n        plate(ticket)',
      trigger: s => !!s.tutorialFlags.chefOpened
    },
    {
      id: 'tut_reservations',
      badge: '📅 RESERVATIONS',
      title: 'A Table Is Reserved',
      body: 'A table with a tent-card badge is booked for a party arriving soon. <code>free_tables()</code> already skips it, so matching by seat count stays safe.<br><br>Seating a walk-in on a reserved table loses both parties and 0.6 reputation. When the booked party arrives, seat it at its own table.',
      api: [
        'is_reserved(table) — True while the table is held',
        'waiting_parties() — includes is_reserved and table for booked guests'
      ],
      snippet: '',
      trigger: s => s.tutorialCompleted.includes('tut_first_customer') && s.tables.some(t => t.reservation)
    },
    {
      id: 'tut_hired_waiter',
      badge: '🤖 FLEET',
      title: 'Waiter #2 Has Joined the Floor',
      body: 'Two robots now share the counter and the tables. Each has its own terminal, script and battery, but they share the same plated dishes.<br><br><code>claim(dish)</code> is atomic: only the first caller gets the dish, so you can run the same delivery loop in both scripts without conflict.',
      api: [
        'claim(dish) — True for exactly one robot',
        'tray() — dishes this robot is carrying',
        'Each robot keeps its own battery, health and terminal'
      ],
      snippet: '',
      trigger: s => s.hasHiredWaiter
    }
  ];

  // --- Logging helper ---
  function logMessage(text, type = 'info') {
    const stream = document.getElementById('terminal-log');
    if (!stream) return;
    const msg = document.createElement('div');
    msg.className = 'log-msg log-' + type;
    const timeStr = formatGameTime(State.timeSeconds);
    msg.textContent = `[${timeStr}] ${text}`;
    stream.appendChild(msg);
    stream.scrollTop = stream.scrollHeight;
  }

  function logChefMessage(text, type = 'info') {
    const stream = document.getElementById('chef-terminal-log');
    if (!stream) return;
    const msg = document.createElement('div');
    msg.className = 'log-msg log-' + type;
    const timeStr = formatGameTime(State.timeSeconds);
    msg.textContent = `[${timeStr}] ${text}`;
    stream.appendChild(msg);
    stream.scrollTop = stream.scrollHeight;
  }

  function logWaiter2Message(text, type = 'info') {
    const stream = document.getElementById('waiter2-terminal-log');
    if (!stream) return;
    const msg = document.createElement('div');
    msg.className = 'log-msg log-' + type;
    const timeStr = formatGameTime(State.timeSeconds);
    msg.textContent = `[${timeStr}] ${text}`;
    stream.appendChild(msg);
    stream.scrollTop = stream.scrollHeight;
  }

  function formatGameTime(seconds) {
    const totalMin = Math.floor(seconds / 60);
    const hrs = Math.floor(totalMin / 60) % 24;
    const mins = totalMin % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  function isNight() {
    const hrs = Math.floor(State.timeSeconds / 3600) % 24;
    return hrs >= 20 || hrs < 6;
  }

  function getCurrentRush() {
    const hrs = (State.timeSeconds / 3600) % 24;
    for (const r of BalanceConfig.rushHours) {
      if (r.start < r.end) {
        if (hrs >= r.start && hrs < r.end) return r;
      } else {
        if (hrs >= r.start || hrs < r.end) return r;
      }
    }
    return null;
  }

  // --- Customer & Order Cycle ---
  function updateCustomers(dt) {
    // Spawn customers: 11-18s baseline keeps 3-5 tables occupied
    State.nextPartyTimer -= dt;
    if (State.nextPartyTimer <= 0) {
      const rush = getCurrentRush();
      const reservedCount = State.tables.filter(t => t.reservation).length;
      const mult = (rush ? rush.spawnMult : 1.0) * (1 + reservedCount * BalanceConfig.reservationSpawnSlowdown);
      State.nextPartyTimer = (11 + Math.random() * 7) * mult * tutorialPacingFactor();
      spawnParty();
    }

    // Reservations: book ahead, then the booked party shows up at the door.
    State.nextReservationTimer -= dt;
    if (State.nextReservationTimer <= 0) {
      State.nextReservationTimer = BalanceConfig.reservationIntervalSec * (0.8 + Math.random() * 0.6);
      bookReservation();
    }
    for (const table of State.tables) {
      const res = table.reservation;
      if (!res || res.arrived) continue;
      res.countdown -= dt;
      if (res.countdown <= 0) arriveReservation(table);
    }

    // Update waiting queue
    for (let i = State.waitingParties.length - 1; i >= 0; i--) {
      const p = State.waitingParties[i];
      p.waitTimer += dt;
      const limit = p.is_reserved ? BalanceConfig.reservationPatienceSec : p.archetype.patience;
      if (p.waitTimer > limit) {
        logMessage(`Party #${p.id} (${p.archetype.name}): "Nobody seated us! We waited forever at the door!"`, 'complaint');
        AudioEngine.beepComplaint();
        penalizeReputation(p.archetype.name === 'Critic' ? 1.0 : 0.3);
        if (p.is_reserved) clearReservation(p.target_table);
        State.waitingParties.splice(i, 1);
      }
    }

    // Update seated customers
    for (const table of State.tables) {
      if (table.occupiedBy) {
        const party = table.occupiedBy;
        party.seatedTime += dt;

        // Ready to order after 3s
        if (!table.orderReady && party.seatedTime >= 3) {
          table.orderReady = true;
        }

        // Waiting for food
        if (table.orderTaken && !table.dishServed) {
          party.waitFoodTimer += dt;
          if (party.waitFoodTimer > party.archetype.patience * 2.0) {
            logMessage(`Table #${table.id} (${party.archetype.name}): "Where is our food?! We've been waiting for ages!"`, 'complaint');
            AudioEngine.beepComplaint();
            penalizeReputation(party.archetype.name === 'Critic' ? 1.0 : 0.4);
            applyRefund(table.currentOrder && table.currentOrder.price, `Table #${table.id} walked out`);
            table.occupiedBy = null;
            table.currentOrder = null;
            table.wrongDish = false;
            table.orderReady = false;
            table.orderTaken = false;
            table.dishServed = false;
            table.servedDish = null;
          }
        }

        // Eating
        if (table.dishServed) {
          party.eatTimer += dt;
          if (party.eatTimer >= 12) {
            // Finished meal!
            const basePrice = (table.currentOrder && table.currentOrder.price) ? table.currentOrder.price : 10;
            let bill = basePrice + party.size * 1 + party.archetype.tip;
            const noteMissed = Mechanics.specialRequestMissed(table.currentOrder, table.servedDish);
            if (noteMissed) {
              penalizeReputation(party.archetype.name === 'Critic' ? 0.5 : 0.3);
              logMessage(`Table #${table.id} (${party.archetype.name}): "${Mechanics.noteComplaint(table.currentOrder.note)}"`, 'complaint');
              AudioEngine.beepComplaint();
              applyRefund(basePrice, `Table #${table.id} special request ignored`);
              bill = 0;
            } else if (table.wrongDish) {
              penalizeReputation(party.archetype.name === 'Critic' ? 0.5 : 0.4);
              logMessage(`Table #${table.id} (${party.archetype.name}): "I got someone else's dish!"`, 'complaint');
              AudioEngine.beepComplaint();
              applyRefund(basePrice, `Table #${table.id} wrong dish served`);
              bill = 0;
            }
            State.cash += bill;
            State.totalServed++;
            if (isNight()) State.totalNightServed++;
            updateAchievements();
            AudioEngine.beepPay();
            if (bill > 0) {
              logMessage(`Table #${table.id} finished dining, paid $${bill}.`, 'success');
              boostReputation(0.1);
            } else {
              logMessage(`Table #${table.id} left without paying.`, 'warn');
            }
            table.occupiedBy = null;
            table.currentOrder = null;
            table.servedDish = null;
            table.wrongDish = false;
            table.orderReady = false;
            table.orderTaken = false;
            table.dishServed = false;
          }
        }
      }
    }
  }

  function pickArchetype() {
    const night = isNight();
    const candidates = ARCHETYPES.filter(a => !a.nightOnly || night);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function spawnParty() {
    if (State.waitingParties.length >= 4) return; // Cap queue at 4
    const chosenArchetype = pickArchetype();
    const size = Math.random() < 0.65 ? 2 : 4;
    const party = {
      id: State.nextPartyId++,
      size: size,
      archetype: chosenArchetype,
      waitTimer: 0,
      waitFoodTimer: 0,
      seatedTime: 0,
      eatTimer: 0
    };
    State.waitingParties.push(party);
    logMessage(`Party #${party.id} (${party.archetype.name}, ${party.size} ppl) arrived at entrance.`, 'info');
  }

  // Reservations: a table is held for a party that has not arrived yet.
  function bookReservation() {
    // One hold at a time: six tables should never feel like a reservation queue.
    if (State.tables.some(t => t.reservation)) return;
    const candidates = State.tables.filter(t => !t.occupiedBy && !t.reservation);
    if (candidates.length === 0) return;
    const table = candidates[Math.floor(Math.random() * candidates.length)];
    table.reservation = {
      size: table.seats,
      countdown: BalanceConfig.reservationLeadSec,
      arrived: false,
      partyId: null
    };
    logMessage(`Table #${table.id} reserved for ${table.seats} guests in ~${BalanceConfig.reservationLeadSec}s. Check is_reserved(table).`, 'info');
  }

  function arriveReservation(table) {
    const res = table.reservation;
    const party = {
      id: State.nextPartyId++,
      size: res.size,
      archetype: pickArchetype(),
      waitTimer: 0,
      waitFoodTimer: 0,
      seatedTime: 0,
      eatTimer: 0,
      is_reserved: true,
      target_table: table.id
    };
    res.arrived = true;
    res.partyId = party.id;
    State.waitingParties.push(party);
    logMessage(`Reserved party #${party.id} (${res.size} ppl) arrived for Table #${table.id}.`, 'info');
  }

  function clearReservation(tableId) {
    const table = State.tables.find(t => t.id === tableId);
    if (table) table.reservation = null;
  }

  function applyRefund(amount, reason) {
    if (!amount) return;
    State.cash -= amount;
    logMessage(`Refunded $${amount}: ${reason}.`, 'complaint');
    if (State.cash < 0) {
      logMessage(`Cash is negative ($${State.cash}). Serve happy customers to recover.`, 'warn');
    }
    updateHUD();
  }

  function penalizeReputation(amount) {
    State.reputation = Math.max(1.0, State.reputation - amount);
    updateHUD();
    updateAchievements();
  }

  function boostReputation(amount) {
    State.reputation = Math.min(5.0, State.reputation + amount);
    updateHUD();
    updateAchievements();
  }

  function renderAchievements() {
    const list = document.getElementById('achievements-list');
    if (!list) return;
    list.innerHTML = '';

    State.achievements.forEach(a => {
      const card = document.createElement('div');
      card.className = `achievement-card${a.unlocked ? ' unlocked' : ''}`;

      const currDisplay = (a.target % 1 !== 0)
        ? a.current.toFixed(1)
        : Math.min(a.current, a.target);

      const pct = Math.min(100, Math.round((a.current / a.target) * 100));

      card.innerHTML = `
        <div class="achievement-header">
          <div class="achievement-title-group">
            <span class="achievement-icon">${a.icon}</span>
            <span class="achievement-title">${a.title}</span>
          </div>
          <span class="achievement-badge">${a.unlocked ? 'Unlocked' : 'Locked'}</span>
        </div>
        <div class="achievement-desc">${a.desc}</div>
        <div class="achievement-progress-bar">
          <div class="achievement-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="achievement-footer">
          <span>Progress: ${currDisplay} / ${a.target}</span>
          <span>${pct}%</span>
        </div>
      `;

      list.appendChild(card);
    });
  }

  function updateAchievements() {
    for (const a of State.achievements) {
      if (a.id === 'ach_first_shift') a.current = State.totalServed;
      if (a.id === 'ach_stock_master') a.current = State.stock;
      if (a.id === 'ach_night_owl') a.current = State.totalNightServed;
      if (a.id === 'ach_flawless') a.current = State.reputation;
      if (a.id === 'ach_fleet') a.current = State.hasHiredWaiter ? 1 : 0;
      if (a.id === 'ach_high_roller') a.current = Math.floor(State.cash);
      if (a.id === 'ach_speed') a.current = State.speedUpgrade ? 1 : 0;

      if (!a.unlocked && a.current >= a.target) {
        a.unlocked = true;
        logMessage(`🏆 Achievement Unlocked: "${a.title}"!`, 'success');
        AudioEngine.beepCharge();
      }
    }
    renderAchievements();
  }

  // --- Kitchen Simulation ---
  function updateKitchen(dt) {
    // In scripted mode, player chef code handles tickets manually
    if (State.chefMode === 'scripted') {
      return;
    }

    // Auto-chef fallback mode
    for (let i = State.tickets.length - 1; i >= 0; i--) {
      const ticket = State.tickets[i];
      ticket.cookTime -= dt;
      if (ticket.cookTime <= 0) {
        State.tickets.splice(i, 1);
        if (State.stock <= 0) {
          logMessage(`Chef cannot cook ticket #${ticket.id}: OUT OF STOCK!`, 'complaint');
          AudioEngine.beepComplaint();
          penalizeReputation(0.5);
        } else {
          State.stock--;
          const dish = {
            ticket_id: ticket.id,
            table: ticket.tableId,
            dish: ticket.dish,
            price: ticket.price,
            note: ticket.note,
            handledNote: true, // Auto-chef always follows the ticket note
            claimed: false
          };
          State.readyDishes.push(dish);
          const noteStr = dish.note ? ` [Note: ${dish.note}]` : '';
          logMessage(`Chef plated ${dish.dish}${noteStr} for Table #${dish.table} at counter.`, 'info');
          document.getElementById('stock-count').textContent = State.stock;
        }
      }
    }
  }

  // --- Obstacle Checking & 4-Direction BFS Pathfinding ---
  function isBlockedTile(x, y) {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return true;
    for (const t of State.tables) {
      if (t.type === 'small') {
        // Table at (t.x, t.y), left chair at (t.x-1, t.y), right chair at (t.x+1, t.y)
        if (y === t.y && (x === t.x || x === t.x - 1 || x === t.x + 1)) return true;
      } else {
        // Long table at (t.x, t.y..y+1), chairs at (t.x-1, t.y..y+1), (t.x+1, t.y..y+1)
        if ((y === t.y || y === t.y + 1) && (x === t.x || x === t.x - 1 || x === t.x + 1)) return true;
      }
    }
    return false;
  }

  function findWalkableTarget(tx, ty) {
    if (!isBlockedTile(tx, ty)) return { x: tx, y: ty };
    // Find nearest neighbor if target is blocked
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = tx + dx, ny = ty + dy;
      if (!isBlockedTile(nx, ny)) return { x: nx, y: ny };
    }
    return { x: tx, y: ty };
  }

  function findPath(startX, startY, endX, endY) {
    const end = findWalkableTarget(endX, endY);
    if (startX === end.x && startY === end.y) return [];

    const queue = [[startX, startY]];
    const cameFrom = new Map();
    const key = (x, y) => `${x},${y}`;
    cameFrom.set(key(startX, startY), null);

    // 4 cardinal directions only: down, up, right, left (strictly no diagonals)
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    let found = false;
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      if (cx === end.x && cy === end.y) {
        found = true;
        break;
      }

      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const nKey = key(nx, ny);
        if (!cameFrom.has(nKey) && !isBlockedTile(nx, ny)) {
          cameFrom.set(nKey, [cx, cy]);
          queue.push([nx, ny]);
        }
      }
    }

    if (!found) return [[end.x, end.y]];

    const path = [];
    let curr = [end.x, end.y];
    while (curr) {
      path.push(curr);
      curr = cameFrom.get(key(curr[0], curr[1]));
    }
    path.pop(); // Remove starting tile
    path.reverse();
    return path;
  }

  // --- Robot Simulation & Movement ---
  function updateSingleRobot(r, charger, logFn, dt) {
    const worn = r.health <= 20 ? 0.6 : 1; // Worn-out robots limp
    const moveSpeed = (State.speedUpgrade ? 6 : 4) * worn * dt;

    if (r.pathQueue && r.pathQueue.length > 0) {
      const nextTile = r.pathQueue[0];
      const targetX = nextTile[0];
      const targetY = nextTile[1];

      const dx = targetX - r.renderX;
      const dy = targetY - r.renderY;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.02) {
        r.renderX += (dx / dist) * Math.min(dist, moveSpeed);
        r.renderY += (dy / dist) * Math.min(dist, moveSpeed);

        // Strict 4-direction facing
        if (Math.abs(dx) > Math.abs(dy)) {
          r.direction = dx > 0 ? 'right' : 'left';
        } else {
          r.direction = dy > 0 ? 'front' : 'back';
        }

        const drain = (State.batteryUpgrade ? 0.2 : 0.4) * dt;
        r.battery = Math.max(0, r.battery - drain);
      } else {
        r.renderX = targetX;
        r.renderY = targetY;
        r.gridX = targetX;
        r.gridY = targetY;
        r.health = Math.max(0, r.health - BalanceConfig.wearPerTile);
        r.pathQueue.shift(); // Advance to next path tile
      }
    }

    // Recharging at charger
    if (r.gridX === charger.x && r.gridY === charger.y && r.isCharging) {
      r.battery = Math.min(100, r.battery + 25 * dt);
      if (r.battery >= 100) {
        r.isCharging = false;
        AudioEngine.beepCharge();
        logFn(`Robot fully recharged.`, 'success');
      }
    }
  }

  function updateRobot(dt) {
    updateSingleRobot(State.robot, State.charger, logMessage, dt);
    if (State.hasHiredWaiter) {
      updateSingleRobot(State.robot2, State.charger2, logWaiter2Message, dt);
    }
  }

  // --- Camera & Viewport Zoom/Pan ---
  const Camera = {
    x: 0,
    y: 0,
    zoom: 2.0, // default 2x zoom for crisp 32px pixel art
    minZoom: 0.8,
    maxZoom: 4.5,
    isPanning: false,
    dragStartX: 0,
    dragStartY: 0
  };

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    const vp = document.getElementById('viewport');
    canvas.width = vp.clientWidth;
    canvas.height = vp.clientHeight;
  }
  window.addEventListener('resize', resizeCanvas);

  function initCameraControls() {
    canvas.addEventListener('mousedown', (e) => {
      // Left or middle click on canvas pans
      if (e.button === 0 || e.button === 1) {
        Camera.isPanning = true;
        Camera.dragStartX = e.clientX - Camera.x;
        Camera.dragStartY = e.clientY - Camera.y;
        canvas.classList.add('panning');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!Camera.isPanning) return;
      Camera.x = e.clientX - Camera.dragStartX;
      Camera.y = e.clientY - Camera.dragStartY;
    });

    window.addEventListener('mouseup', () => {
      if (Camera.isPanning) {
        Camera.isPanning = false;
        canvas.classList.remove('panning');
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const targetZoom = Math.min(Math.max(Camera.zoom * zoomFactor, Camera.minZoom), Camera.maxZoom);

      const rect = canvas.getBoundingClientRect();
      const mouseRelX = e.clientX - rect.left - canvas.width / 2;
      const mouseRelY = e.clientY - rect.top - canvas.height / 2;

      // Keep world point under cursor invariant
      Camera.x -= (mouseRelX - Camera.x) * (targetZoom / Camera.zoom - 1);
      Camera.y -= (mouseRelY - Camera.y) * (targetZoom / Camera.zoom - 1);
      Camera.zoom = targetZoom;
    }, { passive: false });

    // Double-click resets camera to center
    canvas.addEventListener('dblclick', () => {
      Camera.x = 0;
      Camera.y = 0;
      Camera.zoom = 2.0;
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    // Center & scale world
    ctx.translate(Math.floor(canvas.width / 2 + Camera.x), Math.floor(canvas.height / 2 + Camera.y));
    ctx.scale(Camera.zoom, Camera.zoom);

    // Center the restaurant
    const totalW = (GRID_COLS + 2) * TILE_SIZE;
    const totalH = (GRID_ROWS + 2) * TILE_SIZE;
    const startX = -Math.floor(totalW / 2) + TILE_SIZE;
    const startY = -Math.floor(totalH / 2) + TILE_SIZE;

    // 1. Layer: Floor
    if (images['floor']) {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c += 2) {
          ctx.drawImage(images['floor'], startX + c * TILE_SIZE, startY + r * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE);
        }
      }
    }

    // 2. Layer: Inner Wall (Top boundary)
    if (images['wall-inner']) {
      for (let c = 0; c < GRID_COLS; c += 2) {
        ctx.drawImage(images['wall-inner'], startX + c * TILE_SIZE, startY - TILE_SIZE, TILE_SIZE * 2, TILE_SIZE);
      }
    }

    // Charger Station indicator
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(startX + State.charger.x * TILE_SIZE + 4, startY + State.charger.y * TILE_SIZE + 4, 24, 24);
    ctx.fillStyle = '#0f172a';
    ctx.font = '10px monospace';
    ctx.fillText('⚡', startX + State.charger.x * TILE_SIZE + 9, startY + State.charger.y * TILE_SIZE + 19);

    // Charger Station #2 indicator (Hired Waiter)
    if (State.hasHiredWaiter) {
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(startX + State.charger2.x * TILE_SIZE + 4, startY + State.charger2.y * TILE_SIZE + 4, 24, 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px monospace';
      ctx.fillText('⚡2', startX + State.charger2.x * TILE_SIZE + 6, startY + State.charger2.y * TILE_SIZE + 19);
    }

    // Kitchen pickup indicator
    const kx = startX + State.kitchenPickup.x * TILE_SIZE;
    const ky = startY + State.kitchenPickup.y * TILE_SIZE;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(kx + 6, ky + 4, 20, 24);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    const stoveIcon = State.chefCooking ? '🔥' : '🍳';
    ctx.fillText(stoveIcon, kx + 8, ky + 19);

    // Ready dishes waiting at pickup counter
    const readyCount = State.readyDishes.filter(d => !d.claimed).length;
    if (readyCount > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(kx + 22, ky + 6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '8px monospace';
      ctx.fillText(readyCount.toString(), kx + 19, ky + 9);
    }

    // 3. Layer: Furniture & Seated Customers
    for (const table of State.tables) {
      const tx = startX + table.x * TILE_SIZE;
      const ty = startY + table.y * TILE_SIZE;

      if (table.type === 'small') {
        // Table (1x1)
        if (images['table-small']) {
          ctx.drawImage(images['table-small'], tx, ty, TILE_SIZE, TILE_SIZE);
        }
        // Left Chair (facing right)
        if (images['chair-right']) {
          ctx.drawImage(images['chair-right'], tx - TILE_SIZE, ty, TILE_SIZE, TILE_SIZE);
        }
        // Right Chair (facing left)
        if (images['chair-left']) {
          ctx.drawImage(images['chair-left'], tx + TILE_SIZE, ty, TILE_SIZE, TILE_SIZE);
        }

        // Draw customer placeholder on chairs if occupied
        if (table.occupiedBy) {
          ctx.fillStyle = '#a855f7'; // Purple placeholder
          ctx.fillRect(tx - TILE_SIZE + 9, ty + 4, 14, 22);
          if (table.occupiedBy.size > 1) {
            ctx.fillRect(tx + TILE_SIZE + 9, ty + 4, 14, 22);
          }

          // Customer emotion & status bubble
          const party = table.occupiedBy;
          ctx.font = '10px monospace';
          if (!table.orderReady) {
            ctx.fillText('💭', tx + 8, ty - 4);
          } else if (table.orderReady && !table.orderTaken) {
            ctx.fillText('📝', tx + 8, ty - 4);
          } else if (table.orderTaken && !table.dishServed) {
            ctx.fillText(party.waitFoodTimer > party.archetype.patience * 1.3 ? '😠' : '⏳', tx + 8, ty - 4);
          } else if (table.dishServed) {
            ctx.fillText('🍽️', tx + 8, ty + 12);
          }
        }
      } else {
        // Long Table (1x2)
        if (images['table-long']) {
          ctx.drawImage(images['table-long'], tx, ty, TILE_SIZE, TILE_SIZE * 2);
        }
        // Left Chairs
        if (images['chair-right']) {
          ctx.drawImage(images['chair-right'], tx - TILE_SIZE, ty, TILE_SIZE, TILE_SIZE);
          ctx.drawImage(images['chair-right'], tx - TILE_SIZE, ty + TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        // Right Chairs
        if (images['chair-left']) {
          ctx.drawImage(images['chair-left'], tx + TILE_SIZE, ty, TILE_SIZE, TILE_SIZE);
          ctx.drawImage(images['chair-left'], tx + TILE_SIZE, ty + TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }

        if (table.occupiedBy) {
          ctx.fillStyle = '#a855f7';
          ctx.fillRect(tx - TILE_SIZE + 9, ty + 4, 14, 22);
          ctx.fillRect(tx - TILE_SIZE + 9, ty + TILE_SIZE + 4, 14, 22);
          ctx.fillRect(tx + TILE_SIZE + 9, ty + 4, 14, 22);
          ctx.fillRect(tx + TILE_SIZE + 9, ty + TILE_SIZE + 4, 14, 22);

          const party = table.occupiedBy;
          ctx.font = '10px monospace';
          if (!table.orderReady) {
            ctx.fillText('💭', tx + 8, ty - 4);
          } else if (table.orderReady && !table.orderTaken) {
            ctx.fillText('📝', tx + 8, ty - 4);
          } else if (table.orderTaken && !table.dishServed) {
            ctx.fillText(party.waitFoodTimer > party.archetype.patience * 1.3 ? '😠' : '⏳', tx + 8, ty - 4);
          } else if (table.dishServed) {
            ctx.fillText('🍽️', tx + 8, ty + 20);
          }
        }
      }

      // Reservation tent card (held table)
      if (table.reservation) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(tx + TILE_SIZE - 15, ty + 3, 11, 13);
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('R', tx + TILE_SIZE - 12, ty + 12);
      }

      // Table ID label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '9px monospace';
      ctx.fillText(`T${table.id}`, tx + 8, ty + 10);
    }

    // Waiting queue at entrance (Left side)
    State.waitingParties.forEach((p, idx) => {
      const qx = startX - TILE_SIZE * 1.5;
      const qy = startY + (State.entrance.y * TILE_SIZE) + (idx * 26);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(qx, qy, 14, 22);
      ctx.fillStyle = '#fff';
      ctx.font = '8px monospace';
      ctx.fillText(p.archetype.name[0], qx + 4, qy + 14);
    });

    // 4. Layer: Robot Waiter #1
    const rx = startX + State.robot.renderX * TILE_SIZE;
    const ry = startY + State.robot.renderY * TILE_SIZE;
    const robotSpriteKey = `robot-${State.robot.direction}`;
    if (images[robotSpriteKey]) {
      ctx.drawImage(images[robotSpriteKey], rx, ry, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(rx + 4, ry + 4, 24, 24);
    }

    // Tray items carried indicator
    if (State.robot.tray && State.robot.tray.length > 0) {
      ctx.font = '10px monospace';
      const trayIcon = State.robot.tray.length > 1 ? '🍲🍲' : '🍲';
      ctx.fillText(trayIcon, rx - (State.robot.tray.length > 1 ? 4 : 0), ry - 3);
    }

    // Robot Waiter #2 (Hired Unit)
    if (State.hasHiredWaiter) {
      const r2x = startX + State.robot2.renderX * TILE_SIZE;
      const r2y = startY + State.robot2.renderY * TILE_SIZE;
      const r2SpriteKey = `robot-${State.robot2.direction}`;
      ctx.save();
      ctx.filter = 'hue-rotate(160deg) saturate(1.4)';
      if (images[r2SpriteKey]) {
        ctx.drawImage(images[r2SpriteKey], r2x, r2y, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(r2x + 4, r2y + 4, 24, 24);
      }
      ctx.restore();

      if (State.robot2.tray && State.robot2.tray.length > 0) {
        ctx.font = '10px monospace';
        const trayIcon = State.robot2.tray.length > 1 ? '🍲🍲' : '🍲';
        ctx.fillText(trayIcon, r2x - (State.robot2.tray.length > 1 ? 4 : 0), r2y - 3);
      }
    }

    // Night Atmosphere & Warm Table Lighting (PRD Section 4 & 17)
    if (isNight()) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 15, 30, 0.38)';
      ctx.fillRect(startX - TILE_SIZE, startY - TILE_SIZE, (GRID_COLS + 2) * TILE_SIZE, (GRID_ROWS + 2) * TILE_SIZE);

      // Warm radial lamp glow over each table
      for (const t of State.tables) {
        const lx = startX + (t.x + 0.5) * TILE_SIZE;
        const ly = startY + (t.y + (t.type === 'long' ? 1.0 : 0.5)) * TILE_SIZE;
        const grad = ctx.createRadialGradient(lx, ly, 4, lx, ly, 42);
        grad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
        grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, 42, 0, Math.PI * 2);
        ctx.fill();
      }

      // Warm glow over kitchen stove
      const sx = startX + (State.kitchenPickup.x + 0.5) * TILE_SIZE;
      const sy = startY + (State.kitchenPickup.y + 0.5) * TILE_SIZE;
      const stoveGrad = ctx.createRadialGradient(sx, sy, 4, sx, sy, 46);
      stoveGrad.addColorStop(0, 'rgba(251, 146, 60, 0.35)');
      stoveGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = stoveGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, 46, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 5. Layer: Side Walls (Left and Right)
    if (images['wall-side-left']) {
      for (let r = -1; r <= GRID_ROWS; r += 2) {
        ctx.drawImage(images['wall-side-left'], startX - TILE_SIZE, startY + r * TILE_SIZE, TILE_SIZE, TILE_SIZE * 2);
      }
    }
    if (images['wall-side-right']) {
      for (let r = -1; r <= GRID_ROWS; r += 2) {
        ctx.drawImage(images['wall-side-right'], startX + GRID_COLS * TILE_SIZE, startY + r * TILE_SIZE, TILE_SIZE, TILE_SIZE * 2);
      }
    }

    // 6. Layer: Outer Wall (Bottom boundary)
    // Dynamic transparency when robot is near bottom outer wall
    const isRobotNearOuterWall = State.robot.renderY >= GRID_ROWS - 1.5 || (State.hasHiredWaiter && State.robot2.renderY >= GRID_ROWS - 1.5);
    const outerWallAlpha = (State.fadeOuterWall && isRobotNearOuterWall) ? 0.35 : 1.0;

    ctx.save();
    ctx.globalAlpha = outerWallAlpha;
    if (images['wall-outer']) {
      for (let c = 0; c < GRID_COLS; c += 2) {
        ctx.drawImage(images['wall-outer'], startX + c * TILE_SIZE, startY + GRID_ROWS * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE);
      }
    }
    ctx.restore();

    // End Camera transform
    ctx.restore();
  }

  // --- Async Robot Actions for Script Runner ---
  // A cancelled run is either interrupted by the player or superseded by a
  // newer run/stop (generation mismatch). Zombie loops must die here.
  function scriptCancelled(interruptKey, gen) {
    return !!State[interruptKey] || (State.scriptGen[interruptKey] || 0) !== gen;
  }

  async function robotMoveTo(robot, interruptKey, targetX, targetY) {
    const gen = State.scriptGen[interruptKey] || 0;
    if (scriptCancelled(interruptKey, gen)) return false;
    const path = findPath(robot.gridX, robot.gridY, targetX, targetY);
    if (path.length === 0) return true;

    robot.pathQueue = path;
    while (robot.pathQueue.length > 0) {
      if (scriptCancelled(interruptKey, gen)) {
        robot.pathQueue = [];
        return false;
      }
      await sleepTick(interruptKey);
    }
    return true;
  }

  function sleepTick(interruptKey = 'scriptInterrupt') {
    const gen = State.scriptGen[interruptKey] || 0;
    const isPausedFlag = () => {
      if (State.isPaused) return true;
      if (interruptKey === 'scriptInterrupt') return State.scriptPaused;
      if (interruptKey === 'waiter2ScriptInterrupt') return State.waiter2ScriptPaused;
      if (interruptKey === 'chefScriptInterrupt') return State.chefScriptPaused;
      return false;
    };

    return new Promise(resolve => {
      const check = () => {
        if (scriptCancelled(interruptKey, gen) || !isPausedFlag()) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      setTimeout(check, 20 / (State.speed || 1));
    });
  }

  async function scriptWait(gameSeconds, interruptKey = 'scriptInterrupt') {
    let remaining = gameSeconds;
    const gen = State.scriptGen[interruptKey] || 0;
    const isPausedFlag = () => {
      if (State.isPaused) return true;
      if (interruptKey === 'scriptInterrupt') return State.scriptPaused;
      if (interruptKey === 'waiter2ScriptInterrupt') return State.waiter2ScriptPaused;
      if (interruptKey === 'chefScriptInterrupt') return State.chefScriptPaused;
      return false;
    };

    while (remaining > 0 && !scriptCancelled(interruptKey, gen)) {
      if (!isPausedFlag()) {
        remaining -= 0.1 * State.speed;
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // --- Firmware lock helper (PRD Section 9) ---
  function requireFirmware(name, logFn) {
    if (State.unlockedAPIs[name]) return true;
    logFn(`[API] ${name}() is locked. Buy its firmware in the Shop.`, 'warn');
    return false;
  }

  // --- Waiter Robot API Factory (PRD Section 6 & 13) ---
  function createWaiterAPI(robotKey, chargerKey, interruptKey, logFn) {
    return {
      print(...args) {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
        logFn(`[Code] ${msg}`, 'info');
      },

      waiting_parties() {
        return State.waitingParties.map(p => ({
          id: p.id,
          size: p.size,
          archetype: p.archetype.name,
          is_reserved: !!p.is_reserved,
          table: p.target_table || null
        }));
      },

      free_tables() {
        return State.tables
          .filter(t => !t.occupiedBy && !t.reservation)
          .map(t => ({ id: t.id, seats: t.seats, x: t.x, y: t.y }));
      },

      is_reserved(tableObj) {
        const table = State.tables.find(t => t.id === (tableObj && (tableObj.id || tableObj)));
        return !!(table && table.reservation);
      },

      async seat(partyObj, tableObj) {
        const gen = State.scriptGen[interruptKey] || 0;
        if (scriptCancelled(interruptKey, gen)) return false;
        const party = State.waitingParties.find(p => p.id === (partyObj.id || partyObj));
        const table = State.tables.find(t => t.id === (tableObj.id || tableObj));
        if (!party || !table || table.occupiedBy) {
          logFn(`seat() failed: invalid party or table already occupied.`, 'warn');
          return false;
        }

        // Reserved table: only its own booking may sit there. Giving it away to a
        // walk-in loses both parties on the spot.
        if (table.reservation) {
          const ownsTable = party.is_reserved && party.target_table === table.id;
          if (!ownsTable) {
            const partyIdx = State.waitingParties.indexOf(party);
            if (partyIdx !== -1) State.waitingParties.splice(partyIdx, 1);
            const reservedParty = State.waitingParties.find(p => p.id === table.reservation.partyId);
            if (reservedParty) State.waitingParties.splice(State.waitingParties.indexOf(reservedParty), 1);
            table.reservation = null;
            penalizeReputation(BalanceConfig.reservationPenalty);
            AudioEngine.beepComplaint();
            logFn(`Table #${table.id} was reserved! Walk-in party #${party.id} and the booked party both left.`, 'complaint');
            return false;
          }
          table.reservation = null; // booked party takes its table
        }

        await robotMoveTo(State[robotKey], interruptKey, State.entrance.x, State.entrance.y);
        if (scriptCancelled(interruptKey, gen)) return false;
        const idx = State.waitingParties.indexOf(party);
        if (idx !== -1) State.waitingParties.splice(idx, 1);

        await robotMoveTo(State[robotKey], interruptKey, table.x, table.y - 1);
        if (scriptCancelled(interruptKey, gen)) {
          // Put the party back in the queue if they were already pulled from it.
          if (!table.occupiedBy && !State.waitingParties.includes(party)) State.waitingParties.push(party);
          return false;
        }
        if (table.occupiedBy) return false;
        table.occupiedBy = party;
        table.servedDish = null;
        party.seatedTime = 0;
        party.waitFoodTimer = 0;
        AudioEngine.beepServe();
        logFn(`Seated party #${party.id} at Table #${table.id}.`, 'info');
        return true;
      },

      async take_order(tableObj = null) {
        const gen = State.scriptGen[interruptKey] || 0;
        if (scriptCancelled(interruptKey, gen)) return null;
        let targetTable = null;
        if (tableObj) {
          targetTable = State.tables.find(t => t.id === (tableObj.id || tableObj));
        } else {
          targetTable = State.tables.find(t => t.occupiedBy && t.orderReady && !t.orderTaken);
        }

        if (!targetTable || !targetTable.occupiedBy || !targetTable.orderReady || targetTable.orderTaken) {
          return null;
        }

        await robotMoveTo(State[robotKey], interruptKey, targetTable.x, targetTable.y - 1);
        await scriptWait(0.7, interruptKey);

        // Customer may have walked out while the robot was walking over.
        if (scriptCancelled(interruptKey, gen)) return null;
        if (targetTable.orderTaken || !targetTable.occupiedBy) return null;
        targetTable.orderTaken = true;

        const night = isNight();
        const menuList = night ? BalanceConfig.menu.night : BalanceConfig.menu.day;
        const chosenItem = menuList[Math.floor(Math.random() * menuList.length)];
        const hasNote = Math.random() < 0.4;
        const note = hasNote ? BalanceConfig.specialRequests[Math.floor(Math.random() * BalanceConfig.specialRequests.length)] : '';

        const order = {
          tableId: targetTable.id,
          dish: chosenItem.name,
          price: chosenItem.basePrice,
          note: note,
          partyId: targetTable.occupiedBy.id
        };
        targetTable.currentOrder = order;

        const noteText = note ? ` (Note: "${note}")` : '';
        logFn(`Took order for Table #${targetTable.id}: ${order.dish}${noteText}.`, 'info');
        return order;
      },

      send_to_kitchen(order) {
        if (!order) return false;
        const ticket = {
          id: State.nextTicketId++,
          tableId: order.tableId,
          dish: order.dish,
          price: order.price || 16,
          note: order.note || '',
          cookTime: BalanceConfig.cookTimeSec
        };
        State.tickets.push(ticket);
        const noteText = ticket.note ? ` [Note: "${ticket.note}"]` : '';
        logFn(`Sent ticket #${ticket.id} (${ticket.dish}${noteText}) to kitchen.`, 'info');
        return true;
      },

      ready_dishes() {
        return State.readyDishes.filter(d => !d.claimed).map(d => ({
          ticket_id: d.ticket_id,
          dish: d.dish,
          table: d.table,
          note: d.note || ''
        }));
      },

      tray() {
        return State[robotKey].tray.map(d => ({
          ticket_id: d.ticket_id,
          dish: d.dish,
          table: d.table,
          note: d.note || ''
        }));
      },

      claim(dishObj) {
        if (State[robotKey].tray.length >= State[robotKey].trayCapacity) {
          return false;
        }
        const targetId = dishObj ? (dishObj.ticket_id || dishObj) : null;
        const dish = State.readyDishes.find(d => d.ticket_id === targetId);
        if (!dish || dish.claimed) return false;
        dish.claimed = true;
        return true;
      },

      async deliver(dishObj, tableId) {
        const gen = State.scriptGen[interruptKey] || 0;
        if (scriptCancelled(interruptKey, gen)) return false;
        const targetTable = State.tables.find(t => t.id === (tableId.id || tableId));
        if (!targetTable || !targetTable.occupiedBy) {
          logFn(`deliver() failed: invalid table #${tableId.id || tableId}.`, 'warn');
          return false;
        }

        const targetId = dishObj ? (dishObj.ticket_id || dishObj) : null;
        let dish = State[robotKey].tray.find(d => d.ticket_id === targetId);

        // Put a claimed dish back on the counter so a later run can still serve it.
        const releaseDish = () => {
          const t = State[robotKey].tray.indexOf(dish);
          if (t !== -1) State[robotKey].tray.splice(t, 1);
          if (!State.readyDishes.includes(dish)) State.readyDishes.push(dish);
          dish.claimed = false;
        };
        const discardDish = () => {
          const t = State[robotKey].tray.indexOf(dish);
          if (t !== -1) State[robotKey].tray.splice(t, 1);
          const d = State.readyDishes.indexOf(dish);
          if (d !== -1) State.readyDishes.splice(d, 1);
        };

        if (!dish) {
          dish = State.readyDishes.find(d => d.ticket_id === targetId);
          if (!dish) {
            logFn(`deliver() failed: dish not found at kitchen.`, 'warn');
            return false;
          }

          await robotMoveTo(State[robotKey], interruptKey, State.kitchenPickup.x, State.kitchenPickup.y);
          if (scriptCancelled(interruptKey, gen)) {
            releaseDish();
            return false;
          }
          const dishIdx = State.readyDishes.indexOf(dish);
          if (dishIdx !== -1) State.readyDishes.splice(dishIdx, 1);
          State[robotKey].tray.push(dish);
        }

        await robotMoveTo(State[robotKey], interruptKey, targetTable.x, targetTable.y - 1);
        if (scriptCancelled(interruptKey, gen)) {
          releaseDish();
          return false;
        }
        if (!targetTable.occupiedBy) {
          logFn(`deliver() aborted: Table #${targetTable.id} is empty, dish discarded.`, 'warn');
          discardDish();
          return false;
        }
        const trayIdx = State[robotKey].tray.indexOf(dish);
        if (trayIdx !== -1) State[robotKey].tray.splice(trayIdx, 1);

        targetTable.dishServed = true;
        targetTable.servedDish = dish;
        if (targetTable.currentOrder && dish.dish !== targetTable.currentOrder.dish) {
          targetTable.wrongDish = true;
          logFn(`Warning: wrong dish at Table #${targetTable.id} (ordered ${targetTable.currentOrder.dish}, delivered ${dish.dish}).`, 'warn');
        }
        AudioEngine.beepServe();
        const noteText = dish.note ? ` [Note: "${dish.note}"]` : '';
        logFn(`Delivered ${dish.dish}${noteText} to Table #${targetTable.id}.`, 'success');
        return true;
      },

      battery() {
        return Math.round(State[robotKey].battery);
      },

      health() {
        return Math.round(State[robotKey].health);
      },

      async repair() {
        const gen = State.scriptGen[interruptKey] || 0;
        if (scriptCancelled(interruptKey, gen)) return false;
        const r = State[robotKey];
        if (r.health >= 100) {
          logFn(`repair() skipped: robot already at full health.`, 'info');
          return true;
        }
        const cost = isNight() ? BalanceConfig.repairCostNight : BalanceConfig.repairCostDay;
        if (State.cash < cost) {
          logFn(`repair() failed: need $${cost}, have $${State.cash}.`, 'warn');
          return false;
        }
        logFn(`Robot heading to the charger for repairs ($${cost})...`, 'info');
        await robotMoveTo(r, interruptKey, State[chargerKey].x, State[chargerKey].y);
        if (scriptCancelled(interruptKey, gen)) return false;
        await scriptWait(4, interruptKey);
        if (scriptCancelled(interruptKey, gen)) return false;
        State.cash -= cost;
        r.health = 100;
        AudioEngine.beepCharge();
        logFn(`Robot repaired to 100% health for $${cost}.`, 'success');
        return true;
      },

      time() {
        return (State.timeSeconds / 3600) % 24;
      },

      async go_charge() {
        const gen = State.scriptGen[interruptKey] || 0;
        if (scriptCancelled(interruptKey, gen)) return false;
        logFn(`Robot returning to charge station...`, 'info');
        await robotMoveTo(State[robotKey], interruptKey, State[chargerKey].x, State[chargerKey].y);
        State[robotKey].isCharging = true;
        while (State[robotKey].isCharging && !scriptCancelled(interruptKey, gen)) {
          await sleepTick(interruptKey);
        }
        return true;
      },

      stock(item) {
        return State.stock;
      },

      nearest_table(status = 'free') {
        if (!requireFirmware('nearest_table', logFn)) return null;
        const r = State[robotKey];
        return Mechanics.nearestTable(State.tables, r.gridX, r.gridY, status);
      },

      order_stock(qty = 10) {
        if (!requireFirmware('order_stock', logFn)) return false;
        const cost = qty * 2;
        if (State.cash < cost) {
          logFn(`order_stock() failed: need $${cost}, have $${State.cash}.`, 'warn');
          return false;
        }
        State.cash -= cost;
        State.stock += qty;
        const el = document.getElementById('stock-count');
        if (el) el.textContent = State.stock;
        AudioEngine.beepPay();
        logFn(`Auto-restocked ${qty} portions for $${cost}.`, 'success');
        return true;
      },

      is_night() {
        return isNight();
      },

      async wait(sec) {
        await scriptWait(sec, interruptKey);
      }
    };
  }

  const WaiterAPI = createWaiterAPI('robot', 'charger', 'scriptInterrupt', logMessage);
  const Waiter2API = createWaiterAPI('robot2', 'charger2', 'waiter2ScriptInterrupt', logWaiter2Message);

  // --- Chef Robot API implementations (PRD Section 6, 8 & 12) ---
  const ChefAPI = {
    print(...args) {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      logChefMessage(`[Code] ${msg}`, 'info');
    },

    tickets() {
      return State.tickets.map(t => ({
        id: t.id,
        table: t.tableId,
        dish: t.dish,
        price: t.price || 16,
        note: t.note || ''
      }));
    },

    grab(item = 'ingredients', qty = 1) {
      if (State.stock < qty) {
        logChefMessage(`grab() failed: Not enough ${item} in stock!`, 'warn');
        return false;
      }
      State.stock -= qty;
      const el = document.getElementById('stock-count');
      if (el) el.textContent = State.stock;
      return true;
    },

    async cook(seconds = 4) {
      if (State.chefScriptInterrupt) return false;
      State.chefCooking = true;
      logChefMessage(`Cooking on kitchen station (${seconds}s)...`, 'info');
      await scriptWait(seconds, 'chefScriptInterrupt');
      State.chefCooking = false;
      return true;
    },

    handle_note(ticketObj) {
      const ticketId = ticketObj ? (ticketObj.id || ticketObj) : null;
      const ticket = State.tickets.find(t => t.id === ticketId);
      if (!ticket) {
        logChefMessage(`handle_note() failed: ticket #${ticketId} not found.`, 'warn');
        return false;
      }
      if (!ticket.note) return true;
      ticket.handledNote = true;
      logChefMessage(`Handled special request "${ticket.note}" for ticket #${ticket.id}.`, 'success');
      return true;
    },

    plate(ticketObj) {
      if (!ticketObj) return false;
      const ticketId = ticketObj.id || ticketObj;
      const idx = State.tickets.findIndex(t => t.id === ticketId);
      if (idx === -1) {
        logChefMessage(`plate() failed: ticket #${ticketId} not found.`, 'warn');
        return false;
      }
      const ticket = State.tickets.splice(idx, 1)[0];
      const dish = {
        ticket_id: ticket.id,
        table: ticket.tableId,
        dish: ticket.dish,
        price: ticket.price,
        note: ticket.note,
        handledNote: !!ticket.handledNote,
        claimed: false
      };
      State.readyDishes.push(dish);
      AudioEngine.beepServe();
      const noteStr = dish.note ? ` [Note: "${dish.note}"]` : '';
      logChefMessage(`Plated ${dish.dish}${noteStr} for Table #${dish.table} at counter.`, 'success');
      logMessage(`[Chef] Plated ${dish.dish}${noteStr} for Table #${dish.table} at counter.`, 'info');
      return true;
    },

    stock(item) {
      return State.stock;
    },

    order_stock(qty = 10) {
      if (!requireFirmware('order_stock', logChefMessage)) return false;
      const cost = qty * 2;
      if (State.cash < cost) {
        logChefMessage(`order_stock() failed: need $${cost}, have $${State.cash}.`, 'warn');
        return false;
      }
      State.cash -= cost;
      State.stock += qty;
      const el = document.getElementById('stock-count');
      if (el) el.textContent = State.stock;
      AudioEngine.beepPay();
      logChefMessage(`Auto-restocked ${qty} portions for $${cost}.`, 'success');
      return true;
    },

    is_night() {
      return isNight();
    },

    async wait(sec) {
      await scriptWait(sec, 'chefScriptInterrupt');
    }
  };

  // --- Generalized Async Script Runner (Waiter & Chef) ---
  class ScriptRunner {
    constructor(cfg) {
      this.id = cfg.id;
      this.api = cfg.api;
      this.statusIndicatorId = cfg.statusIndicatorId;
      this.statusTextId = cfg.statusTextId;
      this.editorId = cfg.editorId;
      this.highlightId = cfg.highlightId;
      this.runBtnId = cfg.runBtnId;
      this.pauseBtnId = cfg.pauseBtnId;
      this.stepBtnId = cfg.stepBtnId;
      this.stopBtnId = cfg.stopBtnId;
      this.interruptKey = cfg.interruptKey;
      this.onStart = cfg.onStart;
      this.onStop = cfg.onStop;
      this.logFn = cfg.logFn || logMessage;
      this.running = false;
      this.paused = false;
      this.stepping = false;
      this.currentLine = 1;
      this.activeGen = null;

      // Debugger: breakpoints by editor line number + last local snapshot.
      this.breakpoints = new Set();
      this.watchData = {};
      this.debug = cfg.debug || {};
      this.gutterEl = null;
      this.watchBodyEl = null;
      this.watchPanelEl = null;
    }

    // True when this runner's generation was superseded by a newer run/stop,
    // or the player pressed Stop. Used by transpiled loop headers.
    cancelled(gen) {
      return Mechanics.loopCancelled(State[this.interruptKey], State.scriptGen[this.interruptKey], gen);
    }

    bumpGen() {
      State.scriptGen[this.interruptKey] = (State.scriptGen[this.interruptKey] || 0) + 1;
      return State.scriptGen[this.interruptKey];
    }

    // Forced macrotask yield injected into every loop iteration so a user
    // script that never awaits cannot starve the browser event loop.
    tick() {
      return new Promise(r => setTimeout(r, 0));
    }

    // --- Debugger -------------------------------------------------------
    // Breakpoint gutter and live variable panel live inside the terminal.
    initDebugger() {
      const editor = document.getElementById(this.editorId);
      const gutter = document.getElementById(this.debug.gutterId);
      const panel = document.getElementById(this.debug.watchId);
      const body = document.getElementById(this.debug.watchBodyId);
      const toggle = document.getElementById(this.debug.watchToggleId);
      this.gutterEl = gutter;
      this.watchPanelEl = panel;
      this.watchBodyEl = body;
      if (!editor || !gutter) return;

      this.renderGutter = () => {
        const count = editor.value.split('\n').length;
        let html = '';
        for (let i = 1; i <= count; i++) {
          html += `<div class="bp-line${this.breakpoints.has(i) ? ' has-bp' : ''}" data-line="${i}">${i}</div>`;
        }
        gutter.innerHTML = html;
      };
      this.renderGutter();

      editor.addEventListener('input', () => this.renderGutter());
      editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
      gutter.addEventListener('click', e => {
        const row = e.target.closest('.bp-line');
        if (!row) return;
        const n = Number(row.dataset.line);
        if (this.breakpoints.has(n)) this.breakpoints.delete(n);
        else this.breakpoints.add(n);
        row.classList.toggle('has-bp', this.breakpoints.has(n));
      });

      if (toggle && panel) {
        toggle.addEventListener('click', () => {
          const collapsed = panel.classList.toggle('collapsed');
          toggle.textContent = collapsed ? '▸' : '◂';
          toggle.title = collapsed ? 'Expand watch panel' : 'Collapse watch panel';
        });
      }
      this.renderWatch();
    }

    expandWatch() {
      if (!this.watchPanelEl) return;
      this.watchPanelEl.classList.remove('collapsed');
      const toggle = document.getElementById(this.debug.watchToggleId);
      if (toggle) { toggle.textContent = '◂'; toggle.title = 'Collapse watch panel'; }
    }

    snapshot(values) {
      this.watchData = values;
      if (this.paused) this.renderWatch();
    }

    renderWatch() {
      const body = this.watchBodyEl;
      if (!body) return;
      const fmt = v => {
        if (v === null || v === undefined) return 'None';
        if (typeof v === 'object') {
          try { return JSON.stringify(v); } catch (e) { return String(v); }
        }
        return String(v);
      };
      const rows = Object.entries(this.watchData || {});
      if (this.id === 'waiter' || this.id === 'waiter2') {
        const r = this.id === 'waiter' ? State.robot : State.robot2;
        rows.push(['battery', Math.round(r.battery) + '%']);
        rows.push(['health', Math.round(r.health) + '%']);
        rows.push(['tray', r.tray.map(d => d.dish)]);
      } else if (this.id === 'chef') {
        rows.push(['stock', State.stock]);
        rows.push(['tickets', State.tickets.length]);
      }

      body.innerHTML = '';
      if (rows.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'watch-empty';
        empty.textContent = 'Run the script to inspect variables.';
        body.appendChild(empty);
        return;
      }
      for (const [name, value] of rows) {
        const row = document.createElement('div');
        row.className = 'watch-row';
        const k = document.createElement('span');
        k.className = 'watch-name';
        k.textContent = name;
        const v = document.createElement('span');
        v.className = 'watch-val';
        v.textContent = fmt(value);
        row.appendChild(k);
        row.appendChild(v);
        body.appendChild(row);
      }
    }

    // Called before every transpiled statement. Handles the line cursor,
    // stepping, breakpoints and the pause wait loop.
    async checkLine(num) {
      this.setLine(num);
      let stopped = false;
      if (this.stepping) {
        this.stepping = false;
        this.pause(true);
        stopped = true;
      }
      if (this.breakpoints.has(num) && !stopped) {
        this.pause(true);
        this.logFn(`Paused at breakpoint (line ${num}).`, 'info');
        stopped = true;
      }
      if (stopped) {
        this.expandWatch();
        this.renderWatch();
      }
      if (!this.paused) return;
      while (this.paused && this.running && !State[this.interruptKey]) {
        await new Promise(r => setTimeout(r, 30));
      }
      this.renderWatch();
    }

    setLine(num) {
      this.currentLine = num;
      const el = document.getElementById(this.highlightId);
      const editor = document.getElementById(this.editorId);
      if (!el || !editor) return;
      const topPos = 8 + (num - 1) * 20 - editor.scrollTop;
      el.style.top = topPos + 'px';
      el.style.display = 'block';

      // Auto-scroll viewport if line is scrolled offscreen
      const editorHeight = editor.clientHeight;
      const linePixelTop = 8 + (num - 1) * 20;
      if (linePixelTop < editor.scrollTop) {
        editor.scrollTop = Math.max(0, linePixelTop - 20);
      } else if (linePixelTop + 20 > editor.scrollTop + editorHeight) {
        editor.scrollTop = linePixelTop + 40 - editorHeight;
      }
    }

    refreshHighlight() {
      if (!this.running) return;
      this.setLine(this.currentLine);
    }

    clearHighlight() {
      const el = document.getElementById(this.highlightId);
      if (el) el.style.display = 'none';
    }

    setStatus(text, type = 'idle') {
      const ind = document.getElementById(this.statusIndicatorId);
      const txt = document.getElementById(this.statusTextId);
      if (ind) ind.className = 'status-indicator ' + type;
      if (txt) txt.textContent = text;
    }

    updateButtons() {
      const runBtn = document.getElementById(this.runBtnId);
      const pauseBtn = document.getElementById(this.pauseBtnId);
      const stepBtn = document.getElementById(this.stepBtnId);
      const stopBtn = document.getElementById(this.stopBtnId);

      if (this.running) {
        if (runBtn) runBtn.disabled = true;
        if (pauseBtn) {
          pauseBtn.disabled = false;
          pauseBtn.textContent = this.paused ? '▶ Resume' : '⏸ Pause';
        }
        if (stepBtn) stepBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = false;
      } else {
        if (runBtn) runBtn.disabled = false;
        if (pauseBtn) {
          pauseBtn.disabled = true;
          pauseBtn.textContent = '⏸ Pause';
        }
        if (stepBtn) stepBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        this.paused = false;
      }
    }

    pause(isPaused) {
      this.paused = isPaused;
      if (this.id === 'waiter') {
        State.scriptPaused = isPaused;
      } else if (this.id === 'waiter2') {
        State.waiter2ScriptPaused = isPaused;
      } else if (this.id === 'chef') {
        State.chefScriptPaused = isPaused;
      }
      this.setStatus(isPaused ? 'Paused' : 'Running...', isPaused ? 'paused' : 'running');
      this.updateButtons();
    }

    async step(code) {
      if (!this.running) {
        this.stepping = true;
        await this.run(code);
      } else {
        this.stepping = true;
        if (this.paused) {
          this.pause(false);
        }
      }
    }

    async run(code) {
      if (this.running) return;
      const usedLines = Mechanics.countCodeLines(code);
      if (usedLines > State.codeLineLimit) {
        this.setStatus(`Error: ${usedLines}/${State.codeLineLimit} lines used`, 'error');
        this.logFn(`Code storage full: ${usedLines} lines used, limit ${State.codeLineLimit}. Buy RAM Expansion in the Shop.`, 'complaint');
        this.stepping = false;
        return;
      }
      this.running = true;
      this.paused = false;
      this.watchData = {};
      const gen = this.bumpGen();
      this.activeGen = gen;
      State[this.interruptKey] = false;
      if (this.onStart) this.onStart();

      this.setStatus('Running...', 'running');
      this.logFn(`Starting ${this.id} script...`, 'info');
      this.updateButtons();

      try {
        const jsCode = this.transpile(code);
        const apiKeys = Object.keys(this.api).join(', ');
        const asyncFn = new Function('API', 'State', 'Runner', `return (async function() {
          const { ${apiKeys} } = API;
          const len = (x) => (x ? (x.length !== undefined ? x.length : Object.keys(x).length) : 0);
          ${jsCode}
        })();`);

        await asyncFn(this.api, State, this);
        if (this.activeGen === gen) {
          this.setStatus('Script ended', 'idle');
          this.logFn(`${this.id} script ended naturally.`, 'info');
        }
      } catch (err) {
        if (this.activeGen === gen && !State[this.interruptKey]) {
          console.error(`${this.id} Script Error:`, err);
          this.setStatus('Error: ' + err.message, 'error');
          this.logFn(`Runtime Error: ${err.message}`, 'complaint');
        }
      } finally {
        // A newer run/stop already owns this runner; do not clobber its state.
        if (this.activeGen === gen) {
          this.running = false;
          this.stepping = false;
          this.clearHighlight();
          if (this.onStop) this.onStop();
          this.updateButtons();
        }
      }
    }

    stop() {
      State[this.interruptKey] = true;
      this.activeGen = null; // invalidate any in-flight loop
      this.bumpGen();
      if (this.id === 'waiter') {
        State.robot.pathQueue = [];
      } else if (this.id === 'waiter2') {
        State.robot2.pathQueue = [];
      }
      this.running = false;
      this.paused = false;
      this.stepping = false;
      this.clearHighlight();
      if (this.onStop) this.onStop();
      this.setStatus(this.id === 'chef' ? 'Auto-Chef Active' : 'Stopped by player', 'idle');
      this.logFn(`${this.id} script stopped.`, 'warn');
      this.updateButtons();
    }

    transpile(py) {
      const lines = py.split('\n');
      const jsLines = [];
      const indentStack = [0];
      const vars = new Set();

      // Collect assigned variable names for hoisted declaration
      for (let rawLine of lines) {
        const commentIdx = rawLine.indexOf('#');
        let line = commentIdx !== -1 ? rawLine.slice(0, commentIdx) : rawLine;
        const trimmed = line.trim();
        const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=/);
        if (assignMatch) {
          vars.add(assignMatch[1]);
        }
      }

      for (let idx = 0; idx < lines.length; idx++) {
        const rawLine = lines[idx];
        const lineNum = idx + 1;
        const commentIdx = rawLine.indexOf('#');
        let line = commentIdx !== -1 ? rawLine.slice(0, commentIdx) : rawLine;
        if (!line.trim()) continue;

        const indent = line.search(/\S/);
        let trimmed = line.trim();

        // Handle dedent blocks
        while (indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
          jsLines.push(' '.repeat(indentStack[indentStack.length - 1]) + '}');
        }

        let converted = trimmed;

        // Python keywords conversion
        converted = converted.replace(/\band\b/g, '&&');
        converted = converted.replace(/\bor\b/g, '||');
        converted = converted.replace(/\bnot\b/g, '!');
        converted = converted.replace(/\bTrue\b/g, 'true');
        converted = converted.replace(/\bFalse\b/g, 'false');
        converted = converted.replace(/\bNone\b/g, 'null');

        // Async calls mapping (both waiter and chef methods)
        const asyncMethods = ['seat', 'take_order', 'deliver', 'go_charge', 'repair', 'wait', 'cook'];
        for (const m of asyncMethods) {
          const regex = new RegExp(`\\b${m}\\s*\\(`, 'g');
          converted = converted.replace(regex, `await ${m}(`);
        }

        // Loop / If conditions with line tracking & stepping support
        if (converted.startsWith('while ') && converted.endsWith(':')) {
          const cond = converted.slice(6, -1).trim();
          const gen = this.activeGen;
          converted = `while (${cond}) { await Runner.tick(); if (Runner.cancelled(${gen})) break; await Runner.checkLine(${lineNum});`;
          indentStack.push(indent + 4);
        } else if (converted.startsWith('if ') && converted.endsWith(':')) {
          const cond = converted.slice(3, -1).trim();
          jsLines.push(' '.repeat(indent) + `await Runner.checkLine(${lineNum});`);
          converted = `if (${cond}) {`;
          indentStack.push(indent + 4);
        } else if (converted.startsWith('elif ') && converted.endsWith(':')) {
          const cond = converted.slice(5, -1).trim();
          converted = `} else if (${cond}) { await Runner.checkLine(${lineNum});`;
        } else if (converted === 'else:') {
          converted = `} else { await Runner.checkLine(${lineNum});`;
        } else {
          jsLines.push(' '.repeat(indent) + `await Runner.checkLine(${lineNum});`);
          converted = converted + ';';
        }

        jsLines.push(' '.repeat(indent) + converted);

        // After each plain statement, snapshot the hoisted locals for the watch panel.
        if (vars.size > 0 && !converted.startsWith('while ') && !converted.endsWith('{')) {
          jsLines.push(' '.repeat(indent) + `Runner.snapshot({ ${Array.from(vars).join(', ')} });`);
        }
      }

      while (indentStack.length > 1) {
        indentStack.pop();
        jsLines.push('}');
      }

      const varHeader = vars.size > 0 ? `let ${Array.from(vars).join(', ')};\n` : '';
      return varHeader + jsLines.join('\n');
    }
  }

  const waiterRunner = new ScriptRunner({
    id: 'waiter',
    api: WaiterAPI,
    statusIndicatorId: 'status-indicator',
    statusTextId: 'status-text',
    editorId: 'code-editor',
    highlightId: 'waiter-line-highlight',
    runBtnId: 'script-run',
    pauseBtnId: 'script-pause',
    stepBtnId: 'script-step',
    stopBtnId: 'script-stop',
    interruptKey: 'scriptInterrupt',
    debug: { gutterId: 'waiter-gutter', watchId: 'waiter-watch', watchBodyId: 'waiter-watch-body', watchToggleId: 'waiter-watch-toggle' },
    logFn: logMessage
  });

  const chefRunner = new ScriptRunner({
    id: 'chef',
    api: ChefAPI,
    statusIndicatorId: 'chef-status-indicator',
    statusTextId: 'chef-status-text',
    editorId: 'chef-code-editor',
    highlightId: 'chef-line-highlight',
    runBtnId: 'chef-run',
    pauseBtnId: 'chef-pause',
    stepBtnId: 'chef-step',
    stopBtnId: 'chef-stop',
    interruptKey: 'chefScriptInterrupt',
    debug: { gutterId: 'chef-gutter', watchId: 'chef-watch', watchBodyId: 'chef-watch-body', watchToggleId: 'chef-watch-toggle' },
    logFn: logChefMessage,
    onStart: () => { State.chefMode = 'scripted'; },
    onStop: () => { State.chefMode = 'auto'; }
  });

  const waiter2Runner = new ScriptRunner({
    id: 'waiter2',
    api: Waiter2API,
    statusIndicatorId: 'waiter2-status-indicator',
    statusTextId: 'waiter2-status-text',
    editorId: 'waiter2-code-editor',
    highlightId: 'waiter2-line-highlight',
    runBtnId: 'waiter2-run',
    pauseBtnId: 'waiter2-pause',
    stepBtnId: 'waiter2-step',
    stopBtnId: 'waiter2-stop',
    interruptKey: 'waiter2ScriptInterrupt',
    debug: { gutterId: 'waiter2-gutter', watchId: 'waiter2-watch', watchBodyId: 'waiter2-watch-body', watchToggleId: 'waiter2-watch-toggle' },
    logFn: logWaiter2Message
  });

  // --- UI & Windows Logic ---
  function initWindows() {
    document.querySelectorAll('.win-panel').forEach(win => {
      const titlebar = win.querySelector('.win-titlebar');
      const minBtn = win.querySelector('.win-min');
      const closeBtn = win.querySelector('.win-close');
      const body = win.querySelector('.win-body');

      let isDragging = false;
      let startX, startY, startLeft, startTop;

      titlebar.addEventListener('mousedown', e => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = win.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        // Bring to front
        document.querySelectorAll('.win-panel').forEach(w => w.style.zIndex = 40);
        win.style.zIndex = 50;
      });

      window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        win.style.left = (startLeft + (e.clientX - startX)) + 'px';
        win.style.top = (startTop + (e.clientY - startY)) + 'px';
        win.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => { isDragging = false; });

      if (minBtn) {
        minBtn.addEventListener('click', () => {
          body.style.display = body.style.display === 'none' ? 'flex' : 'none';
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          win.style.display = 'none';
        });
      }
    });

    // Toggle HUD buttons for windows
    document.getElementById('toggle-waiter').onclick = () => {
      const w = document.getElementById('win-terminal');
      w.style.display = w.style.display === 'none' ? 'flex' : 'none';
    };
    document.getElementById('toggle-waiter2').onclick = () => {
      const w = document.getElementById('win-waiter2');
      w.style.display = w.style.display === 'none' ? 'flex' : 'none';
    };
    document.getElementById('toggle-chef').onclick = () => {
      const w = document.getElementById('win-chef');
      w.style.display = w.style.display === 'none' ? 'flex' : 'none';
      if (w.style.display === 'flex') State.tutorialFlags.chefOpened = true;
    };
    document.getElementById('tut-resume').onclick = closeTutorial;
    document.getElementById('tut-close').onclick = closeTutorial;
    document.getElementById('tut-copy').onclick = () => {
      const text = document.getElementById('tut-snippet').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    };
    const reviewList = document.getElementById('tutorial-review-list');
    if (reviewList) {
      reviewList.onclick = e => {
        const btn = e.target.closest('[data-tut]');
        if (!btn) return;
        const t = TUTORIALS.find(x => x.id === btn.dataset.tut);
        if (t) showTutorial(t);
      };
    }
    document.getElementById('toggle-achievements').onclick = () => {
      const w = document.getElementById('win-achievements');
      w.style.display = w.style.display === 'none' ? 'flex' : 'none';
      renderAchievements();
    };
    document.getElementById('toggle-shop').onclick = () => {
      const w = document.getElementById('win-shop');
      w.style.display = w.style.display === 'none' ? 'flex' : 'none';
    };

    // Handbook pages (PRD Section 10)
    let handbookPage = 1;
    const HANDBOOK_PAGES = 5;
    const showHandbookPage = (n) => {
      handbookPage = Math.min(HANDBOOK_PAGES, Math.max(1, n));
      document.querySelectorAll('#win-handbook .hb-page').forEach(el => {
        el.classList.toggle('active', Number(el.dataset.page) === handbookPage);
      });
      const label = document.getElementById('hb-page-label');
      if (label) label.textContent = `Page ${handbookPage} / ${HANDBOOK_PAGES}`;
    };
    document.getElementById('toggle-handbook').onclick = () => {
      const w = document.getElementById('win-handbook');
      w.style.display = w.style.display === 'none' ? 'flex' : 'none';
      showHandbookPage(handbookPage);
      renderTutorialReview();
    };
    document.getElementById('hb-prev').onclick = () => showHandbookPage(handbookPage - 1);
    document.getElementById('hb-next').onclick = () => showHandbookPage(handbookPage + 1);

    // Tabs inside Waiter Terminal
    const tabs = ['code', 'log', 'api'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-${t}-btn`);
      const pane = document.getElementById(`tab-${t}`);
      if (btn && pane) {
        btn.addEventListener('click', () => {
          tabs.forEach(other => {
            document.getElementById(`tab-${other}-btn`).classList.remove('active');
            document.getElementById(`tab-${other}`).classList.remove('active');
          });
          btn.classList.add('active');
          pane.classList.add('active');
        });
      }
    });

    // Tabs inside Chef Terminal
    const chefTabs = ['code', 'log', 'recipes'];
    chefTabs.forEach(t => {
      const btn = document.getElementById(`tab-chef-${t}-btn`);
      const pane = document.getElementById(`tab-chef-${t}`);
      if (btn && pane) {
        btn.addEventListener('click', () => {
          chefTabs.forEach(other => {
            document.getElementById(`tab-chef-${other}-btn`).classList.remove('active');
            document.getElementById(`tab-chef-${other}`).classList.remove('active');
          });
          btn.classList.add('active');
          pane.classList.add('active');
        });
      }
    });

    // Tabs inside Waiter #2 Terminal
    const waiter2Tabs = ['code', 'log'];
    waiter2Tabs.forEach(t => {
      const btn = document.getElementById(`tab-waiter2-${t}-btn`);
      const pane = document.getElementById(`tab-waiter2-${t}`);
      if (btn && pane) {
        btn.addEventListener('click', () => {
          waiter2Tabs.forEach(other => {
            document.getElementById(`tab-waiter2-${other}-btn`).classList.remove('active');
            document.getElementById(`tab-waiter2-${other}`).classList.remove('active');
          });
          btn.classList.add('active');
          pane.classList.add('active');
        });
      }
    });

    // Outer wall alpha toggle checkbox
    const chkFade = document.getElementById('toggle-outer-wall-alpha');
    chkFade.addEventListener('change', () => {
      State.fadeOuterWall = chkFade.checked;
    });

    // Shop buttons
    document.getElementById('buy-ingredients').onclick = () => {
      if (State.cash >= 20) {
        State.cash -= 20;
        State.stock += 10;
        document.getElementById('stock-count').textContent = State.stock;
        updateHUD();
        updateAchievements();
        AudioEngine.beepPay();
      }
    };

    document.getElementById('buy-upgrade-speed').onclick = (e) => {
      if (State.cash >= 140 && !State.speedUpgrade) {
        State.cash -= 140;
        State.speedUpgrade = true;
        e.target.disabled = true;
        e.target.dataset.owned = '1';
        e.target.textContent = 'Purchased';
        updateHUD();
        updateAchievements();
        AudioEngine.beepPay();
      }
    };

    document.getElementById('buy-upgrade-battery').onclick = (e) => {
      if (State.cash >= 180 && !State.batteryUpgrade) {
        State.cash -= 180;
        State.batteryUpgrade = true;
        e.target.disabled = true;
        e.target.dataset.owned = '1';
        e.target.textContent = 'Purchased';
        updateHUD();
        AudioEngine.beepPay();
      }
    };

    document.getElementById('buy-upgrade-tray').onclick = (e) => {
      if (State.cash >= 240 && !State.trayUpgrade) {
        State.cash -= 240;
        State.trayUpgrade = true;
        State.robot.trayCapacity = 2;
        State.robot2.trayCapacity = 2;
        e.target.disabled = true;
        e.target.dataset.owned = '1';
        e.target.textContent = 'Purchased';
        updateHUD();
        AudioEngine.beepPay();
        logMessage('Double Tray unlocked: Robot waiters can now carry 2 dishes!', 'success');
      }
    };

    document.getElementById('buy-firmware-nearest').onclick = (e) => {
      if (State.cash >= 50 && !State.unlockedAPIs.nearest_table) {
        State.cash -= 50;
        State.unlockedAPIs.nearest_table = true;
        e.target.disabled = true;
        e.target.dataset.owned = '1';
        e.target.textContent = 'Unlocked';
        updateHUD();
        AudioEngine.beepPay();
        logMessage('Firmware unlocked: nearest_table(status).', 'success');
      }
    };

    document.getElementById('buy-firmware-stock').onclick = (e) => {
      if (State.cash >= 85 && !State.unlockedAPIs.order_stock) {
        State.cash -= 85;
        State.unlockedAPIs.order_stock = true;
        e.target.disabled = true;
        e.target.dataset.owned = '1';
        e.target.textContent = 'Unlocked';
        updateHUD();
        AudioEngine.beepPay();
        logMessage('Firmware unlocked: order_stock(qty).', 'success');
      }
    };

    document.getElementById('buy-upgrade-codelimit').onclick = () => {
      if (State.cash >= 80) {
        State.cash -= 80;
        State.codeLineLimit += 15;
        updateHUD();
        AudioEngine.beepPay();
        logMessage(`Code storage expanded to ${State.codeLineLimit} lines.`, 'success');
      }
    };

    const hireBtn = document.getElementById('buy-hire-waiter2');
    if (hireBtn) {
      hireBtn.onclick = (e) => {
        if (State.cash >= 320 && !State.hasHiredWaiter) {
          State.cash -= 320;
          State.hasHiredWaiter = true;
          e.target.disabled = true;
          e.target.dataset.owned = '1';
          e.target.textContent = 'Hired';
          const hudBtn = document.getElementById('toggle-waiter2');
          if (hudBtn) hudBtn.style.display = 'inline-block';
          const w = document.getElementById('win-waiter2');
          if (w) w.style.display = 'flex';
          updateHUD();
          updateAchievements();
          AudioEngine.beepPay();
          logMessage('Hired Waiter Robot #2 (Cyan Unit)! Program it in the Waiter #2 terminal.', 'success');
        }
      };
    }

    // Code editor Tab key indentation & scroll-sync support (Waiter, Chef, Waiter 2)
    [
      { id: 'code-editor', runner: waiterRunner },
      { id: 'chef-code-editor', runner: chefRunner },
      { id: 'waiter2-code-editor', runner: waiter2Runner }
    ].forEach(item => {
      const ed = document.getElementById(item.id);
      if (ed) {
        ed.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = ed.selectionStart;
            const end = ed.selectionEnd;
            ed.value = ed.value.substring(0, start) + '    ' + ed.value.substring(end);
            ed.selectionStart = ed.selectionEnd = start + 4;
          }
        });
        ed.addEventListener('scroll', () => {
          item.runner.refreshHighlight();
        });
      }
    });

    // Waiter Terminal Controls
    document.getElementById('script-run').onclick = () => {
      const code = document.getElementById('code-editor').value;
      waiterRunner.run(code);
    };

    document.getElementById('script-pause').onclick = () => {
      waiterRunner.pause(!waiterRunner.paused);
    };

    document.getElementById('script-step').onclick = () => {
      const code = document.getElementById('code-editor').value;
      waiterRunner.step(code);
    };

    document.getElementById('script-stop').onclick = () => {
      waiterRunner.stop();
    };

    // Waiter #2 Terminal Controls
    document.getElementById('waiter2-run').onclick = () => {
      const code = document.getElementById('waiter2-code-editor').value;
      waiter2Runner.run(code);
    };

    document.getElementById('waiter2-pause').onclick = () => {
      waiter2Runner.pause(!waiter2Runner.paused);
    };

    document.getElementById('waiter2-step').onclick = () => {
      const code = document.getElementById('waiter2-code-editor').value;
      waiter2Runner.step(code);
    };

    document.getElementById('waiter2-stop').onclick = () => {
      waiter2Runner.stop();
    };

    // Chef Terminal Controls
    document.getElementById('chef-run').onclick = () => {
      const code = document.getElementById('chef-code-editor').value;
      chefRunner.run(code);
    };

    document.getElementById('chef-pause').onclick = () => {
      chefRunner.pause(!chefRunner.paused);
    };

    document.getElementById('chef-step').onclick = () => {
      const code = document.getElementById('chef-code-editor').value;
      chefRunner.step(code);
    };

    document.getElementById('chef-stop').onclick = () => {
      chefRunner.stop();
    };

    // Speed Controls
    const speeds = [
      { id: 'speed-pause', val: 0 },
      { id: 'speed-1x', val: 1 },
      { id: 'speed-2x', val: 2 },
      { id: 'speed-4x', val: 4 }
    ];

    speeds.forEach(s => {
      document.getElementById(s.id).onclick = () => {
        speeds.forEach(other => document.getElementById(other.id).classList.remove('active'));
        document.getElementById(s.id).classList.add('active');
        if (State.tutorialOpen) State.tutorialSpeedOverride = true;
        if (s.val === 0) {
          State.isPaused = true;
        } else {
          State.isPaused = false;
          State.speed = s.val;
        }
      };
    });

    // Main menu & settings
    document.getElementById('btn-start').onclick = () => {
      State.account = 'player';
      State.started = true;
      document.getElementById('main-menu').classList.add('hidden');
      AudioEngine.init();
      State.nextPartyTimer = Math.max(State.nextPartyTimer, 45); // breathing room for the first script
      const welcome = TUTORIALS.find(t => t.id === 'tut_welcome');
      if (welcome && !State.tutorialCompleted.includes(welcome.id)) showTutorial(welcome);
    };

    document.getElementById('btn-load').onclick = () => {
      State.account = 'player';
      State.started = true;
      loadSaveGame();
      document.getElementById('main-menu').classList.add('hidden');
      AudioEngine.init();
      const welcome = TUTORIALS.find(t => t.id === 'tut_welcome');
      if (welcome && !State.tutorialCompleted.includes(welcome.id)) showTutorial(welcome);
    };

    // Hidden developer account: full default scripts for immediate testing
    document.getElementById('btn-dev-login').onclick = () => {
      State.account = 'developer';
      State.started = true;
      Object.keys(DEV_DEFAULT_SCRIPTS).forEach(id => {
        const ed = document.getElementById(id);
        if (ed) ed.value = DEV_DEFAULT_SCRIPTS[id];
      });
      loadSaveGame();
      [waiterRunner, chefRunner, waiter2Runner].forEach(r => { if (r.renderGutter) r.renderGutter(); });
      document.getElementById('hud-dev-badge').style.display = 'inline-block';
      document.getElementById('main-menu').classList.add('hidden');
      AudioEngine.init();
    };

    document.getElementById('btn-settings').onclick = () => {
      document.getElementById('modal-settings').classList.remove('hidden');
    };

    document.getElementById('hud-settings-btn').onclick = () => {
      document.getElementById('modal-settings').classList.remove('hidden');
    };

    document.getElementById('btn-close-settings').onclick = () => {
      document.getElementById('modal-settings').classList.add('hidden');
    };

    document.getElementById('slider-sfx').oninput = e => {
      AudioEngine.volume = parseFloat(e.target.value);
    };

    document.getElementById('btn-save-game').onclick = () => {
      saveGame();
      alert('Game progress saved!');
    };

    document.getElementById('btn-reset-save').onclick = () => {
      if (confirm('Reset saved game?')) {
        localStorage.removeItem(SAVE_KEY(State.account));
        location.reload();
      }
    };
  }

  function updateScriptButtons() {
    const runBtn = document.getElementById('script-run');
    const pauseBtn = document.getElementById('script-pause');
    const stopBtn = document.getElementById('script-stop');

    if (State.scriptRunning) {
      runBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
    } else {
      runBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      pauseBtn.textContent = '⏸ Pause';
      State.scriptPaused = false;
    }
  }

  let lastShopCash = null;
  function updateShopAffordability() {
    const cash = Math.floor(State.cash);
    if (cash === lastShopCash) return;
    lastShopCash = cash;
    document.querySelectorAll('.shop-btn[data-cost]').forEach(btn => {
      const owned = btn.dataset.owned === '1';
      btn.disabled = owned || cash < Number(btn.dataset.cost);
    });
  }

  // --- Tutorial modal (player account) ---
  function syncSpeedButtons() {
    const activeId = State.isPaused ? 'speed-pause'
      : State.speed >= 4 ? 'speed-4x'
      : State.speed >= 2 ? 'speed-2x'
      : 'speed-1x';
    ['speed-pause', 'speed-1x', 'speed-2x', 'speed-4x'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === activeId);
    });
  }

  function showTutorial(t) {
    if (State.tutorialOpen) return;
    State.tutorialIsReview = State.tutorialCompleted.includes(t.id);
    State.tutorialOpen = true;
    State.tutorialWasPaused = State.isPaused;
    State.tutorialSpeedOverride = false;
    State.isPaused = true; // freeze the world so the player can read
    if (!State.tutorialIsReview) State.tutorialCompleted.push(t.id);

    document.getElementById('tut-badge').textContent = t.badge;
    document.getElementById('tut-title').textContent = t.title;
    document.getElementById('tut-body').innerHTML = t.body;
    document.getElementById('tut-api').innerHTML = (t.api || []).map(a => `<li>${a}</li>`).join('');
    const snippetEl = document.getElementById('tut-snippet');
    if (snippetEl) snippetEl.textContent = t.snippet || '';
    document.getElementById('tut-snippet-wrap').style.display = t.snippet ? 'block' : 'none';
    document.getElementById('tut-disable').checked = false;
    const panel = document.getElementById('modal-tutorial');
    panel.classList.remove('hidden');
    panel.style.display = 'flex';
    syncSpeedButtons();
    renderTutorialReview();
    if (State.started) saveGame();
  }

  function closeTutorial() {
    const disable = document.getElementById('tut-disable');
    if (disable && disable.checked) State.tutorialsDisabled = true;
    const panel = document.getElementById('modal-tutorial');
    panel.classList.add('hidden');
    panel.style.display = 'none';
    State.tutorialOpen = false;
    State.isPaused = State.tutorialSpeedOverride ? State.isPaused : State.tutorialWasPaused;
    State.tutorialSpeedOverride = false;
    if (!State.tutorialIsReview) {
      State.tutorialCooldown = 6; // let the player read the result before the next card
      State.nextPartyTimer = Math.max(State.nextPartyTimer, 25); // quiet time to write code
    }
    syncSpeedButtons();
    if (State.started) saveGame();
  }

  function renderTutorialReview() {
    const list = document.getElementById('tutorial-review-list');
    if (!list) return;
    const seen = TUTORIALS.filter(t => State.tutorialCompleted.includes(t.id));
    list.innerHTML = seen.length
      ? seen.map(t => `<button class="tut-review-btn" data-tut="${t.id}">${t.title}</button>`).join('')
      : '<p class="hb-intro">No tutorial cards seen yet.</p>';
  }

  function checkTutorialTriggers() {
    if (!State.started || State.account !== 'player' || State.tutorialsDisabled || State.tutorialOpen) return;
    if (State.tutorialCooldown > 0) return;
    // Never interrupt someone mid-line in an editor.
    const focused = document.activeElement;
    if (focused && focused.tagName === 'TEXTAREA') return;
    const next = Mechanics.nextTutorial(TUTORIALS, State.tutorialCompleted, State);
    if (next) showTutorial(next);
  }

  // Early shifts run at a gentler customer rate until the player has served a full loop.
  function tutorialPacingFactor() {
    if (State.account !== 'player' || State.tutorialsDisabled) return 1;
    return State.tutorialCompleted.includes('tut_first_pay') ? 1 : 2;
  }

  function updateHUD() {
    // Stars
    const fullStars = Math.round(State.reputation);
    document.getElementById('hud-stars').textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
    document.getElementById('hud-cash').textContent = Math.floor(State.cash);
    document.getElementById('hud-day').textContent = State.day;
    document.getElementById('hud-time').textContent = formatGameTime(State.timeSeconds);
    document.getElementById('hud-battery').textContent = `${Math.round(State.robot.battery)}%`;
    const healthEl = document.getElementById('hud-health');
    const health = Math.round(State.robot.health);
    healthEl.textContent = `${health}%`;
    healthEl.classList.toggle('low', health <= 20);

    // Rush hour banner
    const rush = getCurrentRush();
    const rushEl = document.getElementById('hud-rush');
    const badgeEl = document.getElementById('rush-badge');
    if (rush && rushEl && badgeEl) {
      rushEl.classList.remove('hidden');
      badgeEl.textContent = `🔥 ${rush.name.toUpperCase()}`;
    } else if (rushEl) {
      rushEl.classList.add('hidden');
    }

    // Day/Night class
    if (isNight()) {
      document.body.classList.add('night-mode');
      document.body.classList.remove('day-mode');
    } else {
      document.body.classList.add('day-mode');
      document.body.classList.remove('night-mode');
    }

    updateShopAffordability();
  }

  // --- Save & Load ---
  function saveGame() {
    const data = {
      cash: State.cash,
      reputation: State.reputation,
      day: State.day,
      timeSeconds: State.timeSeconds,
      stock: State.stock,
      speedUpgrade: State.speedUpgrade,
      batteryUpgrade: State.batteryUpgrade,
      trayUpgrade: State.trayUpgrade,
      hasHiredWaiter: State.hasHiredWaiter,
      unlockedAPIs: State.unlockedAPIs,
      codeLineLimit: State.codeLineLimit,
      totalServed: State.totalServed,
      totalNightServed: State.totalNightServed,
      tutorialCompleted: State.tutorialCompleted,
      tutorialsDisabled: State.tutorialsDisabled,
      robotHealth: State.robot.health,
      robot2Health: State.robot2.health,
      achievements: State.achievements,
      code: document.getElementById('code-editor') ? document.getElementById('code-editor').value : '',
      chefCode: document.getElementById('chef-code-editor') ? document.getElementById('chef-code-editor').value : '',
      waiter2Code: document.getElementById('waiter2-code-editor') ? document.getElementById('waiter2-code-editor').value : ''
    };
    localStorage.setItem(SAVE_KEY(State.account), JSON.stringify(data));
  }

  function loadSaveGame() {
    const key = SAVE_KEY(State.account);
    let saved = localStorage.getItem(key);
    // Migrate the old single-account save into the player account once
    if (!saved && State.account === 'player') {
      saved = localStorage.getItem('traynerror_savedata');
      if (saved) localStorage.setItem(key, saved);
    }
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      State.cash = data.cash !== undefined ? data.cash : 50;
      State.reputation = data.reputation || 5.0;
      State.day = data.day || 1;
      State.timeSeconds = data.timeSeconds || 8 * 3600;
      State.stock = data.stock !== undefined ? data.stock : 30;
      State.speedUpgrade = !!data.speedUpgrade;
      State.batteryUpgrade = !!data.batteryUpgrade;
      State.trayUpgrade = !!data.trayUpgrade;
      State.hasHiredWaiter = !!data.hasHiredWaiter;
      State.unlockedAPIs = Object.assign({ nearest_table: false, order_stock: false }, data.unlockedAPIs || {});
      State.codeLineLimit = data.codeLineLimit || 25;
      State.totalServed = data.totalServed || 0;
      State.totalNightServed = data.totalNightServed || 0;
      State.tutorialCompleted = Array.isArray(data.tutorialCompleted) ? data.tutorialCompleted : [];
      State.tutorialsDisabled = !!data.tutorialsDisabled;
      State.robot.health = data.robotHealth !== undefined ? data.robotHealth : 100;
      State.robot2.health = data.robot2Health !== undefined ? data.robot2Health : 100;
      if (data.achievements && Array.isArray(data.achievements)) {
        // Merge saved unlock states
        for (const savedA of data.achievements) {
          const match = State.achievements.find(a => a.id === savedA.id);
          if (match) match.unlocked = !!savedA.unlocked;
        }
      }
      State.robot.trayCapacity = State.trayUpgrade ? 2 : 1;
      State.robot2.trayCapacity = State.trayUpgrade ? 2 : 1;

      if (data.code !== undefined && data.code !== null && document.getElementById('code-editor')) {
        document.getElementById('code-editor').value = data.code;
      }
      if (data.chefCode !== undefined && data.chefCode !== null && document.getElementById('chef-code-editor')) {
        document.getElementById('chef-code-editor').value = data.chefCode;
      }
      if (data.waiter2Code !== undefined && data.waiter2Code !== null && document.getElementById('waiter2-code-editor')) {
        document.getElementById('waiter2-code-editor').value = data.waiter2Code;
      }
      [waiterRunner, chefRunner, waiter2Runner].forEach(r => { if (r.renderGutter) r.renderGutter(); });

      document.getElementById('stock-count').textContent = State.stock;
      if (State.speedUpgrade) {
        const b = document.getElementById('buy-upgrade-speed');
        if (b) { b.disabled = true; b.dataset.owned = '1'; b.textContent = 'Purchased'; }
      }
      if (State.batteryUpgrade) {
        const b = document.getElementById('buy-upgrade-battery');
        if (b) { b.disabled = true; b.dataset.owned = '1'; b.textContent = 'Purchased'; }
      }
      if (State.trayUpgrade) {
        const b = document.getElementById('buy-upgrade-tray');
        if (b) { b.disabled = true; b.dataset.owned = '1'; b.textContent = 'Purchased'; }
      }
      if (State.unlockedAPIs.nearest_table) {
        const b = document.getElementById('buy-firmware-nearest');
        if (b) { b.disabled = true; b.dataset.owned = '1'; b.textContent = 'Unlocked'; }
      }
      if (State.unlockedAPIs.order_stock) {
        const b = document.getElementById('buy-firmware-stock');
        if (b) { b.disabled = true; b.dataset.owned = '1'; b.textContent = 'Unlocked'; }
      }
      if (State.hasHiredWaiter) {
        const b = document.getElementById('buy-hire-waiter2');
        if (b) { b.disabled = true; b.dataset.owned = '1'; b.textContent = 'Hired'; }
        const hudBtn = document.getElementById('toggle-waiter2');
        if (hudBtn) hudBtn.style.display = 'inline-block';
      }
      updateHUD();
      renderAchievements();
      logMessage('Game loaded from save.', 'success');
    } catch (e) {
      console.error(e);
    }
  }

  // --- Main Game Loop (Fixed Timestep Simulation) ---
  let lastTime = performance.now();
  const FIXED_STEP = 1 / 30; // 30 ticks per second base
  let accumulator = 0;
  let autosaveTimer = 0;

  function tick(simDt) {
    if (State.isPaused) return;

    // Advance game clock
    const clockScale = (24 * 3600) / State.dayLengthRealSec;
    State.timeSeconds += simDt * clockScale;

    // Day rollover (24 hours)
    if (State.timeSeconds >= 24 * 3600) {
      State.timeSeconds -= 24 * 3600;
      State.day++;
      logMessage(`Day ${State.day} begins! Rent & upkeep charged ($${BalanceConfig.rentDaily}).`, 'info');
      State.cash = Math.max(0, State.cash - BalanceConfig.rentDaily);
      if (State.started) saveGame(); // Autosave daily
    }

    updateCustomers(simDt);
    updateKitchen(simDt);
    updateRobot(simDt);
    if (State.tutorialCooldown > 0) State.tutorialCooldown -= simDt;
    checkTutorialTriggers();
  }

  function mainLoop(now) {
    requestAnimationFrame(mainLoop);
    const dt = Math.min((now - lastTime) / 1000, 0.2);
    lastTime = now;

    if (!State.isPaused) {
      accumulator += dt * State.speed;
      while (accumulator >= FIXED_STEP) {
        tick(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }
    }

    autosaveTimer += dt;
    if (autosaveTimer >= 60) {
      autosaveTimer = 0;
      if (State.started) saveGame();
    }

    updateHUD();
    render();
  }

  // --- Bootstrap ---
  if (typeof window !== 'undefined' && window.__TRAY_TEST__) {
    window.__TrayTest = { runners: { waiter: waiterRunner, chef: chefRunner, waiter2: waiter2Runner }, State, BalanceConfig };
  }

  window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    initCameraControls();
    initWindows();
    [waiterRunner, chefRunner, waiter2Runner].forEach(r => r.initDebugger());
    updateScriptButtons();
    renderAchievements();
    loadAssets(() => {
      console.log('All Tray & Error assets loaded successfully.');
    });
    requestAnimationFrame(mainLoop);
  });

})();

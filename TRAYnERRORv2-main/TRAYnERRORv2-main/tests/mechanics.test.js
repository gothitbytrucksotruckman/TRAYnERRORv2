const assert = require('assert');
const M = require('../src/mechanics.js');

const tables = [
  { id: 1, x: 2, y: 2, seats: 2, occupiedBy: null, orderReady: false, orderTaken: false, dishServed: false },
  { id: 5, x: 5, y: 4, seats: 4, occupiedBy: { id: 9 }, orderReady: true, orderTaken: false, dishServed: false },
  { id: 6, x: 8, y: 4, seats: 4, occupiedBy: null, orderReady: false, orderTaken: false, dishServed: true }
];

assert.strictEqual(M.nearestTable(tables, 1, 1, 'free').id, 1);
assert.strictEqual(M.nearestTable(tables, 7, 4, 'free').id, 6);
assert.strictEqual(M.nearestTable(tables, 1, 1, 'order').id, 5);
assert.strictEqual(M.nearestTable(tables, 1, 1, 'served').id, 6);
assert.strictEqual(M.nearestTable(tables, 1, 1, 'bogus'), null);

assert.strictEqual(M.countCodeLines('# comment\n\nwhile True:\n    wait(1)\n  # indented\n'), 2);

assert.strictEqual(M.specialRequestMissed({ note: 'no onions' }, null), true);
assert.strictEqual(M.specialRequestMissed({ note: '' }, {}), false);
assert.strictEqual(M.specialRequestMissed({ note: 'no onions' }, { handledNote: true }), false);
assert.strictEqual(M.noteComplaint('no onions'), 'I said NO ONIONS!');
assert.strictEqual(M.noteComplaint('add cheese'), 'I asked for "add cheese"!');

// Zombie-run guard: a loop keeps running only for its own generation.
assert.strictEqual(M.loopCancelled(false, 1, 1), false);
assert.strictEqual(M.loopCancelled(true, 1, 1), true);   // player pressed Stop
assert.strictEqual(M.loopCancelled(false, 2, 1), true);  // newer run superseded this one
assert.strictEqual(M.loopCancelled(false, 0, 0), false);

// PRD §7: Refund System tests
assert.strictEqual(M.calculateRefund('missed_note', null, { name: 'Regular' }), 5);
assert.strictEqual(M.calculateRefund('missed_note', null, { name: 'Critic' }), 8);
assert.strictEqual(M.calculateRefund('food_delay', null, { name: 'Regular' }), 10);
assert.strictEqual(M.calculateRefund('food_delay', null, { name: 'Critic' }), 16);
assert.strictEqual(M.calculateRefund('seating_delay', null, { name: 'Regular' }), 0);
assert.strictEqual(M.calculateRefund('seating_delay', null, { name: 'Critic' }), 6);
assert.strictEqual(M.calculateRefund('broken_reservation', null, { name: 'VIP' }), 20);
assert.strictEqual(M.calculateRefund('out_of_stock', null, null), 8);

// PRD §7: Reservation tests
const sampleReservations = [
  { id: 1, tableId: 2, seated: false, cancelled: false },
  { id: 2, tableId: 3, seated: true, cancelled: false } // already seated, table is now normal
];
assert.strictEqual(M.isTableReserved(2, sampleReservations), true);
assert.strictEqual(M.isTableReserved({ id: 2 }, sampleReservations), true);
assert.strictEqual(M.isTableReserved(3, sampleReservations), false);
assert.strictEqual(M.isTableReserved(4, sampleReservations), false);

// Can seat walk-in party at unreserved table
const walkInParty = { id: 10, size: 2, isReservation: false };
const reservedParty = { id: 11, size: 2, isReservation: true, targetTableId: 2 };
const table1 = { id: 1, seats: 2, occupiedBy: null };
const table2 = { id: 2, seats: 2, occupiedBy: null }; // reserved

assert.strictEqual(M.canSeatParty(walkInParty, table1, sampleReservations).allowed, true);
// Walk-in cannot take reserved table 2:
const walkInBlocked = M.canSeatParty(walkInParty, table2, sampleReservations);
assert.strictEqual(walkInBlocked.allowed, false);
assert.strictEqual(walkInBlocked.reason, 'table_reserved');

// Reserved party CAN take reserved table 2:
assert.strictEqual(M.canSeatParty(reservedParty, table2, sampleReservations).allowed, true);
// Reserved party cannot take wrong table:
assert.strictEqual(M.canSeatParty(reservedParty, table1, sampleReservations).allowed, false);

// PRD §6: Floor Spills tests
const sampleSpills = [{ id: 1, x: 4, y: 5 }, { id: 2, x: 7, y: 3 }];
assert.strictEqual(M.isSpillAt(sampleSpills, 4, 5), true);
assert.strictEqual(M.isSpillAt(sampleSpills, 7, 3), true);
assert.strictEqual(M.isSpillAt(sampleSpills, 4, 4), false);

console.log('All mechanics unit tests (including Refunds, Reservations, Spills) passed successfully!');

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

console.log('mechanics checks passed');

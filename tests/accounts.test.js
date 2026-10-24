// Assert-based checks for Player/Developer account setup (node tests/accounts.test.js)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { countCodeLines } = require('../src/mechanics.js');

const root = path.join(__dirname, '..');
const gameSrc = fs.readFileSync(path.join(root, 'src/game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Extract the developer default scripts object literal
const marker = 'const DEV_DEFAULT_SCRIPTS = {';
const start = gameSrc.indexOf(marker);
assert(start !== -1, 'DEV_DEFAULT_SCRIPTS missing');
const objectStart = gameSrc.indexOf('{', start);
const objectEnd = gameSrc.indexOf('\n  };', objectStart);
assert(objectEnd !== -1, 'DEV_DEFAULT_SCRIPTS block unclosed');
const scripts = new Function('return ' + gameSrc.slice(objectStart, objectEnd + 4))();

const ids = ['code-editor', 'chef-code-editor', 'waiter2-code-editor'];
assert.deepStrictEqual(Object.keys(scripts).sort(), ids.slice().sort(), 'dev defaults must cover all three editors');

// Dev scripts must run under the starting 25-line budget
for (const id of ids) {
  const used = countCodeLines(scripts[id]);
  assert(used > 0, `${id} dev default is empty`);
  assert(used <= 25, `${id} dev default uses ${used} lines, over the 25-line limit`);
}

// Player editors ship empty
for (const id of ids) {
  const empty = new RegExp(`<textarea id="${id}"[^>]*></textarea>`);
  assert(empty.test(html), `${id} must start empty for the player account`);
}

// Player is the default account; dev entry is a hidden title-screen button
assert(/account: 'player'/.test(gameSrc), 'default account must be player');
assert(/id="btn-dev-login"/.test(html), 'dev login button missing');
assert(/btn-dev-login'\)\.onclick/.test(gameSrc), 'dev login handler missing');
assert(/'developer'/.test(gameSrc) && /traynerror_savedata_\$\{/.test(gameSrc), 'developer save key missing');

console.log('accounts: all checks passed');

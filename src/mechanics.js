// Pure gameplay helpers. Browser: window.Mechanics. Node: module.exports (for tests).
(function (root) {
  const TABLE_FILTERS = {
    free: t => !t.occupiedBy,
    order: t => t.occupiedBy && t.orderReady && !t.orderTaken,
    served: t => !!t.dishServed
  };

  function nearestTable(tables, fromX, fromY, status = 'free') {
    const filter = TABLE_FILTERS[status];
    if (!filter) return null;
    let best = null;
    let bestDist = Infinity;
    for (const t of tables) {
      if (!filter(t)) continue;
      const dist = Math.abs(t.x - fromX) + Math.abs(t.y - fromY);
      if (dist < bestDist) {
        best = t;
        bestDist = dist;
      }
    }
    return best ? { id: best.id, seats: best.seats, x: best.x, y: best.y } : null;
  }

  function countCodeLines(code) {
    return String(code || '')
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('#'))
      .length;
  }

  function specialRequestMissed(order, servedDish) {
    return !!(order && order.note && !(servedDish && servedDish.handledNote));
  }

  const NOTE_COMPLAINTS = {
    'no onions': 'I said NO ONIONS!',
    'extra crispy': 'This is not extra crispy at all!',
    'extra spicy': 'This has zero spice!',
    'dressing on side': 'You drowned it in dressing! I wanted it on the side!',
    'extra hot': 'My food arrived cold!'
  };

  function noteComplaint(note) {
    return NOTE_COMPLAINTS[note] || `I asked for "${note}"!`;
  }

  function loopCancelled(interruptFlag, currentGen, startGen) {
    return !!interruptFlag || (currentGen || 0) !== (startGen || 0);
  }

  const api = { nearestTable, countCodeLines, specialRequestMissed, noteComplaint, loopCancelled };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mechanics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

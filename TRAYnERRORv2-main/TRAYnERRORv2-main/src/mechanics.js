// Pure gameplay helpers. Browser: window.Mechanics. Node: module.exports (for tests).
(function (root) {
  const TABLE_FILTERS = {
    free: t => !t.occupiedBy && !t.reserved,
    all_free: t => !t.occupiedBy,
    reserved: t => !!t.reserved,
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

  // PRD §7: Refund System
  function calculateRefund(reason, order = null, archetype = null) {
    const isCritic = archetype && (archetype.name === 'Critic' || archetype === 'Critic');
    switch (reason) {
      case 'missed_note':
        // Tip forfeited + compensation voucher ($5, Critic $8)
        return isCritic ? 8 : 5;
      case 'food_delay':
        // Walkout compensation for severe kitchen/waiter delay
        return isCritic ? 16 : 10;
      case 'seating_delay':
        // Only picky critics demand a voucher after walking out at the entrance
        return isCritic ? 6 : 0;
      case 'broken_reservation':
        // Reserved table was taken or unavailable when reservation arrived
        return 20;
      case 'out_of_stock':
        // Apology credit for failing an accepted order
        return 8;
      default:
        return 5;
    }
  }

  // PRD §7: Table Reservations
  function isTableReserved(tableOrId, reservations) {
    const tableId = typeof tableOrId === 'object' && tableOrId !== null ? tableOrId.id : tableOrId;
    if (!reservations || !Array.isArray(reservations)) return false;
    return reservations.some(r => r.tableId === tableId && !r.seated && !r.cancelled);
  }

  function canSeatParty(party, table, reservations) {
    if (!party || !table) return { allowed: false, reason: 'invalid_target' };
    if (table.occupiedBy) return { allowed: false, reason: 'occupied' };
    if (table.seats < party.size) return { allowed: false, reason: 'too_small' };

    const reserved = isTableReserved(table.id, reservations) || !!table.reserved;
    if (party.isReservation) {
      if (party.targetTableId && party.targetTableId !== table.id) {
        return { allowed: false, reason: 'wrong_reserved_table' };
      }
      return { allowed: true, reason: null };
    }

    if (reserved) {
      return { allowed: false, reason: 'table_reserved' };
    }
    return { allowed: true, reason: null };
  }

  // PRD §6: Obstacles & Floor Spills
  function isSpillAt(spills, x, y) {
    if (!spills || !Array.isArray(spills)) return false;
    return spills.some(s => s.x === x && s.y === y);
  }

  const api = {
    nearestTable,
    countCodeLines,
    specialRequestMissed,
    noteComplaint,
    loopCancelled,
    calculateRefund,
    isTableReserved,
    canSeatParty,
    isSpillAt
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mechanics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

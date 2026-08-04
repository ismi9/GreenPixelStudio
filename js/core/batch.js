/**
 * [2] Batch Manager — Batches: tracking receipts and write-offs
 * Stable since v1.0
 */
LifeStock.register('BatchManager', (function () {
  const store = LifeStock.store;
  let batches = store.get('batches', []);

  function save() { store.set('batches', batches); }

  function add(data) {
    const b = {
      id: 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      productId: data.productId,
      quantity: data.quantity || 0,
      remaining: data.quantity || 0,
      storageId: data.storageId || null,
      expiryDate: data.expiryDate || null,
      receivedDate: data.receivedDate || new Date().toISOString().split('T')[0],
      batchNumber: data.batchNumber || 'B-' + Date.now(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    batches.push(b);
    save();
    LifeStock.emit('batch:added', b);
    return b;
  }

  function writeOff(batchId, quantity, reason) {
    const b = batches.find(x => x.id === batchId);
    if (!b || b.remaining < quantity) return null;
    b.remaining -= quantity;
    if (b.remaining <= 0) b.status = 'depleted';
    b.lastWriteOff = { quantity, reason: reason || 'manual', date: new Date().toISOString() };
    save();
    LifeStock.emit('batch:writeoff', { batchId, quantity, reason });
    return b;
  }

  function list(filter) {
    let r = [...batches];
    if (filter && filter.productId) r = r.filter(b => b.productId === filter.productId);
    if (filter && filter.storageId) r = r.filter(b => b.storageId === filter.storageId);
    if (filter && filter.status) r = r.filter(b => b.status === filter.status);
    return r.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  function get(id) { return batches.find(x => x.id === id) || null; }
  function remove(id) { batches = batches.filter(x => x.id !== id); save(); }

  function daysUntilExpiry(batchId) {
    const b = get(batchId);
    if (!b || !b.expiryDate) return null;
    const diff = new Date(b.expiryDate) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function getExpiring(days) {
    return batches.filter(b => {
      if (b.status !== 'active' || !b.expiryDate) return false;
      return daysUntilExpiry(b.id) !== null && daysUntilExpiry(b.id) <= days;
    });
  }

  return { add, writeOff, list, get, remove, daysUntilExpiry, getExpiring };
})());

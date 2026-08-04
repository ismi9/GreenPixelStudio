/**
 * [10] Synchronization — Sync between devices, offline-first
 * Stable since v1.0
 * Uses localStorage as local cache. Sync stub for future remote backend.
 * Works OFFLINE — all data persists locally. Remote sync is optional.
 */
LifeStock.register('SyncManager', (function () {
  let isOnline = navigator.onLine;
  let lastSync = null;
  let pendingChanges = 0;

  function init() {
    window.addEventListener('online', () => { isOnline = true; LifeStock.emit('sync:online'); attemptSync(); });
    window.addEventListener('offline', () => { isOnline = false; LifeStock.emit('sync:offline'); });

    LifeStock.on('product:added', () => pendingChanges++);
    LifeStock.on('product:updated', () => pendingChanges++);
    LifeStock.on('product:removed', () => pendingChanges++);
    LifeStock.on('batch:added', () => pendingChanges++);
    LifeStock.on('batch:writeoff', () => pendingChanges++);

    const last = LifeStock.store.get('lastSync', null);
    if (last) lastSync = last;
  }

  function getStatus() {
    return {
      online: isOnline,
      lastSync: lastSync,
      pendingChanges,
    };
  }

  // In real app: POST to remote API. Here: simulate local persistence.
  function attemptSync() {
    if (!isOnline) return { success: false, reason: 'offline' };
    // Simulate sync — in production would push to server
    lastSync = new Date().toISOString();
    pendingChanges = 0;
    LifeStock.store.set('lastSync', lastSync);
    LifeStock.emit('sync:complete', { lastSync });
    return { success: true, lastSync };
  }

  function exportData() {
    return {
      version: LifeStock.version,
      exportedAt: new Date().toISOString(),
      data: {
        products: LifeStock.store.get('products', []),
        categories: LifeStock.store.get('categories', []),
        batches: LifeStock.store.get('batches', []),
        storage: LifeStock.store.get('storage', []),
        recipes: LifeStock.store.get('recipes', []),
        notifications: LifeStock.store.get('notifications', []),
      }
    };
  }

  function importData(json) {
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      if (!obj.data) throw new Error('Invalid format');
      const d = obj.data;
      if (d.products) LifeStock.store.set('products', d.products);
      if (d.categories) LifeStock.store.set('categories', d.categories);
      if (d.batches) LifeStock.store.set('batches', d.batches);
      if (d.storage) LifeStock.store.set('storage', d.storage);
      if (d.recipes) LifeStock.store.set('recipes', d.recipes);
      LifeStock.emit('sync:imported', obj);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { init, getStatus, attemptSync, exportData, importData };
})());

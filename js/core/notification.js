/**
 * [8] Notification Center — Alerts: expiry, low stock, events
 * Stable since v1.0
 * Works entirely offline. Does NOT depend on AI.
 */
LifeStock.register('NotificationCenter', (function () {
  const store = LifeStock.store;
  let notifications = store.get('notifications', []);

  function save() { store.set('notifications', notifications); }

  function create(type, title, message, severity) {
    const n = {
      id: 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      type: type || 'info',
      title: title || '',
      message: message || '',
      severity: severity || 'info',
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(n);
    if (notifications.length > 50) notifications = notifications.slice(0, 50);
    save();
    LifeStock.emit('notification:created', n);
    return n;
  }

  function markRead(id) {
    const n = notifications.find(x => x.id === id);
    if (n) { n.read = true; save(); }
  }

  function markAllRead() {
    notifications.forEach(n => n.read = true);
    save();
  }

  function remove(id) {
    notifications = notifications.filter(x => x.id !== id);
    save();
  }

  function clear() { notifications = []; save(); }
  function list() { return [...notifications]; }
  function getUnreadCount() { return notifications.filter(n => !n.read).length; }

  // Auto-check for issues — called on data changes
  function autoCheck() {
    const InventoryEngine = LifeStock.get('InventoryEngine');
    const BatchManager = LifeStock.get('BatchManager');
    const StorageManager = LifeStock.get('StorageManager');

    // Low stock alerts
    const lowItems = InventoryEngine.getLowStock();
    lowItems.forEach(item => {
      const exists = notifications.find(n =>
        n.type === 'low-stock' && n.message.includes(item.name) && !n.read
      );
      if (!exists) {
        create('low-stock', '📉 Низький залишок',
          `«${item.name}» — залишок ${item.stock} ${item.unit}, мінімум ${item.minStock}`,
          'warning');
      }
    });

    // Expiry alerts (≤3 days)
    const expiring = BatchManager.getExpiring(3);
    expiring.forEach(b => {
      const product = LifeStock.get('ProductCore').get(b.productId);
      const days = BatchManager.daysUntilExpiry(b.id);
      const exists = notifications.find(n =>
        n.type === 'expiry' && n.message.includes(b.batchNumber) && !n.read
      );
      if (!exists) {
        create('expiry', '⏳ Термін придатності',
          `Партія ${b.batchNumber} (${product ? product.name : '?'}) — ${days} дн. до закінчення`,
          days <= 1 ? 'critical' : 'warning');
      }
    });

    // Temperature alerts
    const tempAlerts = StorageManager.checkTempAlerts();
    tempAlerts.forEach(loc => {
      const exists = notifications.find(n =>
        n.type === 'temp' && n.message.includes(loc.name) && !n.read
      );
      if (!exists) {
        create('temp', '🌡️ Температура',
          `«${loc.name}»: ${loc.temp}°C (норма до ${loc.maxTemp}°C)`,
          'critical');
      }
    });
  }

  return { create, markRead, markAllRead, remove, clear, list, getUnreadCount, autoCheck };
})());

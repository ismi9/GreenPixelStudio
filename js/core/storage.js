/**
 * [4] Storage Manager — Locations: shelves, fridges, warehouses
 * Stable since v1.0
 */
LifeStock.register('StorageManager', (function () {
  const store = LifeStock.store;
  let locations = store.get('storage', [
    { id: 'loc-fridge', name: 'Холодильник', icon: '🧊', temp: 4, maxTemp: 5 },
    { id: 'loc-freezer', name: 'Морозильник', icon: '❄️', temp: -18, maxTemp: -15 },
    { id: 'loc-pantry', name: 'Шафа', icon: '🗄️', temp: 20, maxTemp: 25 },
    { id: 'loc-cellar', name: 'Підвал', icon: '🏚️', temp: 12, maxTemp: 15 },
  ]);

  function save() { store.set('storage', locations); }

  function add(data) {
    const loc = {
      id: 'loc-' + Date.now(),
      name: data.name || 'Без назви',
      icon: data.icon || '📦',
      temp: data.temp || null,
      maxTemp: data.maxTemp || null,
      createdAt: new Date().toISOString(),
    };
    locations.push(loc); save(); return loc;
  }

  function update(id, patch) {
    const l = locations.find(x => x.id === id);
    if (!l) return null;
    Object.assign(l, patch); save(); return l;
  }

  function remove(id) { locations = locations.filter(x => x.id !== id); save(); }
  function list() { return [...locations]; }
  function get(id) { return locations.find(x => x.id === id) || null; }

  function checkTempAlerts() {
    return locations.filter(l => l.temp !== null && l.maxTemp !== null && l.temp > l.maxTemp);
  }

  return { add, update, remove, list, get, checkTempAlerts };
})());

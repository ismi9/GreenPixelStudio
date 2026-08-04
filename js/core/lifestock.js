/**
 * LifeStock Core 1.0 — Main Module Registry
 * All 10 stable modules register here.
 * Core does NOT depend on AI — all critical functions work offline.
 */
const LifeStock = (function () {
  const modules = {};
  const version = '1.0.0';
  const listeners = {};

  function register(name, module) {
    modules[name] = module;
    if (module.init) module.init();
    console.log(`[LifeStock] Module registered: ${name}`);
    _emit('module:registered', { name });
  }

  function get(name) { return modules[name]; }
  function getAll() { return Object.keys(modules); }

  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }

  function _emit(event, data) {
    (listeners[event] || []).forEach(cb => cb(data));
  }

  function emit(event, data) { _emit(event, data); }

  // Storage abstraction — uses localStorage, swappable for remote sync later
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(`lifestock:${key}`); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, val) { localStorage.setItem(`lifestock:${key}`, JSON.stringify(val)); },
    remove(key) { localStorage.removeItem(`lifestock:${key}`); },
    clear() { Object.keys(localStorage).filter(k => k.startsWith('lifestock:')).forEach(k => localStorage.removeItem(k)); }
  };

  return { version, register, get, getAll, on, emit, store };
})();

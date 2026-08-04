/**
 * [9] Security — Users, access rights, roles, audit
 * Stable since v1.0
 * Client-side demo: role simulation + audit log
 */
LifeStock.register('Security', (function () {
  const store = LifeStock.store;
  let currentUser = store.get('currentUser', null);
  let users = store.get('users', [
    { id: 'u-admin', name: 'Адміністратор', role: 'admin', icon: '👤' },
    { id: 'u-user', name: 'Користувач', role: 'user', icon: '👤' },
    { id: 'u-viewer', name: 'Гість', role: 'viewer', icon: '👁️' },
  ]);
  let auditLog = store.get('auditLog', []);

  function save() { store.set('currentUser', currentUser); store.set('users', users); store.set('auditLog', auditLog); }

  function login(userId) {
    currentUser = users.find(u => u.id === userId) || null;
    save();
    if (currentUser) log('login', `Користувач ${currentUser.name} увійшов`);
    LifeStock.emit('security:login', currentUser);
    return currentUser;
  }

  function logout() {
    if (currentUser) log('logout', `Користувач ${currentUser.name} вийшов`);
    currentUser = null; save();
    LifeStock.emit('security:logout', null);
  }

  function getCurrentUser() { return currentUser; }
  function getUsers() { return [...users]; }
  function getRole() { return currentUser ? currentUser.role : 'guest'; }

  function can(action) {
    const role = getRole();
    const perms = {
      admin: ['add', 'edit', 'delete', 'view', 'manage', 'sync', 'export'],
      user: ['add', 'edit', 'view', 'sync'],
      viewer: ['view'],
      guest: ['view'],
    };
    return (perms[role] || ['view']).includes(action);
  }

  function log(action, detail) {
    auditLog.unshift({
      id: 'a-' + Date.now(),
      action, detail,
      user: currentUser ? currentUser.name : 'guest',
      timestamp: new Date().toISOString(),
    });
    if (auditLog.length > 100) auditLog = auditLog.slice(0, 100);
    save();
  }

  function getAuditLog() { return [...auditLog]; }

  return { init: () => { if (!currentUser) login('u-admin'); }, login, logout, getCurrentUser, getUsers, getRole, can, log, getAuditLog };
})());

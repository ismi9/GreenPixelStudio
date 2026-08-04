/**
 * LifeStock App Controller — renders working UI for all 10 core modules
 * This is the dashboard that ties everything together.
 */
const App = (function () {
  function init() {
    // Modules auto-init on register. Now build the UI.
    buildDashboard();
    bindEvents();
    refreshAll();
  }

  function mod(name) { return LifeStock.get(name); }

  function buildDashboard() {
    const container = document.getElementById('lifestock-app');
    if (!container) return;
    container.innerHTML = `
      <!-- Dashboard header -->
      <div class="ls-dashboard-header">
        <div class="ls-stats" id="lsStats"></div>
        <div class="ls-sync-bar" id="lsSyncBar"></div>
      </div>

      <!-- Tab navigation -->
      <div class="ls-tabs">
        <button class="ls-tab active" data-tab="inventory">📦 Запаси</button>
        <button class="ls-tab" data-tab="scan">📷 Сканер</button>
        <button class="ls-tab" data-tab="batches">📊 Партії</button>
        <button class="ls-tab" data-tab="recipes">🧾 Рецепти</button>
        <button class="ls-tab" data-tab="storage">🏬 Склади</button>
        <button class="ls-tab" data-tab="alerts">🔔 Сповіщення</button>
        <button class="ls-tab" data-tab="settings">⚙️ Налаштування</button>
      </div>

      <!-- Tab panels -->
      <div class="ls-panels">
        <div class="ls-panel active" id="panel-inventory"></div>
        <div class="ls-panel" id="panel-scan"></div>
        <div class="ls-panel" id="panel-batches"></div>
        <div class="ls-panel" id="panel-recipes"></div>
        <div class="ls-panel" id="panel-storage"></div>
        <div class="ls-panel" id="panel-alerts"></div>
        <div class="ls-panel" id="panel-settings"></div>
      </div>
    `;

    // Bind tab switching
    document.querySelectorAll('.ls-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ls-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ls-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
        renderTab(tab.dataset.tab);
      });
    });
  }

  function refreshAll() {
    renderStats();
    renderSyncBar();
    renderTab(document.querySelector('.ls-tab.active')?.dataset.tab || 'inventory');
    mod('NotificationCenter').autoCheck();
  }

  function renderStats() {
    const stats = mod('InventoryEngine').getStats();
    document.getElementById('lsStats').innerHTML = `
      <div class="ls-stat"><span class="ls-stat-icon">📦</span><span class="ls-stat-val">${stats.totalProducts}</span><span class="ls-stat-lbl">Товарів</span></div>
      <div class="ls-stat ls-stat-warn"><span class="ls-stat-icon">📉</span><span class="ls-stat-val">${stats.lowStock}</span><span class="ls-stat-lbl">Низький залишок</span></div>
      <div class="ls-stat ls-stat-crit"><span class="ls-stat-icon">⏳</span><span class="ls-stat-val">${stats.expiringBatches}</span><span class="ls-stat-lbl">Термін ≤3 дн.</span></div>
      <div class="ls-stat"><span class="ls-stat-icon">💰</span><span class="ls-stat-val">${stats.totalValue.toFixed(0)} ₴</span><span class="ls-stat-lbl">Вартість</span></div>
    `;
  }

  function renderSyncBar() {
    const sync = mod('SyncManager').getStatus();
    const sec = mod('Security');
    const user = sec.getCurrentUser();
    document.getElementById('lsSyncBar').innerHTML = `
      <div class="ls-sync-status ${sync.online ? 'online' : 'offline'}">
        ${sync.online ? '🟢 Онлайн' : '🔴 Офлайн'}
      </div>
      ${sync.pendingChanges > 0 ? `<div class="ls-pending">⏳ ${sync.pendingChanges} змін очікують</div>` : ''}
      <button class="ls-btn-sm" onclick="App.syncNow()">🔄 Синхр.</button>
      <div class="ls-user">👤 ${user ? user.name : 'Гість'} (${sec.getRole()})</div>
    `;
  }

  function renderTab(tab) {
    switch (tab) {
      case 'inventory': renderInventory(); break;
      case 'scan': renderScan(); break;
      case 'batches': renderBatches(); break;
      case 'recipes': renderRecipes(); break;
      case 'storage': renderStorage(); break;
      case 'alerts': renderAlerts(); break;
      case 'settings': renderSettings(); break;
    }
  }

  // ===== INVENTORY TAB =====
  function renderInventory() {
    const items = mod('InventoryEngine').getAllStock();
    const cats = mod('ProductCore').getCategories();
    const can = mod('Security').can('add');

    let html = `
      <div class="ls-toolbar">
        <input type="text" id="invSearch" placeholder="🔍 Пошук товару..." class="ls-input">
        <select id="invCatFilter" class="ls-select"><option value="">Всі категорії</option>
          ${cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
        ${can ? `<button class="ls-btn-primary" onclick="App.addProduct()">➕ Додати товар</button>` : ''}
      </div>
      <div class="ls-table-wrap">
        <table class="ls-table">
          <thead><tr><th></th><th>Товар</th><th>Категорія</th><th>Залишок</th><th>Мін.</th><th>Ціна</th><th>Статус</th><th></th></tr></thead>
          <tbody id="invBody">
    `;

    items.forEach(item => {
      const cat = cats.find(c => c.id === item.categoryId) || { icon: '📦', name: 'Інше' };
      const status = item.low ? '<span class="ls-badge ls-badge-warn">📉 Низький</span>' :
        item.stock === 0 ? '<span class="ls-badge ls-badge-crit">❌ Закінчився</span>' :
        '<span class="ls-badge ls-badge-ok">✔ OK</span>';
      html += `<tr>
        <td class="ls-product-icon">${item.icon}</td>
        <td><b>${item.name}</b></td>
        <td>${cat.icon} ${cat.name}</td>
        <td><b>${item.stock}</b> ${item.unit}</td>
        <td>${item.minStock} ${item.unit}</td>
        <td>${item.price.toFixed(2)} ₴</td>
        <td>${status}</td>
        <td><button class="ls-btn-icon" onclick="App.addBatch('${item.productId}')" title="Додати партію">📦</button></td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    document.getElementById('panel-inventory').innerHTML = html;

    document.getElementById('invSearch')?.addEventListener('input', () => filterInventory());
    document.getElementById('invCatFilter')?.addEventListener('change', () => filterInventory());
  }

  function filterInventory() {
    const search = document.getElementById('invSearch').value.toLowerCase();
    const cat = document.getElementById('invCatFilter').value;
    let items = mod('InventoryEngine').getAllStock();
    if (search) items = items.filter(i => i.name.toLowerCase().includes(search));
    if (cat) items = items.filter(i => {
      const p = mod('ProductCore').get(i.productId);
      return p && p.categoryId === cat;
    });
    const body = document.getElementById('invBody');
    if (!body) return;
    const cats = mod('ProductCore').getCategories();
    body.innerHTML = items.map(item => {
      const p = mod('ProductCore').get(item.productId);
      const catObj = cats.find(c => c.id === (p?.categoryId)) || { icon: '📦', name: 'Інше' };
      const status = item.low ? '<span class="ls-badge ls-badge-warn">📉 Низький</span>' :
        item.stock === 0 ? '<span class="ls-badge ls-badge-crit">❌ Закінчився</span>' :
        '<span class="ls-badge ls-badge-ok">✔ OK</span>';
      return `<tr>
        <td class="ls-product-icon">${item.icon}</td>
        <td><b>${item.name}</b></td>
        <td>${catObj.icon} ${catObj.name}</td>
        <td><b>${item.stock}</b> ${item.unit}</td>
        <td>${item.minStock} ${item.unit}</td>
        <td>${item.price.toFixed(2)} ₴</td>
        <td>${status}</td>
        <td><button class="ls-btn-icon" onclick="App.addBatch('${item.productId}')" title="Додати партію">📦</button></td>
      </tr>`;
    }).join('');
  }

  // ===== SCAN TAB =====
  let scanMode = 'barcode'; // 'barcode' or 'ocr'

  function renderScan() {
    const cam = mod('CameraAI');
    const hasOCR = cam.hasOCR();
    document.getElementById('panel-scan').innerHTML = `
      <div class="ls-scan-layout">
        <div class="ls-scan-area">
          <div class="ls-scan-mode-toggle">
            <button class="ls-mode-btn ${scanMode === 'barcode' ? 'active' : ''}" onclick="App.switchScanMode('barcode')">📷 Штрихкод</button>
            <button class="ls-mode-btn ${scanMode === 'ocr' ? 'active' : ''}" onclick="App.switchScanMode('ocr')" ${hasOCR ? '' : 'disabled'}>🔤 OCR-текст ${hasOCR ? '' : '(не доступний)'}</button>
          </div>
          <div class="ls-scan-viewport" id="lsScanViewport">
            <div class="ls-scan-placeholder" id="lsScanPlaceholder">
              <span>📷</span>
              <p>${scanMode === 'barcode' ? 'Натисни "Увімкнути камеру" та наведи на штрихкод' : 'Натисни "Увімкнути камеру", наведи на текст і тисни "Зчитати текст"'}</p>
              <p class="ls-scan-hint">${scanMode === 'barcode' ? 'EAN-13, EAN-8, UPC, Code-128, QR' : 'Терміни придатності, етикетки, дати'}</p>
            </div>
            <div class="ls-scan-result" id="lsScanResult" style="display:none"></div>
          </div>
          <div class="ls-scan-buttons">
            <button class="ls-btn-primary" id="lsCameraBtn" onclick="App.toggleCamera()">📷 Увімкнути камеру</button>
            <button class="ls-btn-primary ls-btn-ocr" id="lsOcrBtn" onclick="App.runOCR()" style="display:none">🔤 Зчитати текст</button>
            <button class="ls-btn-ghost" id="lsStopBtn" onclick="App.toggleCamera()" style="display:none">⏹ Зупинити</button>
          </div>
          <div class="ls-scan-status" id="lsScanStatus"></div>
          <div class="ls-ocr-progress" id="lsOcrProgress" style="display:none">
            <div class="ls-ocr-bar"><div class="ls-ocr-fill" id="lsOcrFill"></div></div>
            <span id="lsOcrProgressText">Підготовка...</span>
          </div>
        </div>
        <div class="ls-scan-controls">
          <div class="ls-scan-manual">
            <h4>📝 Ручний ввід</h4>
            <div class="ls-scan-row">
              <input type="text" id="lsBarcodeInput" placeholder="Введи штрихкод" class="ls-input" maxlength="13">
              <button class="ls-btn-primary" onclick="App.doScan()">Пошук</button>
            </div>
            <button class="ls-btn-ghost ls-btn-sm" onclick="App.randomScan()">🎲 Випадковий штрихкод</button>
            <p class="ls-scan-bt-hint">💡 Bluetooth-сканер працює автоматично — просто введи код у поле вище</p>
          </div>
          <div class="ls-ai-toggle">
            <label>
              <input type="checkbox" id="lsAiToggle" ${cam.isAIEnabled() ? 'checked' : ''} onchange="App.toggleAI(this.checked)">
              <span>🤖 AI-аналіз (опціонально)</span>
            </label>
            <p class="ls-ai-note">⚠️ Ядро працює без AI. Штрихкоди та OCR — без AI.</p>
          </div>
          <div id="lsScanHistory" class="ls-scan-history">
            <h4>Історія сканувань</h4>
            <div class="ls-empty">Порожньо</div>
          </div>
        </div>
      </div>
    `;
    renderScanHistory();
  }

  function switchScanMode(mode) {
    const cam = mod('CameraAI');
    if (cam.isCameraActive()) cam.stopLiveScan();
    scanMode = mode;
    const viewport = document.getElementById('lsScanViewport');
    if (viewport) viewport.querySelectorAll('video, .ls-scan-frame, .ls-scan-pulse').forEach(el => el.remove());
    const btn = document.getElementById('lsCameraBtn');
    const ocrBtn = document.getElementById('lsOcrBtn');
    const stopBtn = document.getElementById('lsStopBtn');
    const placeholder = document.getElementById('lsScanPlaceholder');
    const result = document.getElementById('lsScanResult');
    const status = document.getElementById('lsScanStatus');
    const progress = document.getElementById('lsOcrProgress');
    if (btn) btn.style.display = '';
    if (ocrBtn) ocrBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
    if (result) result.style.display = 'none';
    if (status) status.innerHTML = '';
    if (progress) progress.style.display = 'none';
    renderScan();
  }

  // Run OCR: capture frame and recognize text
  function runOCR() {
    const cam = mod('CameraAI');
    const status = document.getElementById('lsScanStatus');
    const progress = document.getElementById('lsOcrProgress');
    const progressText = document.getElementById('lsOcrProgressText');
    const fill = document.getElementById('lsOcrFill');
    const ocrBtn = document.getElementById('lsOcrBtn');

    if (!cam.isCameraActive()) { App.toast('⚠️ Спочатку увімкни камеру', 'warn'); return; }

    if (ocrBtn) ocrBtn.disabled = true;
    if (progress) progress.style.display = 'flex';
    if (progressText) progressText.textContent = 'Запуск OCR...';
    if (fill) fill.style.width = '10%';

    cam.captureAndOCR(
      (result) => {
        if (progress) progress.style.display = 'none';
        if (ocrBtn) ocrBtn.disabled = false;
        displayOCRResult(result);
      },
      (err) => {
        if (progress) progress.style.display = 'none';
        if (ocrBtn) ocrBtn.disabled = false;
        if (status) status.innerHTML = '<span class="ls-scan-error">❌ OCR помилка: ' + (err.message || '') + '</span>';
        App.toast('❌ OCR не вдалося', 'error');
      }
    );
  }

  function displayOCRResult(result) {
    const resultEl = document.getElementById('lsScanResult');
    const status = document.getElementById('lsScanStatus');
    const placeholder = document.getElementById('lsScanPlaceholder');

    if (placeholder) placeholder.style.display = 'none';
    if (resultEl) resultEl.style.display = 'block';

    const dates = result.dates || [];
    const expiry = result.expiryInfo || {};
    const text = result.text || '';
    const confidence = result.confidence ? Math.round(result.confidence) : 0;

    let html = '<div class="ls-ocr-result">';

    if (dates.length > 0) {
      html += '<div class="ls-ocr-dates">';
      html += '<h5>📅 Знайдені дати</h5>';
      dates.forEach(function (d) {
        html += '<div class="ls-ocr-date-item">' +
          '<span class="ls-ocr-date">' + d.formatted + '</span>' +
          '<button class="ls-btn-primary ls-btn-sm" onclick="App.useOCRDate(\''+ d.formatted + '\')">Використати</button>' +
        '</div>';
      });
      html += '</div>';
    }

    if (expiry.hasExpiryKeywords) {
      html += '<div class="ls-ocr-expiry-tags">' + expiry.keywords.map(function (k) { return '<span class="ls-ocr-tag">' + k + '</span>'; }).join('') + '</div>';
    }

    html += '<div class="ls-ocr-text-section">';
    html += '<h5>📝 Розпізнаний текст</h5>';
    html += '<pre class="ls-ocr-text">' + (text || 'Текст не знайдено') + '</pre>';
    html += '<div class="ls-ocr-conf">Точність: ' + confidence + '%</div>';
    html += '</div>';

    html += '</div>';

    if (resultEl) resultEl.innerHTML = html;
    if (status) status.innerHTML = '<span class="ls-scan-detected">✅ OCR: ' + text.length + ' символів, ' + dates.length + ' дат</span>';
    App.toast('✅ Текст зчитано: ' + dates.length + ' дат знайдено', 'ok');
  }

  function useOCRDate(dateStr) {
    // Try to use this date as expiry date for a new batch
    const input = prompt('Додати партію з терміном ' + dateStr + '?\nВведіть назву продукту:');
    if (!input) return;
    const ProductCore = mod('ProductCore');
    const products = ProductCore.getAll();
    let product = products.find(function (p) { return p.name.toLowerCase().includes(input.toLowerCase()); });
    if (!product) {
      product = ProductCore.add({ name: input, categoryId: 'cat-food', unit: 'шт', minStock: 1 });
    }
    const BatchManager = mod('BatchManager');
    BatchManager.add({ productId: product.id, quantity: 1, expiryDate: dateStr });
    App.toast('📦 Партію додано: ' + input + ' до ' + dateStr, 'ok');
    refreshAll();
  }

  let scanHistory = [];
  function renderScanHistory() {
    const el = document.getElementById('lsScanHistory');
    if (!el) return;
    if (scanHistory.length === 0) {
      el.innerHTML = '<h4>Історія сканувань</h4><div class="ls-empty">Порожньо</div>';
      return;
    }
    el.innerHTML = '<h4>Історія сканувань</h4>' + scanHistory.map(s =>
      `<div class="ls-history-item"><span>${s.icon}</span><span>${s.name}</span><span class="ls-history-code">${s.code}</span></div>`
    ).join('');
  }

  function doScan() {
    const code = document.getElementById('lsBarcodeInput').value.trim();
    if (!code || code.length < 3) { App.toast('⚠️ Введи штрихкод (мінімум 3 символи)', 'warn'); return; }
    performScan(code);
  }

  function randomScan() {
    const code = mod('BarcodeRegistry').randomCode();
    document.getElementById('lsBarcodeInput').value = code;
    performScan(code);
  }

  // Toggle live camera scanning
  function toggleCamera() {
    const cam = mod('CameraAI');
    const btn = document.getElementById('lsCameraBtn');
    const ocrBtn = document.getElementById('lsOcrBtn');
    const stopBtn = document.getElementById('lsStopBtn');
    const placeholder = document.getElementById('lsScanPlaceholder');
    const result = document.getElementById('lsScanResult');
    const status = document.getElementById('lsScanStatus');
    const viewport = document.getElementById('lsScanViewport');

    if (cam.isCameraActive()) {
      cam.stopLiveScan();
      if (viewport) viewport.querySelectorAll('video, .ls-scan-frame, .ls-scan-pulse').forEach(el => el.remove());
      if (btn) btn.style.display = '';
      if (ocrBtn) ocrBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'none';
      if (placeholder) placeholder.style.display = '';
      if (result) result.style.display = 'none';
      if (status) status.innerHTML = '';
      App.toast('📷 Камеру зупинено', 'info');
      return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (result) result.style.display = 'none';
    if (status) status.innerHTML = '<span class="ls-scan-loading">🔄 Запуск камери...</span>';

    if (viewport) {
      var frame = document.createElement('div');
      frame.className = 'ls-scan-frame';
      viewport.appendChild(frame);
      var pulse = document.createElement('div');
      pulse.className = 'ls-scan-pulse';
      viewport.appendChild(pulse);
    }

    if (scanMode === 'ocr') {
      // OCR mode — camera only, no continuous scanning
      cam.startLiveScan(
        viewport, null,
        (err) => {
          if (viewport) viewport.querySelectorAll('.ls-scan-frame, .ls-scan-pulse').forEach(el => el.remove());
          if (status) status.innerHTML = '<span class="ls-scan-error">❌ ' + (err.message || 'Камера недоступна') + '</span>';
          if (placeholder) placeholder.style.display = '';
          App.toast('❌ Камера недоступна', 'error');
        },
        true // useOCR = true
      ).then(() => {
        if (cam.isCameraActive()) {
          if (btn) btn.style.display = 'none';
          if (ocrBtn) ocrBtn.style.display = '';
          if (stopBtn) stopBtn.style.display = '';
          if (status) status.innerHTML = '<span class="ls-scan-live">🔴 Камера активна — наведи на текст і тисни "Зчитати"</span>';
        }
      });
      return;
    }

    // Barcode mode
    const engine = cam.hasNativeDetector() ? 'BarcodeDetector API' : 'QuaggaJS';
    console.log('[CameraAI] Scanning engine:', engine);

    cam.startLiveScan(
      viewport,
      (code) => {
        if (status) status.innerHTML = '<span class="ls-scan-detected">✅ Знайдено: ' + code + '</span>';
        performScan(code);
        setTimeout(() => {
          if (cam.isCameraActive()) {
            cam.stopLiveScan();
            if (viewport) viewport.querySelectorAll('video, .ls-scan-frame, .ls-scan-pulse').forEach(el => el.remove());
            if (btn) btn.style.display = '';
            if (stopBtn) stopBtn.style.display = 'none';
            if (placeholder) placeholder.style.display = '';
          }
        }, 2000);
      },
      (err) => {
        if (viewport) viewport.querySelectorAll('.ls-scan-frame, .ls-scan-pulse').forEach(el => el.remove());
        if (status) status.innerHTML = '<span class="ls-scan-error">❌ Камера недоступна. ' + (err.message || 'Дозволи не надано') + '</span>';
        if (placeholder) placeholder.style.display = '';
        App.toast('❌ Камера недоступна. Дозволи не надано?', 'error');
      }
    );

    if (btn) btn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = '';
    if (status) status.innerHTML = '<span class="ls-scan-live">🔴 Камера активна (' + engine + ') — наведи на штрихкод</span>';
  }

  function performScan(code) {
    const placeholder = document.getElementById('lsScanPlaceholder');
    const result = document.getElementById('lsScanResult');
    if (placeholder) placeholder.style.display = 'none';
    if (result) result.style.display = 'none';

    const res = mod('BarcodeRegistry').lookup(code);

    if (res.found) {
      const p = res.product;
      if (result) {
        result.style.display = 'block';
        result.innerHTML = `
          <div class="ls-scan-product">
            <div class="ls-scan-icon">${p.icon}</div>
            <div class="ls-scan-name">${p.name}</div>
            <div class="ls-scan-meta">${p.price} ₴ · ${p.unit} · ${res.source === 'registry' ? 'з реєстру' : 'з бази'}</div>
            <button class="ls-btn-primary ls-btn-sm" style="margin-top:8px" onclick="App.addBatch('${p.id}')">📦 Додати партію</button>
          </div>
        `;
      }
      scanHistory.unshift({ icon: p.icon, name: p.name, code });
      if (scanHistory.length > 8) scanHistory.pop();
      renderScanHistory();
      App.toast(`✅ Знайдено: ${p.name}`, 'ok');
    } else {
      if (result) {
        result.style.display = 'block';
        result.innerHTML = `
          <div class="ls-scan-product">
            <div class="ls-scan-icon">❓</div>
            <div class="ls-scan-name">Невідомий товар</div>
            <div class="ls-scan-meta">Код: ${code}</div>
            <button class="ls-btn-primary ls-btn-sm" style="margin-top:8px" onclick="App.addProductWithBarcode('${code}')">➕ Додати вручну</button>
          </div>
        `;
      }
      App.toast(`❓ Невідомий код: ${code}`, 'warn');
    }
    refreshAll();
  }

  function toggleAI(enabled) {
    mod('CameraAI').setAI(enabled);
    App.toast(enabled ? '🤖 AI активовано' : 'AI вимкнено — ядро продовжує працювати', 'info');
  }

  // ===== BATCHES TAB =====
  function renderBatches() {
    const batches = mod('BatchManager').list();
    const can = mod('Security').can('add');

    let html = `
      <div class="ls-toolbar">
        <h3>📊 Партії товарів</h3>
        ${can ? `<button class="ls-btn-primary" onclick="App.addBatch()">➕ Нова партія</button>` : ''}
      </div>
      <div class="ls-table-wrap">
        <table class="ls-table">
          <thead><tr><th>№ Партії</th><th>Товар</th><th>Кількість</th><th>Залишок</th><th>Склад</th><th>Термін</th><th>Дні</th><th>Статус</th></tr></thead>
          <tbody>
    `;

    batches.forEach(b => {
      const p = mod('ProductCore').get(b.productId);
      const loc = mod('StorageManager').get(b.storageId);
      const days = mod('BatchManager').daysUntilExpiry(b.id);
      let dayClass = '';
      if (days !== null) { if (days <= 1) dayClass = 'ls-cell-crit'; else if (days <= 3) dayClass = 'ls-cell-warn'; }
      html += `<tr>
        <td><code>${b.batchNumber}</code></td>
        <td>${p ? p.icon + ' ' + p.name : '?'}</td>
        <td>${b.quantity}</td>
        <td><b>${b.remaining}</b></td>
        <td>${loc ? loc.icon + ' ' + loc.name : '—'}</td>
        <td>${b.expiryDate || '—'}</td>
        <td class="${dayClass}">${days !== null ? days + ' дн.' : '—'}</td>
        <td>${b.status === 'active' ? '<span class="ls-badge ls-badge-ok">✔ Активна</span>' : '<span class="ls-badge">Закінчена</span>'}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    document.getElementById('panel-batches').innerHTML = html;
  }

  // ===== RECIPES TAB =====
  function renderRecipes() {
    const recipes = mod('RecipeEngine').list();
    const can = mod('Security').can('add');

    let html = `
      <div class="ls-toolbar">
        <h3>🧾 Рецепти</h3>
        ${can ? `<button class="ls-btn-primary" onclick="App.addRecipe()">➕ Новий рецепт</button>` : ''}
      </div>
      <div class="ls-recipe-grid">
    `;

    recipes.forEach(r => {
      const availability = mod('RecipeEngine').checkAvailability(r.id, r.portions);
      const allAvailable = availability.every(a => a.enough);
      html += `<div class="ls-recipe-card">
        <div class="ls-recipe-icon">${r.icon}</div>
        <h4>${r.name}</h4>
        <p class="ls-recipe-portions">🍽️ ${r.portions} порцій</p>
        <div class="ls-recipe-ingredients">
          ${availability.map(a => `<div class="ls-ingredient ${a.enough ? 'ok' : 'missing'}">
            <span>${a.name}</span><span>${a.available}/${a.needed} ${a.unit} ${a.enough ? '✔' : '❌'}</span>
          </div>`).join('')}
        </div>
        ${r.instructions ? `<p class="ls-recipe-instructions">${r.instructions}</p>` : ''}
        <div class="ls-recipe-status ${allAvailable ? 'ok' : 'missing'}">
          ${allAvailable ? '✅ Всі інгредієнти в наявності' : '⚠️ Не вистачає інгредієнтів'}
        </div>
      </div>`;
    });

    html += `</div>`;
    document.getElementById('panel-recipes').innerHTML = html;
  }

  // ===== STORAGE TAB =====
  function renderStorage() {
    const locations = mod('StorageManager').list();
    const can = mod('Security').can('add');

    let html = `
      <div class="ls-toolbar">
        <h3>🏬 Місця зберігання</h3>
        ${can ? `<button class="ls-btn-primary" onclick="App.addStorage()">➕ Додати</button>` : ''}
      </div>
      <div class="ls-storage-grid">
    `;

    locations.forEach(loc => {
      const items = mod('BatchManager').list({ storageId: loc.id, status: 'active' });
      const tempAlert = loc.temp !== null && loc.maxTemp !== null && loc.temp > loc.maxTemp;
      html += `<div class="ls-storage-card ${tempAlert ? 'alert' : ''}">
        <div class="ls-storage-icon">${loc.icon}</div>
        <h4>${loc.name}</h4>
        <div class="ls-storage-temp ${tempAlert ? 'alert' : ''}">🌡️ ${loc.temp !== null ? loc.temp + '°C' : '—'} (норма: ${loc.maxTemp !== null ? '≤' + loc.maxTemp + '°C' : '—'})</div>
        <div class="ls-storage-items">${items.length} партій активних</div>
      </div>`;
    });

    html += `</div>`;
    document.getElementById('panel-storage').innerHTML = html;
  }

  // ===== ALERTS TAB =====
  function renderAlerts() {
    const notifs = mod('NotificationCenter').list();
    const unread = notifs.filter(n => !n.read).length;

    let html = `
      <div class="ls-toolbar">
        <h3>🔔 Сповіщення ${unread > 0 ? `<span class="ls-badge ls-badge-crit">${unread}</span>` : ''}</h3>
        <button class="ls-btn-ghost ls-btn-sm" onclick="App.markAllRead()">✓ Прочитати всі</button>
        <button class="ls-btn-ghost ls-btn-sm" onclick="App.clearAlerts()">🗑️ Очистити</button>
      </div>
      <div class="ls-alerts-list">
    `;

    if (notifs.length === 0) {
      html += '<div class="ls-empty-big">🔕 Немає сповіщень</div>';
    } else {
      notifs.forEach(n => {
        const sevClass = n.severity === 'critical' ? 'ls-alert-crit' : n.severity === 'warning' ? 'ls-alert-warn' : '';
        html += `<div class="ls-alert ${sevClass} ${n.read ? 'read' : ''}" onclick="App.markRead('${n.id}')">
          <div class="ls-alert-time">${new Date(n.createdAt).toLocaleString('uk-UA')}</div>
          <div class="ls-alert-title">${n.title}</div>
          <div class="ls-alert-msg">${n.message}</div>
        </div>`;
      });
    }

    html += `</div>`;
    document.getElementById('panel-alerts').innerHTML = html;
  }

  // ===== SETTINGS TAB =====
  function renderSettings() {
    const sync = mod('SyncManager').getStatus();
    const sec = mod('Security');
    const users = sec.getUsers();
    const audit = sec.getAuditLog().slice(0, 10);

    document.getElementById('panel-settings').innerHTML = `
      <div class="ls-settings-grid">
        <div class="ls-settings-card">
          <h4>👤 Користувач</h4>
          <p>Поточна роль: <b>${sec.getRole()}</b></p>
          <div class="ls-user-switch">
            ${users.map(u => `<button class="ls-btn-ghost ls-btn-sm ${sec.getCurrentUser()?.id === u.id ? 'active' : ''}" onclick="App.switchUser('${u.id}')">${u.icon} ${u.name} (${u.role})</button>`).join('')}
          </div>
        </div>
        <div class="ls-settings-card">
          <h4>🔄 Синхронізація</h4>
          <p>Статус: <b>${sync.online ? 'Онлайн' : 'Офлайн'}</b></p>
          <p>Остання синхр.: ${sync.lastSync ? new Date(sync.lastSync).toLocaleString('uk-UA') : 'ніколи'}</p>
          <p>Очікують змін: ${sync.pendingChanges}</p>
          <button class="ls-btn-primary ls-btn-sm" onclick="App.syncNow()">🔄 Синхронізувати зараз</button>
          <hr>
          <h4>💾 Експорт / Імпорт</h4>
          <button class="ls-btn-ghost ls-btn-sm" onclick="App.exportData()">⬇ Експорт JSON</button>
          <button class="ls-btn-ghost ls-btn-sm" onclick="App.importData()">⬆ Імпорт JSON</button>
        </div>
        <div class="ls-settings-card">
          <h4>📋 Журнал аудиту</h4>
          <div class="ls-audit-log">
            ${audit.map(a => `<div class="ls-audit-entry"><span class="ls-audit-time">${new Date(a.timestamp).toLocaleTimeString('uk-UA')}</span><span class="ls-audit-action">${a.action}</span><span class="ls-audit-detail">${a.detail}</span></div>`).join('')}
          </div>
        </div>
        <div class="ls-settings-card ls-danger-zone">
          <h4>⚠️ Небезпечна зона</h4>
          <p>Скинути всі дані платформи</p>
          <button class="ls-btn-danger ls-btn-sm" onclick="App.resetData()">🗑️ Скинути всі дані</button>
        </div>
      </div>
    `;
  }

  // ===== ACTIONS =====
  function addProduct() {
    const name = prompt('Назва товару:');
    if (!name) return;
    const cats = mod('ProductCore').getCategories();
    const catStr = cats.map((c, i) => `${i + 1}. ${c.icon} ${c.name}`).join('\n');
    const catIdx = parseInt(prompt(`Категорія:\n${catStr}`, '1')) - 1;
    const category = cats[catIdx] || cats[0];
    const unit = prompt('Одиниця виміру (шт, кг, г, л, мл, уп):', 'шт') || 'шт';
    const barcode = prompt('Штрихкод (опціонально):', '') || '';
    const minStock = parseInt(prompt('Мінімальний залишок:', '1')) || 0;
    const price = parseFloat(prompt('Ціна (₴):', '0')) || 0;

    mod('ProductCore').add({ name, categoryId: category.id, unit, barcode, minStock, price, icon: '📦' });
    mod('Security').log('add-product', `Додано товар: ${name}`);
    App.toast(`✅ Товар "${name}" додано`, 'ok');
    refreshAll();
  }

  function addProductWithBarcode(code) {
    const name = prompt('Назва товару:');
    if (!name) return;
    const unit = prompt('Одиниця (шт, кг, г, л, мл):', 'шт') || 'шт';
    const price = parseFloat(prompt('Ціна (₴):', '0')) || 0;
    mod('ProductCore').add({ name, barcode: code, unit, price, icon: '📦' });
    App.toast(`✅ Товар "${name}" додано`, 'ok');
    refreshAll();
  }

  function addBatch(productId) {
    if (!productId) {
      const products = mod('ProductCore').list();
      const pStr = products.map((p, i) => `${i + 1}. ${p.icon} ${p.name}`).join('\n');
      const idx = parseInt(prompt(`Товар:\n${pStr}`, '1')) - 1;
      productId = products[idx]?.id;
      if (!productId) return;
    }
    const p = mod('ProductCore').get(productId);
    const quantity = parseFloat(prompt(`Кількість (${p.unit}):`, '1'));
    if (isNaN(quantity)) return;
    const expiry = prompt('Термін придатності (YYYY-MM-DD):', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    const locations = mod('StorageManager').list();
    const locStr = locations.map((l, i) => `${i + 1}. ${l.icon} ${l.name}`).join('\n');
    const locIdx = parseInt(prompt(`Склад:\n${locStr}`, '1')) - 1;
    const storageId = locations[locIdx]?.id;

    mod('BatchManager').add({ productId, quantity, storageId, expiryDate: expiry });
    mod('Security').log('add-batch', `Партія для: ${p.name}, к-ть: ${quantity}`);
    App.toast(`📦 Партію додано: ${p.name}`, 'ok');
    refreshAll();
  }

  function addRecipe() {
    const name = prompt('Назва рецепта:');
    if (!name) return;
    const portions = parseInt(prompt('Кількість порцій:', '2')) || 2;
    const instructions = prompt('Інструкція:', '') || '';

    // Pick ingredients
    const products = mod('ProductCore').list();
    const ingredients = [];
    let adding = true;
    while (adding) {
      const pStr = products.map((p, i) => `${i + 1}. ${p.icon} ${p.name}`).join('\n');
      const idx = prompt(`Інгредієнт (0 = завершити):\n${pStr}`, '0');
      if (!idx || idx === '0') { adding = false; break; }
      const p = products[parseInt(idx) - 1];
      if (!p) continue;
      const qty = parseFloat(prompt(`Кількість ${p.name} (${p.unit}):`, '1'));
      if (isNaN(qty)) continue;
      ingredients.push({ productId: p.id, name: p.name, quantity: qty, unit: p.unit });
    }

    mod('RecipeEngine').add({ name, portions, ingredients, instructions, icon: '🍽️' });
    App.toast(`🧾 Рецепт "${name}" додано`, 'ok');
    refreshAll();
  }

  function addStorage() {
    const name = prompt('Назва місця:');
    if (!name) return;
    const icon = prompt('Іконка (емодзі):', '📦') || '📦';
    const temp = parseFloat(prompt('Температура °C (порожньо = не відстежувати):', ''));
    const maxTemp = isNaN(temp) ? null : parseFloat(prompt('Макс. температура °C:', (temp + 3).toString()));
    mod('StorageManager').add({ name, icon, temp: isNaN(temp) ? null : temp, maxTemp });
    App.toast(`🏬 "${name}" додано`, 'ok');
    refreshAll();
  }

  function markRead(id) { mod('NotificationCenter').markRead(id); renderAlerts(); renderSyncBar(); }
  function markAllRead() { mod('NotificationCenter').markAllRead(); renderAlerts(); renderSyncBar(); }
  function clearAlerts() { mod('NotificationCenter').clear(); renderAlerts(); renderSyncBar(); }

  function syncNow() {
    const res = mod('SyncManager').attemptSync();
    if (res.success) { App.toast('🔄 Синхронізовано', 'ok'); mod('Security').log('sync', 'Ручна синхронізація'); }
    else { App.toast('🔴 Офлайн — дані збережено локально', 'warn'); }
    renderSyncBar();
  }

  function switchUser(id) { mod('Security').login(id); App.toast('👤 Роль змінено', 'info'); refreshAll(); }

  function exportData() {
    const data = mod('SyncManager').exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lifestock-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    mod('Security').log('export', 'Експорт даних');
    App.toast('⬇ Дані експортовано', 'ok');
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = mod('SyncManager').importData(ev.target.result);
        if (res.success) { App.toast('⬆ Дані імпортовано', 'ok'); refreshAll(); }
        else { App.toast('❌ Помилка: ' + res.error, 'error'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function resetData() {
    if (!confirm('Видалити ВСІ дані? Це незворотно.')) return;
    LifeStock.store.clear();
    location.reload();
  }

  // ===== TOAST =====
  let toastTimer = null;
  function toast(msg, type) {
    let el = document.getElementById('lsToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lsToast';
      el.className = 'ls-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'ls-toast ls-toast-' + (type || 'info') + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function bindEvents() {
    // Auto-refresh on data changes
    LifeStock.on('product:added', () => refreshAll());
    LifeStock.on('product:updated', () => refreshAll());
    LifeStock.on('product:removed', () => refreshAll());
    LifeStock.on('batch:added', () => refreshAll());
    LifeStock.on('batch:writeoff', () => refreshAll());
    LifeStock.on('sync:complete', () => renderSyncBar());
    LifeStock.on('notification:created', () => renderStats());
  }

  return { init, addProduct, addProductWithBarcode, addBatch, addRecipe, addStorage,
    doScan, randomScan, toggleCamera, switchScanMode, runOCR, useOCRDate, toggleAI, markRead, markAllRead, clearAlerts, syncNow,
    switchUser, exportData, importData, resetData, toast };
})();

// Bootstrap after all scripts loaded
document.addEventListener('DOMContentLoaded', () => App.init());

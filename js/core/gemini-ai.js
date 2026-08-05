/**
 * [11] AI Core — Multi-provider AI integration with ACTION EXECUTION
 * Stable since v3.9
 * NOTE: AI is OPTIONAL. Core platform works fully without this module.
 * User must explicitly opt in and provide their own API key.
 *
 * Supported providers:
 * 1. Groq (free, fast, Llama models) — https://console.groq.com/keys
 * 2. OpenRouter (free models, vision support) — https://openrouter.ai/keys
 * 3. Google Gemini (free tier) — https://aistudio.google.com/app/apikey
 *
 * All providers use OpenAI-compatible chat completions API format.
 * AI can EXECUTE ACTIONS on the inventory via structured JSON commands.
 */
LifeStock.register('GeminiAI', (function () {
  var PROVIDERS = {
    groq: {
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      keyUrl: 'https://console.groq.com/keys',
      defaultModel: 'llama-3.3-70b-versatile',
      models: [
        { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (fast, smart)' },
        { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fastest)' },
        { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
      ],
      vision: false,
    },
    openrouter: {
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      keyUrl: 'https://openrouter.ai/keys',
      defaultModel: 'google/gemma-4-26b-a4b-it:free',
      models: [
        { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B (free, vision)' },
        { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron Nano (free, vision)' },
        { id: 'nvidia/nemotron-3.5-content-safety:free', label: 'Nemotron Safety (free, vision)' },
        { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B (free)' },
        { id: 'inclusionai/ling-3.0-flash:free', label: 'Ling 3.0 Flash (free)' },
      ],
      vision: true,
    },
    gemini: {
      name: 'Google Gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      keyUrl: 'https://aistudio.google.com/app/apikey',
      defaultModel: 'gemini-2.0-flash',
      models: [
        { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (free)' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (free)' },
      ],
      vision: true,
    },
  };

  var KEY_STORAGE = 'lifestock_ai_key';
  var PROVIDER_STORAGE = 'lifestock_ai_provider';
  var MODEL_STORAGE = 'lifestock_ai_model';
  var CONSENT_STORAGE = 'lifestock_ai_consent';

  var enabled = false;
  var apiKey = '';
  var provider = 'groq';
  var model = '';
  var chatHistory = [];
  var lastActions = []; // Track executed actions for feedback

  function init() {
    try {
      apiKey = localStorage.getItem(KEY_STORAGE) || '';
      provider = localStorage.getItem(PROVIDER_STORAGE) || 'groq';
      model = localStorage.getItem(MODEL_STORAGE) || (PROVIDERS[provider] ? PROVIDERS[provider].defaultModel : '');
      var consent = localStorage.getItem(CONSENT_STORAGE) === 'true';
      enabled = !!(apiKey && consent && PROVIDERS[provider]);
    } catch (e) {}
    console.log('[AI Core] Init:', enabled ? 'enabled' : 'disabled', '| provider:', provider, '| model:', model);
  }

  function isEnabled() { return enabled; }
  function hasKey() { return !!apiKey; }
  function hasConsent() {
    try { return localStorage.getItem(CONSENT_STORAGE) === 'true'; } catch (e) { return false; }
  }
  function getProvider() { return provider; }
  function getProviderInfo() { return PROVIDERS[provider] || null; }
  function getModel() { return model; }
  function getProviders() {
    return Object.keys(PROVIDERS).map(function (k) {
      var p = PROVIDERS[k];
      return { id: k, name: p.name, keyUrl: p.keyUrl, models: p.models, vision: p.vision };
    });
  }
  function getLastActions() { return lastActions; }

  function setProvider(p) {
    if (!PROVIDERS[p]) return false;
    provider = p;
    model = PROVIDERS[p].defaultModel;
    try {
      localStorage.setItem(PROVIDER_STORAGE, p);
      localStorage.setItem(MODEL_STORAGE, model);
    } catch (e) {}
    enabled = !!(apiKey && hasConsent());
    return true;
  }

  function setModel(m) {
    model = m;
    try { localStorage.setItem(MODEL_STORAGE, m); } catch (e) {}
  }

  function setApiKey(key) {
    apiKey = (key || '').trim();
    try {
      if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
      else localStorage.removeItem(KEY_STORAGE);
    } catch (e) {}
    enabled = !!(apiKey && hasConsent());
    return enabled;
  }

  function setConsent(consent) {
    try { localStorage.setItem(CONSENT_STORAGE, consent ? 'true' : 'false'); } catch (e) {}
    enabled = !!(apiKey && consent);
    return enabled;
  }

  function getInventoryContext() {
    var inv = LifeStock.get('InventoryEngine');
    var products = LifeStock.get('ProductCore');
    var batchMgr = LifeStock.get('BatchManager');
    if (!inv || !products) return 'Інвентар порожній.';

    var allProducts = products.list();
    var stock = inv.getAllStock();
    var cats = products.getCategories();
    var allBatches = batchMgr ? batchMgr.list({ status: 'active' }) : [];

    var ctx = '=== ІНВЕНТАР І ЗАПАСИ ===\n';
    ctx += 'Всього товарів: ' + allProducts.length + '\n\n';

    allProducts.forEach(function (prod) {
      var s = stock.find(function (st) { return st.productId === prod.id; });
      var cat = cats.find(function (c) { return c.id === prod.categoryId; });
      ctx += '[ID:' + prod.id + '] ' + (prod.name || 'Невідомо');
      if (prod.manufacturer) ctx += ' (' + prod.manufacturer + ')';
      ctx += ': ' + (s ? s.stock : 0) + ' ' + (prod.unit || 'шт');
      if (prod.price) ctx += ', ціна: ' + prod.price + ' грн';
      if (cat) ctx += ', кат: ' + cat.name;
      if (s && s.low) ctx += ' ⚠️ НИЗЬКИЙ ЗАПАС';
      ctx += '\n';
    });

    if (allBatches.length > 0) {
      ctx += '\n=== АКТИВНІ ПАРТІЇ ===\n';
      allBatches.forEach(function (b) {
        var p = products.get(b.productId);
        var days = b.expiryDate ? batchMgr.daysUntilExpiry(b.id) : null;
        ctx += '[BID:' + b.id + '] ' + (p ? p.name : 'Невідомо') + ': залишок ' + (b.remaining || 0);
        if (b.expiryDate) ctx += ', термін: ' + b.expiryDate + (days !== null ? ' (' + days + ' дн)' : '');
        ctx += '\n';
      });

      var expiring = [], expired = [];
      allBatches.forEach(function (b) {
        if (!b.expiryDate) return;
        var days = batchMgr.daysUntilExpiry(b.id);
        if (days === null) return;
        var p = products.get(b.productId);
        var name = p ? p.name : 'Невідомо';
        if (days < 0) expired.push('- ' + name + ': прострочено ' + b.expiryDate + ' (залишок: ' + (b.remaining || 0) + ')');
        else if (days <= 3) expiring.push('- ' + name + ': термін ' + b.expiryDate + ' (залишок: ' + (b.remaining || 0) + ', ' + days + ' дн)');
      });
      if (expired.length) { ctx += '\n=== ПРОСТРОЧЕНО ===\n' + expired.join('\n') + '\n'; }
      if (expiring.length) { ctx += '\n=== СКОРО ПРОСТРОЧИТЬСЯ ===\n' + expiring.join('\n') + '\n'; }
    }

    var lowStock = stock.filter(function (s) { return s.low; });
    if (lowStock.length) {
      ctx += '\n=== НИЗЬКИЙ ЗАПАС ===\n';
      lowStock.forEach(function (s) {
        ctx += '- ' + (s.name || '?') + ': ' + (s.stock || 0) + ' ' + (s.unit || 'шт') + ' (мін: ' + (s.minStock || 0) + ')\n';
      });
    }

    if (allProducts.length === 0) ctx = 'Інвентар порожній. Товарів не додано.';
    return ctx;
  }  /**
   * System prompt with ACTION capabilities
   */
  function getActionSystemPrompt() {
    return 'Ти асистент для управління запасами LifeStock. Відповідай українською, коротко і чітко.\n\n' +
      'ТИ МОЖЕШ ВИКОНУВАТИ ДІЇ з інвентарем! Коли користувач просить щось змінити — додати, видалити, оновити — ' +
      'встав команду у форматі JSON у окремому блоці коду ```json ... ```.\n\n' +
      'ДОСТУПНІ КОМАНДИ (точні назви полів!):\n\n' +
      '1. Додати товар (categoryName — назва категорії, буде створена якщо немає):\n' +
      '```json\n{"action":"add_product","name":"Кава Lavazza","categoryName":"Напої","unit":"шт","price":120,"manufacturer":"Lavazza","minStock":2,"quantity":5,"expiryDate":"2026-12-31"}\n```\n' +
      '(quantity і expiryDate — опційно, одразу створює першу партію)\n\n' +
      '2. Видалити товар (потрібен реальний ID з контексту):\n' +
      '```json\n{"action":"delete_product","productId":"p-xxx"}\n```\n\n' +
      '3. Оновити ціну товару:\n' +
      '```json\n{"action":"update_price","productId":"p-xxx","price":150}\n```\n\n' +
      '4. Додати партію (quantity — кількість, не remaining):\n' +
      '```json\n{"action":"add_batch","productId":"p-xxx","batchNumber":"L-2026-001","expiryDate":"2026-12-31","quantity":10}\n```\n\n' +
      '5. Оновити залишок партії (потрібен реальний batchId з контексту):\n' +
      '```json\n{"action":"update_batch_remaining","batchId":"b-xxx","remaining":5}\n```\n\n' +
      '6. Встановити мінімальний запас товару:\n' +
      '```json\n{"action":"set_min_stock","productId":"p-xxx","minStock":3}\n```\n\n' +
      '7. Додати локацію зберігання:\n' +
      '```json\n{"action":"add_storage","name":"Морозильник 2","temperature":-18}\n```\n\n' +
      '8. Додати рецепт (ingredients: [{"name":"Яйце","quantity":3,"unit":"шт"}]):\n' +
      '```json\n{"action":"add_recipe","name":"Омлет","portions":2,"ingredients":[{"name":"Яйце","quantity":3,"unit":"шт"},{"name":"Молоко","quantity":100,"unit":"мл"}],"instructions":"Збий яйця, додай молоко, обсмаж."}\n```\n\n' +
      'ПРАВИЛА:\n' +
      '- У контексті інвентарю показані реальні productId (ID:xxx) і batchId (BID:xxx) — використовуй ТІЛЬКИ їх, ніколи не вигадуй нові\n' +
      '- Якщо не знаєш ID — спитай користувача або знайди товар за назвою у контексті\n' +
      '- Перед дією коротко підтвердь що збираєшся зробити, після — коротке пояснення українською\n' +
      '- Можна виконати кілька команд одразу — кожна в окремому блоці ```json\n' +
      '- Дати у форматі YYYY-MM-DD\n\n' +
      'Поточні дані інвентарю:\n' + getInventoryContext();
  }  /**
   * Parse AI response for action JSON blocks and execute them
   */
  /**
   * Extract top-level {...} JSON objects from a string via brace-matching.
   * Handles: single object, multiple objects concatenated with/without
   * separators, objects wrapped in a [ ] array — all in one pass.
   * This is needed because AI models sometimes put several JSON commands
   * inside ONE ```json``` fence without valid separators, which breaks a
   * naive JSON.parse() on the whole block.
   */
  function extractJsonObjects(str) {
    var results = [];
    var depth = 0, start = -1, inString = false, escape = false;
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (inString) {
        if (escape) { escape = false; }
        else if (ch === '\\') { escape = true; }
        else if (ch === '"') { inString = false; }
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          results.push(str.slice(start, i + 1));
          start = -1;
        }
      }
    }
    return results;
  }

  function executeActions(aiText) {
    lastActions = [];
    var actionBlocks = aiText.match(/```json\s*([\s\S]*?)```/g) || [];

    // Fallback: some models omit the ```json fence entirely — scan raw text
    // for objects containing an "action" key if no fenced blocks were found.
    var rawObjectStrs = [];
    if (actionBlocks.length === 0) {
      rawObjectStrs = extractJsonObjects(aiText).filter(function (s) { return s.indexOf('"action"') !== -1; });
      if (rawObjectStrs.length === 0) return { executed: 0, results: [] };
    }

    var results = [];

    function runObjectStr(objStr) {
      try {
        var cmd = JSON.parse(objStr);
        var result = executeAction(cmd);
        results.push(result);
        lastActions.push(result);
      } catch (e) {
        results.push({ action: 'parse_error', success: false, message: 'Помилка парсингу: ' + e.message });
      }
    }

    actionBlocks.forEach(function (block) {
      var jsonStr = block.replace(/```json\s*/, '').replace(/```/, '').trim();
      var objs = extractJsonObjects(jsonStr);
      if (objs.length === 0) {
        results.push({ action: 'parse_error', success: false, message: 'Не знайдено команд у блоці JSON' });
        return;
      }
      objs.forEach(runObjectStr);
    });

    rawObjectStrs.forEach(runObjectStr);

    return { executed: results.length, results: results };
  }

  /**
   * Execute a single action command
   */
  function executeAction(cmd) {
    if (!cmd || !cmd.action) {
      return { action: 'unknown', success: false, message: 'Невідома команда' };
    }

    var products = LifeStock.get('ProductCore');
    var batchMgr = LifeStock.get('BatchManager');
    var storage = LifeStock.get('StorageManager');
    var recipeEngine = LifeStock.get('RecipeEngine');

    function resolveCategoryId(categoryName) {
      if (!categoryName) return 'cat-other';
      var cats = products.getCategories();
      var match = cats.find(function (c) { return c.name.toLowerCase() === String(categoryName).toLowerCase(); });
      if (match) return match.id;
      var created = products.addCategory(categoryName);
      return created.id;
    }

    switch (cmd.action) {
      case 'add_product': {
        if (!products) return { action: cmd.action, success: false, message: 'Модуль ProductCore не завантажено' };
        if (!cmd.name) return { action: cmd.action, success: false, message: 'Не вказано назву товару' };
        var categoryId = resolveCategoryId(cmd.categoryName || cmd.category);
        var newProd = products.add({
          name: cmd.name,
          categoryId: categoryId,
          unit: cmd.unit || 'шт',
          price: cmd.price || 0,
          minStock: cmd.minStock || 0,
          manufacturer: cmd.manufacturer || '',
        });
        var msg = 'Товар "' + cmd.name + '" додано (ID: ' + newProd.id + ')';
        var qty = cmd.quantity || cmd.remaining || 0;
        if (qty > 0 && batchMgr) {
          batchMgr.add({
            productId: newProd.id,
            quantity: qty,
            expiryDate: cmd.expiryDate || null,
            batchNumber: 'AI-' + Date.now(),
          });
          msg += ', партія: ' + qty + ' ' + (cmd.unit || 'шт');
          if (cmd.expiryDate) msg += ', термін: ' + cmd.expiryDate;
        }
        return { action: cmd.action, success: true, message: msg, productId: newProd.id };
      }

      case 'delete_product': {
        if (!products) return { action: cmd.action, success: false, message: 'Модуль не завантажено' };
        if (!cmd.productId) return { action: cmd.action, success: false, message: 'Не вказано ID товару' };
        var prodToDelete = products.get(cmd.productId);
        if (!prodToDelete) return { action: cmd.action, success: false, message: 'Товар ID:' + cmd.productId + ' не знайдено' };
        products.remove(cmd.productId);
        return { action: cmd.action, success: true, message: 'Товар "' + (prodToDelete.name || cmd.productId) + '" видалено' };
      }

      case 'update_price': {
        if (!products) return { action: cmd.action, success: false, message: 'Модуль не завантажено' };
        if (!cmd.productId) return { action: cmd.action, success: false, message: 'Не вказано ID товару' };
        var pProd = products.get(cmd.productId);
        if (!pProd) return { action: cmd.action, success: false, message: 'Товар ID:' + cmd.productId + ' не знайдено' };
        products.update(cmd.productId, { price: cmd.price });
        return { action: cmd.action, success: true, message: 'Ціну "' + (pProd.name || '') + '" змінено на ' + cmd.price + ' грн' };
      }

      case 'add_batch': {
        if (!batchMgr) return { action: cmd.action, success: false, message: 'Модуль BatchManager не завантажено' };
        if (!cmd.productId) return { action: cmd.action, success: false, message: 'Не вказано ID товару' };
        var bProd = products ? products.get(cmd.productId) : null;
        if (!bProd) return { action: cmd.action, success: false, message: 'Товар ID:' + cmd.productId + ' не знайдено' };
        var qtyToAdd = cmd.quantity || cmd.remaining || 0;
        var newBatch = batchMgr.add({
          productId: cmd.productId,
          quantity: qtyToAdd,
          batchNumber: cmd.batchNumber || 'AI-' + Date.now(),
          expiryDate: cmd.expiryDate || null,
        });
        return { action: cmd.action, success: true, message: 'Партію додано до "' + bProd.name + '" (' + qtyToAdd + ' ' + (bProd.unit || 'шт') + ', термін: ' + (cmd.expiryDate || '—') + ')', batchId: newBatch.id };
      }

      case 'update_batch_remaining': {
        if (!batchMgr) return { action: cmd.action, success: false, message: 'Модуль не завантажено' };
        if (!cmd.batchId) return { action: cmd.action, success: false, message: 'Не вказано ID партії' };
        var existingBatch = batchMgr.get(cmd.batchId);
        if (!existingBatch) return { action: cmd.action, success: false, message: 'Партію ID:' + cmd.batchId + ' не знайдено' };
        batchMgr.setRemaining(cmd.batchId, cmd.remaining);
        var bp = products ? products.get(existingBatch.productId) : null;
        return { action: cmd.action, success: true, message: 'Залишок "' + (bp ? bp.name : cmd.batchId) + '" змінено на ' + cmd.remaining };
      }

      case 'set_min_stock': {
        if (!products) return { action: cmd.action, success: false, message: 'Модуль не завантажено' };
        if (!cmd.productId) return { action: cmd.action, success: false, message: 'Не вказано ID товару' };
        var msProd = products.get(cmd.productId);
        if (!msProd) return { action: cmd.action, success: false, message: 'Товар ID:' + cmd.productId + ' не знайдено' };
        products.update(cmd.productId, { minStock: cmd.minStock });
        return { action: cmd.action, success: true, message: 'Мін. запас "' + msProd.name + '" встановлено: ' + cmd.minStock };
      }

      case 'add_storage': {
        if (!storage) return { action: cmd.action, success: false, message: 'Модуль Storage не завантажено' };
        var newLoc = storage.add({
          name: cmd.name || 'Нова локація',
          temp: cmd.temperature !== undefined ? cmd.temperature : (cmd.temp !== undefined ? cmd.temp : null),
        });
        return { action: cmd.action, success: true, message: 'Локацію "' + (cmd.name || '') + '" додано (ID: ' + newLoc.id + ')' };
      }

      case 'add_recipe': {
        if (!recipeEngine) return { action: cmd.action, success: false, message: 'Модуль Recipe не завантажено' };
        var ingredients = (cmd.ingredients || []).map(function (i) {
          return { name: i.name || '', quantity: i.quantity || i.qty || 0, unit: i.unit || '' };
        });
        var instructions = cmd.instructions || (Array.isArray(cmd.steps) ? cmd.steps.join('. ') : '');
        var newRec = recipeEngine.add({
          name: cmd.name || 'Новий рецепт',
          portions: cmd.portions || 2,
          ingredients: ingredients,
          instructions: instructions,
        });
        return { action: cmd.action, success: true, message: 'Рецепт "' + (cmd.name || '') + '" додано (ID: ' + newRec.id + ')' };
      }

      default:
        return { action: cmd.action || 'unknown', success: false, message: 'Невідома дія: ' + (cmd.action || '?') };
    }
  }


  /**
   * Core API call — OpenAI-compatible chat completions
   */
  async function callAI(prompt, systemPrompt, imageBase64) {
    if (!enabled || !apiKey) return { error: 'AI не активовано. Надайте API ключ та згоду.' };
    var p = PROVIDERS[provider];
    if (!p) return { error: 'Невідомий провайдер: ' + provider };

    var messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    chatHistory.slice(-6).forEach(function (msg) {
      messages.push(msg);
    });

    if (imageBase64 && p.vision) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imageBase64 } },
        ],
      });
    } else if (imageBase64 && !p.vision) {
      messages.push({ role: 'user', content: prompt + '\n\n[Примітка: провайдер не підтримує аналіз зображень.]' });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    var body = {
      model: model || p.defaultModel,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
    };

    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://ismi9.github.io/lifestock-ai/';
      headers['X-Title'] = 'LifeStock AI';
    }

    try {
      var response = await fetch(p.url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        var errData = await response.json().catch(function () { return {}; });
        var errMsg = '';
        if (errData.error) {
          errMsg = errData.error.message || errData.error;
        } else {
          errMsg = 'HTTP ' + response.status;
        }
        if (response.status === 401) errMsg = 'Невірний API ключ для ' + p.name + '. Перевірте ключ у налаштуваннях.';
        if (response.status === 429) errMsg = 'Перевищено ліміт запитів на ' + p.name + '. Спробуйте пізніше.';
        if (response.status === 404) errMsg = 'Модель "' + (model || p.defaultModel) + '" не знайдена. Оберіть іншу модель.';
        return { error: errMsg };
      }

      var data = await response.json();
      var text = '';
      if (data.choices && data.choices[0] && data.choices[0].message) {
        text = data.choices[0].message.content || '';
      }

      // Save to history
      chatHistory.push({ role: 'user', content: prompt });
      chatHistory.push({ role: 'assistant', content: text });
      if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

      // ===== EXECUTE ACTIONS from AI response =====
      var actionResult = executeActions(text);

      return { text: text, success: true, actions: actionResult };
    } catch (err) {
      console.error('[AI Core] API error:', err);
      return { error: 'Помилка з\'єднання: ' + (err.message || err) };
    }
  }

  // ===== AI FEATURES =====

  async function askQuestion(question) {
    var systemMsg = getActionSystemPrompt();
    return await callAI(question, systemMsg);
  }

  async function suggestRecipes() {
    var ctx = getInventoryContext();
    var prompt = 'У мене є такі продукти:\n' + ctx + '\n\nЗапропонуй 3 рецепти, які я можу приготувати. Для кожного: назва, інгредієнти, короткий опис. Відповідай українською.';
    return await callAI(prompt, getActionSystemPrompt());
  }

  async function analyzePhoto(imageBase64) {
    var prompt = 'Проаналізуй фото полиці/продуктів. Опиши: які товари бачиш, приблизну кількість, стан упаковок. Якщо бачите етикетки — прочитай назви та дати. Відповідай українською.';
    return await callAI(prompt, 'Ти асистент для управління запасами. Аналізуй фото товарів.', imageBase64);
  }

  async function analyzeInventory() {
    var ctx = getInventoryContext();
    var prompt = 'Проаналізуй стан інвентарю:\n' + ctx + '\n\nДай рекомендації:\n1. Товари в надлишку\n2. Товари яких не вистачає\n3. Що скоро зіпсується\n4. Оптимальні пропозиції. Відповідай українською.';
    return await callAI(prompt, getActionSystemPrompt());
  }

  async function forecastPurchases() {
    var ctx = getInventoryContext();
    var prompt = 'На основі інвентарю:\n' + ctx + '\n\nСпрогнозуй:\n1. Що потрібно купити найближчим часом\n2. Орієнтовна кількість\n3. Пріоритет. Відповідай українською.';
    return await callAI(prompt, getActionSystemPrompt());
  }

  async function generateShoppingList() {
    var ctx = getInventoryContext();
    var prompt = 'Створи список покупок на основі інвентарю:\n' + ctx + '\n\nЗроби список:\n- Товари з критично низьким запасом\n- Товари що закінчуються\n- Орієнтовна вартість. Відповідай українською.';
    return await callAI(prompt, getActionSystemPrompt());
  }

  function clearHistory() { chatHistory = []; }
  function getHistory() { return chatHistory; }

  init();

  return {
    isEnabled, hasKey, hasConsent,
    setApiKey, setConsent, setProvider, setModel,
    getProvider, getProviderInfo, getModel, getProviders,
    getLastActions,
    callAI, executeActions,
    askQuestion, suggestRecipes, analyzePhoto,
    analyzeInventory, forecastPurchases, generateShoppingList,
    clearHistory, getHistory,
  };
})());

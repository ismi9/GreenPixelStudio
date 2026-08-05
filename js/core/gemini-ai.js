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
    var allBatches = batchMgr ? batchMgr.list({ status: 'active' }) : [];

    var ctx = '=== ІНВЕНТАР І ЗАПАСИ ===\n';
    ctx += 'Всього товарів: ' + allProducts.length + '\n\n';

    allProducts.forEach(function (prod) {
      var s = stock.find(function (st) { return st.productId === prod.id; });
      ctx += '[ID:' + prod.id + '] ' + (prod.name || 'Невідомо');
      if (prod.manufacturer) ctx += ' (' + prod.manufacturer + ')';
      ctx += ': ' + (s ? s.stock : 0) + ' ' + (prod.unit || 'шт');
      if (prod.price) ctx += ', ціна: ' + prod.price + ' грн';
      if (prod.category) ctx += ', кат: ' + prod.category;
      if (s && s.low) ctx += ' ⚠️ НИЗЬКИЙ ЗАПАС';
      ctx += '\n';
    });

    if (allBatches.length > 0) {
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
  }

  /**
   * System prompt with ACTION capabilities
   */
  function getActionSystemPrompt() {
    return 'Ти асистент для управління запасами LifeStock. Відповідай українською, коротко і чітко.\n\n' +
      'ТИ МОЖЕШ ВИКОНУВАТИ ДІЇ з інвентарем! Коли користувач просить щось змінити — додати, видалити, оновити — ' +
      'встав команду у форматі JSON у окремому блоці коду ```json ... ```.\n\n' +
      'ДОСТУПНІ КОМАНДИ:\n\n' +
      '1. Додати товар:\n' +
      '```json\n{"action":"add_product","name":"Кава Lavazza","category":"Напої","unit":"шт","price":120,"manufacturer":"Lavazza"}\n```\n\n' +
      '2. Видалити товар (потрібен ID):\n' +
      '```json\n{"action":"delete_product","productId":"123"}\n```\n\n' +
      '3. Оновити ціну товару:\n' +
      '```json\n{"action":"update_price","productId":"123","price":150}\n```\n\n' +
      '4. Додати партію (termін придатності):\n' +
      '```json\n{"action":"add_batch","productId":"123","batchNumber":"L-2026-001","expiryDate":"2026-12-31","remaining":10}\n```\n\n' +
      '5. Оновити залишок партії:\n' +
      '```json\n{"action":"update_batch_remaining","batchId":"456","remaining":5}\n```\n\n' +
      '6. Встановити мінімальний запас:\n' +
      '```json\n{"action":"set_min_stock","productId":"123","minStock":3}\n```\n\n' +
      '7. Додати локацію зберігання:\n' +
      '```json\n{"action":"add_storage","name":"Морозильник","type":"freezer","temperature":"-18"}\n```\n\n' +
      '8. Додати рецепт:\n' +
      '```json\n{"action":"add_recipe","name":"Омлет","ingredients":[{"name":"Яйце","qty":3},{"name":"Молоко","qty":100}],"steps":["Збий яйця","Додай молоко","Обсмаж"]}\n```\n\n' +
      'ПРАВИЛА:\n' +
      '- Завжди показуй ID товарів у контексті (ID:xxx), щоб користувач міг посилатися на них\n' +
      '- Перед дією коротко підтвердь що збираєшся зробити\n' +
      '- Після команди JSON додай коротке пояснення українською\n' +
      '- Можна виконати кілька команд одразу — кожна в окремому блоці ```json\n' +
      '- Якщо не знаєш ID — спитай користувача або знайди товар за назвою у контексті\n' +
      '- НЕ вигадуй ID — використовуй тільки реальні з контексту інвентарю\n' +
      '- Дати у форматі YYYY-MM-DD\n\n' +
      'Поточні дані інвентарю:\n' + getInventoryContext();
  }

  /**
   * Parse AI response for action JSON blocks and execute them
   */
  function executeActions(aiText) {
    lastActions = [];
    var actionBlocks = aiText.match(/```json\s*([\s\S]*?)```/g) || [];
    if (actionBlocks.length === 0) return { executed: 0, results: [] };

    var results = [];
    actionBlocks.forEach(function (block) {
      var jsonStr = block.replace(/```json\s*/, '').replace(/```/, '').trim();
      try {
        var cmd = JSON.parse(jsonStr);
        var result = executeAction(cmd);
        results.push(result);
        lastActions.push(result);
      } catch (e) {
        results.push({ action: 'parse_error', success: false, message: 'Помилка парсингу: ' + e.message });
      }
    });

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
    var inv = LifeStock.get('InventoryEngine');
    var storage = LifeStock.get('StorageManager');
    var recipe = LifeStock.get('RecipeEngine');

    switch (cmd.action) {
      case 'add_product':
        if (!products) return { action: cmd.action, success: false, message: 'Модуль ProductCore не завантажено' };
        if (!cmd.name) return { action: cmd.action, success: false, message: 'Не вказано назву товару' };
        var newProd = products.create({
          name: cmd.name,
          category: cmd.category || 'Інше',
          unit: cmd.unit || 'шт',
          price: cmd.price || 0,
          manufacturer: cmd.manufacturer || '',
        });
        // If quantity specified, add a batch
        if (cmd.quantity && cmd.quantity > 0 && batchMgr) {
          batchMgr.createBatch(newProd.id, {
            batchNumber: 'AI-' + Date.now(),
            expiryDate: cmd.expiryDate || null,
            remaining: cmd.quantity,
          });
        }
        return { action: cmd.action, success: true, message: 'Товар "' + cmd.name + '" додано (ID: ' + newProd.id + ')', productId: newProd.id };

      case 'delete_product':
        if (!products) return { action: cmd.action, success: false, message: 'Модуль не завантажено' };
        if (!cmd.productId) return { action: cmd.action, success: false, message: 'Не вказано ID товару' };
        var prod = products.get(cmd.productId);
        if (!prod) return { action: cmd.action, success: false, message: 'Товар ID:' + cmd.productId + ' не знайдено' };
        products.delete(cmd.productId);
        return { action: cmd.action, success: true, message: 'Товар "' + (prod.name || cmd.productId) + '" видалено' };

      case 'update_price':
        if (!products) return { action: cmd.action, success: false, message: 'Модуль не завантажено' };
        if (!cmd.productId) return { action: cmd.action, success: false, message: 'Не вказано ID товару' };
        var pProd = products.get(cmd.productId);
        if (!pProd) return { action: cmd.action, success: false, message: 'Товар не знайдено' };
        products.update(cmd.productId, { price: cmd.price });
        return { action: cmd.action, success: true, message: 'Ціну "' + (pProd.name || '') + '" змінено на ' + cmd.price + ' грн' };

      case 'add_batch':
        if (!batchMgr) return { action: cmd.action, success: false, message: 'Модуль BatchManager не завантажено' };
        if (!cmd.productId) return { action: cmd.action, success: false, message: 'Не вказано ID товару' };
        var bProd = products ? products.get(cmd.productId) : null;
        if (!bProd) return { action: cmd.action, success: false, message: 'Товар ID:' + cmd.productId + ' не знайдено' };
        var newBatch = batchMgr.createBatch(cmd.productId, {
          batchNumber: cmd.batchNumber || 'AI-' + Date.now(),
          expiryDate: cmd.expiryDate || null,
          remaining: cmd.remaining || 0,
        });
        return { action: cmd.action, success: true, message: 'Партію додано до "' + bProd.name + '" (залишок: ' + (cmd.remaining || 0) + ', термін: ' + (cmd.expiryDate || '—') + ')' };

      case 'update_batch_remaining':
        if (!batchMgr) return { action: cmd.action, success: false, message: 'Модуль не завантажено' };
        if (!cmd.batchId) return { action: cmd.action, success: false, message: 'Не вказано ID партії' };
        batchMgr.updateRemaining(cmd.batchId, cmd.remaining);
        return { action: cmd.action, success: true, message: 'Залишок партії ' + cmd.batchId + ' змінено на ' + cmd.remaining };

      case 'set_min_stock':
        if (!inv) return { action: cmd.action, success: false, message: 'Модуль Inventory не завантажено' };
        if (!cmd.productId) return { action: cmd.action, success: false, message: 'Не вказано ID товару' };
        inv.setMinStock(cmd.productId, cmd.minStock);
        return { action: cmd.action, success: true, message: 'Мін. запас встановлено: ' + cmd.minStock };

      case 'add_storage':
        if (!storage) return { action: cmd.action, success: false, message: 'Модуль Storage не завантажено' };
        var newLoc = storage.createLocation({
          name: cmd.name || 'Нова локація',
          type: cmd.type || 'room',
          temperature: cmd.temperature || '',
        });
        return { action: cmd.action, success: true, message: 'Локацію "' + (cmd.name || '') + '" додано' };

      case 'add_recipe':
        if (!recipe) return { action: cmd.action, success: false, message: 'Модуль Recipe не завантажено' };
        var newRec = recipe.create({
          name: cmd.name || 'Новий рецепт',
          ingredients: cmd.ingredients || [],
          steps: cmd.steps || [],
        });
        return { action: cmd.action, success: true, message: 'Рецепт "' + (cmd.name || '') + '" додано' };

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

/**
 * [11] Gemini AI — AI platform integration via Google Gemini Flash
 * Stable since v3.7
 * NOTE: AI is OPTIONAL. Core platform works fully without this module.
 * User must explicitly opt in and provide their own Gemini API key.
 *
 * Features:
 * 1. Natural language queries to inventory database ("Скільки кави залишилось?")
 * 2. Recipe suggestions based on available stock
 * 3. Photo analysis (identify products on shelf, count items)
 * 4. Inventory analysis (surplus, deficit, optimization suggestions)
 * 5. Purchase forecasting (based on consumption history)
 * 6. Smart shopping list generation
 *
 * API: Google Gemini 2.0 Flash (free tier available)
 * Docs: https://ai.google.dev/gemini-api/docs
 */
LifeStock.register('GeminiAI', (function () {
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const MODEL = 'gemini-2.0-flash';
  const VISION_MODEL = 'gemini-2.0-flash';
  const KEY_STORAGE = 'lifestock_gemini_key';
  const CONSENT_STORAGE = 'lifestock_ai_consent';

  let enabled = false;
  let apiKey = '';
  let chatHistory = [];

  /**
   * Initialize: load API key from localStorage
   */
  function init() {
    try {
      apiKey = localStorage.getItem(KEY_STORAGE) || '';
      const consent = localStorage.getItem(CONSENT_STORAGE);
      enabled = !!(apiKey && consent === 'true');
    } catch (e) {}
    console.log('[GeminiAI] Init:', enabled ? 'enabled' : 'disabled', 'key:', apiKey ? '***' + apiKey.slice(-4) : 'none');
  }

  function isEnabled() { return enabled; }
  function hasKey() { return !!apiKey; }

  /**
   * Set API key (from user input)
   */
  function setApiKey(key) {
    apiKey = (key || '').trim();
    try {
      if (apiKey) {
        localStorage.setItem(KEY_STORAGE, apiKey);
      } else {
        localStorage.removeItem(KEY_STORAGE);
      }
    } catch (e) {}
    enabled = !!(apiKey && hasConsent());
    return enabled;
  }

  /**
   * User consent — must be explicit
   */
  function setConsent(consent) {
    try {
      localStorage.setItem(CONSENT_STORAGE, consent ? 'true' : 'false');
    } catch (e) {}
    enabled = !!(apiKey && consent);
    return enabled;
  }

  function hasConsent() {
    try { return localStorage.getItem(CONSENT_STORAGE) === 'true'; } catch (e) { return false; }
  }

  /**
   * Get inventory context for AI prompt
   */
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

    stock.forEach(function (item) {
      // getAllStock already has name, icon, unit, stock, price
      ctx += '- ' + (item.name || 'Невідомо');
      if (item.manufacturer) ctx += ' (' + item.manufacturer + ')';
      ctx += ': ' + (item.stock || 0) + ' ' + (item.unit || 'шт');
      if (item.price) ctx += ', ціна: ' + item.price + ' ₴';
      ctx += '\n';
    });

    // Expiry info from batches
    if (allBatches.length > 0) {
      var expiring = [];
      var expired = [];
      allBatches.forEach(function (b) {
        if (!b.expiryDate) return;
        var days = batchMgr.daysUntilExpiry(b.id);
        if (days === null) return;
        var p = products.get(b.productId);
        var name = p ? p.name : 'Невідомо';
        if (days < 0) {
          expired.push('- ' + name + ': прострочено ' + b.expiryDate + ' (залишок: ' + (b.remaining || 0) + ')');
        } else if (days <= 3) {
          expiring.push('- ' + name + ': термін ' + b.expiryDate + ' (залишок: ' + (b.remaining || 0) + ', ' + days + ' дн)');
        }
      });
      if (expired.length > 0) {
        ctx += '\n=== ПРОСТРОЧЕНО ===\n';
        ctx += expired.join('\n') + '\n';
      }
      if (expiring.length > 0) {
        ctx += '\n=== СКОРО ПРОСТРОЧИТЬСЯ ===\n';
        ctx += expiring.join('\n') + '\n';
      }
    }

    // Low stock
    var lowStock = stock.filter(function (s) { return s.low; });
    if (lowStock.length > 0) {
      ctx += '\n=== НИЗЬКИЙ ЗАПАС ===\n';
      lowStock.forEach(function (s) {
        ctx += '- ' + (s.name || '?') + ': ' + (s.stock || 0) + ' ' + (s.unit || 'шт') + ' (мін: ' + (s.minStock || 0) + ')\n';
      });
    }

    if (allProducts.length === 0) ctx = 'Інвентар порожній. Товарів не додано.';
    return ctx;
  }

  /**
   * Call Gemini API (text)
   */
  async function callGemini(prompt, systemPrompt) {
    if (!enabled || !apiKey) {
      return { error: 'AI не активовано. Надайте API ключ та згоду.' };
    }

    var contents = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: 'Зрозумів. Я готовий допомогти з управлінням запасами.' }] });
    }
    // Add chat history (last 6 messages)
    chatHistory.slice(-6).forEach(function (msg) {
      contents.push(msg);
    });
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    var body = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    try {
      var url = API_BASE + '/models/' + MODEL + ':generateContent?key=' + apiKey;
      var response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        var errData = await response.json().catch(function () { return {}; });
        var errMsg = errData.error ? errData.error.message : 'HTTP ' + response.status;
        if (response.status === 400 && errMsg.includes('API key')) {
          errMsg = 'Невірний API ключ. Перевірте ключ у налаштуваннях.';
        } else if (response.status === 429) {
          errMsg = 'Перевищено ліміт запитів. Спробуйте пізніше.';
        }
        return { error: errMsg };
      }

      var data = await response.json();
      var text = '';
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        text = data.candidates[0].content.parts.map(function (p) { return p.text; }).join('');
      }

      // Save to history
      chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
      chatHistory.push({ role: 'model', parts: [{ text: text }] });
      if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

      return { text: text, success: true };
    } catch (err) {
      console.error('[GeminiAI] API error:', err);
      return { error: 'Помилка з\'єднання: ' + err.message };
    }
  }

  /**
   * Call Gemini Vision (image + text)
   */
  async function callGeminiVision(imageBase64, prompt) {
    if (!enabled || !apiKey) {
      return { error: 'AI не активовано.' };
    }

    var body = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt || 'Проаналізуй це зображення товарів на полиці. Що бачиш?' },
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    };

    try {
      var url = API_BASE + '/models/' + VISION_MODEL + ':generateContent?key=' + apiKey;
      var response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        var errData = await response.json().catch(function () { return {}; });
        return { error: errData.error ? errData.error.message : 'HTTP ' + response.status };
      }

      var data = await response.json();
      var text = '';
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        text = data.candidates[0].content.parts.map(function (p) { return p.text; }).join('');
      }
      return { text: text, success: true };
    } catch (err) {
      return { error: 'Помилка: ' + err.message };
    }
  }

  // ===== AI FEATURES =====

  /**
   * 1. Natural language query to inventory
   */
  async function askQuestion(question) {
    var ctx = getInventoryContext();
    var systemMsg = 'Ти асистент для управління запасами LifeStock. ' +
      'Відповідай українською, коротко і чітко. ' +
      'Використовуй дані інвентарю нижче для відповідей.\n\n' + ctx;
    return await callGemini(question, systemMsg);
  }

  /**
   * 2. Recipe suggestions from available stock
   */
  async function suggestRecipes() {
    var ctx = getInventoryContext();
    var prompt = 'У мене є такі продукти:\n' + ctx +
      '\n\nЗапропонуй 3 рецепти, які я можу приготувати з цих інгредієнтів. ' +
      'Для кожного рецепту: назва, інгредієнти (з моєї бази), короткий опис. ' +
      'Відповідай українською.';
    return await callGemini(prompt);
  }

  /**
   * 3. Photo analysis (shelf, product count)
   */
  async function analyzePhoto(imageBase64) {
    var prompt = 'Проаналізуй фото полиці/продуктів. ' +
      'Опиши: які товари бачиш, приблизну кількість кожного, стан упаковок. ' +
      'Якщо бачите етикетки — прочитай назви та дати. ' +
      'Відповідай українською, структуровано.';
    return await callGeminiVision(imageBase64, prompt);
  }

  /**
   * 4. Inventory analysis (surplus, deficit, optimization)
   */
  async function analyzeInventory() {
    var ctx = getInventoryContext();
    var prompt = 'Проаналізуй стан інвентарю:\n' + ctx +
      '\n\nДай рекомендації:\n' +
      '1. Які товари в надлишку?\n' +
      '2. Яких товарів не вистачає (треба терміново купити)?\n' +
      '3. Які товари скоро зіп\'ються (мало залишку)?\n' +
      '4. Оптимальні пропозиції для перерозподілу.\n' +
      'Відповідай українською, структуровано.';
    return await callGemini(prompt);
  }

  /**
   * 5. Purchase forecasting
   */
  async function forecastPurchases() {
    var ctx = getInventoryContext();
    var prompt = 'На основі поточного інвентарю:\n' + ctx +
      '\n\nСпрогнозуй:\n' +
      '1. Що потрібно купити найближчим часом?\n' +
      '2. Орієнтовна кількість для закупівлі?\n' +
      '3. Пріоритет: що найтерміновіше?\n' +
      'Відповідай українською.';
    return await callGemini(prompt);
  }

  /**
   * 6. Smart shopping list
   */
  async function generateShoppingList() {
    var ctx = getInventoryContext();
    var prompt = 'Створи список покупок на основі інвентарю:\n' + ctx +
      '\n\nЗроби список:\n' +
      '- Товари з критично низьким запасом\n' +
      '- Товари, що закінчуються\n' +
      '- Орієнтовна вартість закупівлі\n' +
      'Відповідай українською, у вигляді таблиці.';
    return await callGemini(prompt);
  }

  /**
   * Clear chat history
   */
  function clearHistory() { chatHistory = []; }

  function getHistory() { return chatHistory; }

  // Auto-init
  init();

  return {
    isEnabled, hasKey, hasConsent,
    setApiKey, setConsent,
    callGemini, callGeminiVision,
    askQuestion, suggestRecipes, analyzePhoto,
    analyzeInventory, forecastPurchases, generateShoppingList,
    clearHistory, getHistory,
  };
})());

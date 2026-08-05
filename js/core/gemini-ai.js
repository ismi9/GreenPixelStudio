/**
 * [11] AI Core — Multi-provider AI integration
 * Stable since v3.8
 * NOTE: AI is OPTIONAL. Core platform works fully without this module.
 * User must explicitly opt in and provide their own API key.
 *
 * Supported providers:
 * 1. Groq (free, fast, Llama models) — https://console.groq.com/keys
 * 2. OpenRouter (free models, vision support) — https://openrouter.ai/keys
 * 3. Google Gemini (free tier) — https://aistudio.google.com/app/apikey
 *
 * All providers use OpenAI-compatible chat completions API format.
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

    stock.forEach(function (item) {
      ctx += '- ' + (item.name || 'Невідомо');
      if (item.manufacturer) ctx += ' (' + item.manufacturer + ')';
      ctx += ': ' + (item.stock || 0) + ' ' + (item.unit || 'шт');
      if (item.price) ctx += ', ціна: ' + item.price + ' ₴';
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
    // Add chat history (last 6 messages)
    chatHistory.slice(-6).forEach(function (msg) {
      messages.push(msg);
    });

    // Build user message — text or multimodal
    if (imageBase64 && p.vision) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imageBase64 } },
        ],
      });
    } else if (imageBase64 && !p.vision) {
      // Provider doesn't support vision — send text only with note
      messages.push({ role: 'user', content: prompt + '\n\n[Примітка: провайдер не підтримує аналіз зображень. Опис текстом.]' });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    var body = {
      model: model || p.defaultModel,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024,
    };

    // Authorization header is required by all 3 providers
    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://ismi9.github.io/GreenPixelStudio/';
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
      // OpenAI-compatible response format
      if (data.choices && data.choices[0] && data.choices[0].message) {
        text = data.choices[0].message.content || '';
      }

      // Save to history (text only, no images)
      chatHistory.push({ role: 'user', content: prompt });
      chatHistory.push({ role: 'assistant', content: text });
      if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

      return { text: text, success: true };
    } catch (err) {
      console.error('[AI Core] API error:', err);
      return { error: 'Помилка з\'єднання: ' + (err.message || err) };
    }
  }

  // ===== AI FEATURES =====

  async function askQuestion(question) {
    var ctx = getInventoryContext();
    var systemMsg = 'Ти асистент для управління запасами LifeStock. Відповідай українською, коротко і чітко. Використовуй дані інвентарю:\n\n' + ctx;
    return await callAI(question, systemMsg);
  }

  async function suggestRecipes() {
    var ctx = getInventoryContext();
    var prompt = 'У мене є такі продукти:\n' + ctx + '\n\nЗапропонуй 3 рецепти, які я можу приготувати. Для кожного: назва, інгредієнти, короткий опис. Відповідай українською.';
    return await callAI(prompt);
  }

  async function analyzePhoto(imageBase64) {
    var prompt = 'Проаналізуй фото полиці/продуктів. Опиши: які товари бачиш, приблизну кількість, стан упаковок. Якщо бачите етикетки — прочитай назви та дати. Відповідай українською.';
    return await callAI(prompt, 'Ти асистент для управління запасами. Аналізуй фото товарів.', imageBase64);
  }

  async function analyzeInventory() {
    var ctx = getInventoryContext();
    var prompt = 'Проаналізуй стан інвентарю:\n' + ctx + '\n\nДай рекомендації:\n1. Товари в надлишку\n2. Товари яких не вистачає\n3. Що скоро зіпсується\n4. Оптимальні пропозиції. Відповідай українською.';
    return await callAI(prompt);
  }

  async function forecastPurchases() {
    var ctx = getInventoryContext();
    var prompt = 'На основі інвентарю:\n' + ctx + '\n\nСпрогнозуй:\n1. Що потрібно купити найближчим часом\n2. Орієнтовна кількість\n3. Пріоритет. Відповідай українською.';
    return await callAI(prompt);
  }

  async function generateShoppingList() {
    var ctx = getInventoryContext();
    var prompt = 'Створи список покупок на основі інвентарю:\n' + ctx + '\n\nЗроби список:\n- Товари з критично низьким запасом\n- Товари що закінчуються\n- Орієнтовна вартість. Відповідай українською.';
    return await callAI(prompt);
  }

  function clearHistory() { chatHistory = []; }
  function getHistory() { return chatHistory; }

  init();

  return {
    isEnabled, hasKey, hasConsent,
    setApiKey, setConsent, setProvider, setModel,
    getProvider, getProviderInfo, getModel, getProviders,
    callAI,
    askQuestion, suggestRecipes, analyzePhoto,
    analyzeInventory, forecastPurchases, generateShoppingList,
    clearHistory, getHistory,
  };
})());

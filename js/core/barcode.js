/**
 * [5] Barcode Registry — Registry of barcodes, linking to products
 * Stable since v1.0
 * Updated v3.6: OpenFoodFacts API integration + manufacturer/brand fields
 *
 * Lookup order:
 * 1. User's own product database (exact barcode match)
 * 2. Built-in offline database (prefix match)
 * 3. OpenFoodFacts API (online, returns full product info)
 * 4. GS1 country prefix detection (offline fallback)
 * 5. Unknown — prompt manual entry
 */
LifeStock.register('BarcodeRegistry', (function () {
  const ProductCore = () => LifeStock.get('ProductCore');
  const store = LifeStock.store;

  // Built-in offline database (prefix match)
  const knownDB = [
    { code: '48200', icon: '🥛', name: 'Молоко 3.2%', unit: 'л', categoryId: 'cat-drink', price: 32.90, manufacturer: 'Молокія' },
    { code: '48201', icon: '🍞', name: 'Хліб білий', unit: 'шт', categoryId: 'cat-food', price: 18.50, manufacturer: 'Київхліб' },
    { code: '48202', icon: '🧀', name: 'Сир Гауда', unit: 'г', categoryId: 'cat-food', price: 89.00, manufacturer: 'Shostka' },
    { code: '48203', icon: '🥚', name: 'Яйця курячі', unit: 'шт', categoryId: 'cat-food', price: 42.00, manufacturer: 'Ясенсвіт' },
    { code: '48204', icon: '🥬', name: 'Капуста', unit: 'кг', categoryId: 'cat-food', price: 22.00, manufacturer: '' },
    { code: '48205', icon: '☕', name: 'Кава мелена', unit: 'г', categoryId: 'cat-drink', price: 145.00, manufacturer: 'Galka' },
    { code: '48206', icon: '🍝', name: 'Паста спагеті', unit: 'г', categoryId: 'cat-food', price: 38.00, manufacturer: 'Barilla' },
    { code: '48207', icon: '🫒', name: 'Оліва оливкова', unit: 'мл', categoryId: 'cat-food', price: 189.00, manufacturer: 'Borges' },
    { code: '48208', icon: '🍯', name: 'Мед натуральний', unit: 'кг', categoryId: 'cat-food', price: 120.00, manufacturer: '' },
    { code: '48209', icon: '🍫', name: 'Шоколад гіркий', unit: 'г', categoryId: 'cat-food', price: 45.00, manufacturer: 'Milka' },
    { code: '48210', icon: '🧊', name: 'Вода мінеральна', unit: 'л', categoryId: 'cat-drink', price: 15.00, manufacturer: 'Моршинська' },
    { code: '48211', icon: '🧈', name: 'Масло вершкове', unit: 'г', categoryId: 'cat-food', price: 55.00, manufacturer: 'Wimm-Bill-Dann' },
    { code: '48212', icon: '🥕', name: 'Морква', unit: 'кг', categoryId: 'cat-food', price: 18.00, manufacturer: '' },
    { code: '48213', icon: '🥔', name: 'Картопля', unit: 'кг', categoryId: 'cat-food', price: 12.00, manufacturer: '' },
    { code: '48214', icon: '🍌', name: 'Банани', unit: 'кг', categoryId: 'cat-food', price: 38.00, manufacturer: '' },
    { code: '48215', icon: '🧅', name: 'Цибуля', unit: 'кг', categoryId: 'cat-food', price: 14.00, manufacturer: '' },
    { code: '48216', icon: '🧄', name: 'Часник', unit: 'кг', categoryId: 'cat-food', price: 45.00, manufacturer: '' },
    { code: '48217', icon: '🍅', name: 'Помідори', unit: 'кг', categoryId: 'cat-food', price: 48.00, manufacturer: '' },
    { code: '48218', icon: '🥒', name: 'Огірки', unit: 'кг', categoryId: 'cat-food', price: 35.00, manufacturer: '' },
    { code: '48219', icon: '🍟', name: 'Картопля фрі', unit: 'г', categoryId: 'cat-food', price: 65.00, manufacturer: 'Aviko' },
  ];

  /**
   * Sync lookup (checks local DBs only — fast, offline)
   * Returns: { found, source, product, code }
   */
  function lookup(code) {
    // 1. User's own database
    var existing = ProductCore().getByBarcode(code);
    if (existing) return { found: true, source: 'user', product: existing };

    // 2. Built-in offline DB (prefix match)
    var known = null;
    for (var i = 0; i < knownDB.length; i++) {
      if (code.startsWith(knownDB[i].code) || knownDB[i].code === code) {
        known = knownDB[i];
        break;
      }
    }
    if (known) {
      var p = ProductCore().add({
        name: known.name,
        categoryId: known.categoryId,
        unit: known.unit,
        barcode: code,
        price: known.price,
        icon: known.icon,
        minStock: 1,
        manufacturer: known.manufacturer || '',
        country: LifeStock.get('OpenFoodFacts').getCountryFromCode(code),
      });
      return { found: true, source: 'registry', product: p };
    }

    // 3. Not found locally
    return { found: false, source: 'unknown', code: code };
  }

  /**
   * Full lookup: sync first, then async OpenFoodFacts API
   * @param {string} code - barcode
   * @param {function} onResult - callback({ found, source, product, apiData })
   */
  function lookupFull(code, onResult) {
    // Try sync first
    var syncResult = lookup(code);
    if (syncResult.found) {
      onResult && onResult(syncResult);
      // Also try API to enrich the product with additional data
      if (syncResult.source === 'registry' && !syncResult.product.manufacturer) {
        enrichFromAPI(code, syncResult.product);
      }
      return;
    }

    // Not found locally — try OpenFoodFacts API
    var OFF = LifeStock.get('OpenFoodFacts');
    if (!OFF) {
      onResult && onResult(syncResult);
      return;
    }

    OFF.lookup(code, function (apiData) {
      if (apiData && apiData.found && apiData.name) {
        // Create product from API data
        var p = ProductCore().add({
          name: apiData.name,
          categoryId: 'cat-other',
          unit: 'шт',
          barcode: code,
          price: 0,
          icon: '📦',
          minStock: 1,
          manufacturer: apiData.manufacturer || '',
          brand: apiData.brand || '',
          country: apiData.country || OFF.getCountryFromCode(code),
          imageUrl: apiData.imageUrl || '',
          ingredients: apiData.ingredients || '',
          nutritionGrade: apiData.nutritionGrade || '',
          quantity: apiData.quantity || '',
        });
        onResult && onResult({ found: true, source: 'OpenFoodFacts', product: p, apiData: apiData });
      } else if (apiData && apiData.country) {
        // At least got country from GS1 prefix
        onResult && onResult({ found: false, source: 'GS1', code: code, country: apiData.country });
      } else {
        onResult && onResult(syncResult);
      }
    });
  }

  /**
   * Enrich existing product with API data (manufacturer, brand, image, etc.)
   */
  function enrichFromAPI(code, product) {
    var OFF = LifeStock.get('OpenFoodFacts');
    if (!OFF || !product) return;

    OFF.lookup(code, function (apiData) {
      if (!apiData || !apiData.found) return;

      var updated = false;
      var patch = {};

      if (apiData.manufacturer && !product.manufacturer) {
        patch.manufacturer = apiData.manufacturer;
        updated = true;
      }
      if (apiData.brand && !product.brand) {
        patch.brand = apiData.brand;
        updated = true;
      }
      if (apiData.country && !product.country) {
        patch.country = apiData.country;
        updated = true;
      }
      if (apiData.imageUrl && !product.imageUrl) {
        patch.imageUrl = apiData.imageUrl;
        updated = true;
      }
      if (apiData.ingredients && !product.ingredients) {
        patch.ingredients = apiData.ingredients;
        updated = true;
      }
      if (apiData.nutritionGrade && !product.nutritionGrade) {
        patch.nutritionGrade = apiData.nutritionGrade;
        updated = true;
      }

      if (updated) {
        ProductCore().update(product.id, patch);
        console.log('[BarcodeRegistry] Product enriched from API:', product.name, patch);
        LifeStock.emit('product:enriched', { id: product.id, patch: patch });
      }
    });
  }

  function randomCode() {
    var item = knownDB[Math.floor(Math.random() * knownDB.length)];
    return item.code;
  }

  function getAllKnown() { return knownDB.slice(); }

  return { lookup, lookupFull, enrichFromAPI, randomCode, getAllKnown };
})());

/**
 * [5] Barcode Registry — Registry of barcodes, linking to products
 * Stable since v1.0
 */
LifeStock.register('BarcodeRegistry', (function () {
  const ProductCore = () => LifeStock.get('ProductCore');
  const store = LifeStock.store;

  // Known barcode database (offline, no AI needed)
  const knownDB = [
    { code: '48200', icon: '🥛', name: 'Молоко 3.2%', unit: 'л', categoryId: 'cat-drink', price: 32.90 },
    { code: '48201', icon: '🍞', name: 'Хліб білий', unit: 'шт', categoryId: 'cat-food', price: 18.50 },
    { code: '48202', icon: '🧀', name: 'Сир Гауда', unit: 'г', categoryId: 'cat-food', price: 89.00 },
    { code: '48203', icon: '🥚', name: 'Яйця курячі', unit: 'шт', categoryId: 'cat-food', price: 42.00 },
    { code: '48204', icon: '🥬', name: 'Капуста', unit: 'кг', categoryId: 'cat-food', price: 22.00 },
    { code: '48205', icon: '☕', name: 'Кава мелена', unit: 'г', categoryId: 'cat-drink', price: 145.00 },
    { code: '48206', icon: '🍝', name: 'Паста спагеті', unit: 'г', categoryId: 'cat-food', price: 38.00 },
    { code: '48207', icon: '🫒', name: 'Оліва оливкова', unit: 'мл', categoryId: 'cat-food', price: 189.00 },
    { code: '48208', icon: '🍯', name: 'Мед натуральний', unit: 'кг', categoryId: 'cat-food', price: 120.00 },
    { code: '48209', icon: '🍫', name: 'Шоколад гіркий', unit: 'г', categoryId: 'cat-food', price: 45.00 },
    { code: '48210', icon: '🧊', name: 'Вода мінеральна', unit: 'л', categoryId: 'cat-drink', price: 15.00 },
    { code: '48211', icon: '🧈', name: 'Масло вершкове', unit: 'г', categoryId: 'cat-food', price: 55.00 },
    { code: '48212', icon: '🥕', name: 'Морква', unit: 'кг', categoryId: 'cat-food', price: 18.00 },
    { code: '48213', icon: '🥔', name: 'Картопля', unit: 'кг', categoryId: 'cat-food', price: 12.00 },
    { code: '48214', icon: '🍌', name: 'Банани', unit: 'кг', categoryId: 'cat-food', price: 38.00 },
    { code: '48215', icon: '🧅', name: 'Цибуля', unit: 'кг', categoryId: 'cat-food', price: 14.00 },
    { code: '48216', icon: '🧄', name: 'Часник', unit: 'кг', categoryId: 'cat-food', price: 45.00 },
    { code: '48217', icon: '🍅', name: 'Помідори', unit: 'кг', categoryId: 'cat-food', price: 48.00 },
    { code: '48218', icon: '🥒', name: 'Огірки', unit: 'кг', categoryId: 'cat-food', price: 35.00 },
    { code: '48219', icon: '🍟', name: 'Картопля фрі', unit: 'г', categoryId: 'cat-food', price: 65.00 },
  ];

  function lookup(code) {
    const existing = ProductCore().getByBarcode(code);
    if (existing) return { found: true, source: 'user', product: existing };
    const known = knownDB.find(p => code.startsWith(p.code) || p.code === code);
    if (known) {
      // Auto-create product from known DB
      const p = ProductCore().add({
        name: known.name, categoryId: known.categoryId, unit: known.unit,
        barcode: code, price: known.price, icon: known.icon, minStock: 1,
      });
      return { found: true, source: 'registry', product: p };
    }
    return { found: false, source: 'unknown', code };
  }

  function randomCode() {
    const item = knownDB[Math.floor(Math.random() * knownDB.length)];
    return item.code;
  }

  function getAllKnown() { return [...knownDB]; }

  return { lookup, randomCode, getAllKnown };
})());

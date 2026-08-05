/**
 * [1] Product Core — Base entities: products, categories, units
 * Stable since v1.0 — interface will not change without strong reason.
 */
LifeStock.register('ProductCore', (function () {
  const store = LifeStock.store;
  let products = store.get('products', []);
  let categories = store.get('categories', [
    { id: 'cat-food', name: 'Продукти', icon: '🥫' },
    { id: 'cat-drink', name: 'Напої', icon: '🧃' },
    { id: 'cat-household', name: 'Побутові', icon: '🧴' },
    { id: 'cat-other', name: 'Інше', icon: '📦' },
  ]);
  const units = ['шт', 'кг', 'г', 'л', 'мл', 'уп'];

  function save() { store.set('products', products); store.set('categories', categories); }

  function add(data) {
    const p = {
      id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: data.name || 'Без назви',
      categoryId: data.categoryId || 'cat-other',
      unit: data.unit || 'шт',
      barcode: data.barcode || '',
      minStock: data.minStock || 0,
      price: data.price || 0,
      priceUnit: data.priceUnit || '',
      icon: data.icon || '📦',
      manufacturer: data.manufacturer || '',
      brand: data.brand || '',
      country: data.country || '',
      imageUrl: data.imageUrl || '',
      ingredients: data.ingredients || '',
      nutritionGrade: data.nutritionGrade || '',
      quantity: data.quantity || '',
      createdAt: new Date().toISOString(),
    };
    products.push(p);
    save();
    LifeStock.emit('product:added', p);
    return p;
  }

  function update(id, patch) {
    const p = products.find(x => x.id === id);
    if (!p) return null;
    if (patch.priceUnit !== undefined) p.priceUnit = patch.priceUnit;
    if (patch.manufacturer !== undefined) p.manufacturer = patch.manufacturer;
    if (patch.brand !== undefined) p.brand = patch.brand;
    if (patch.country !== undefined) p.country = patch.country;
    if (patch.imageUrl !== undefined) p.imageUrl = patch.imageUrl;
    if (patch.ingredients !== undefined) p.ingredients = patch.ingredients;
    if (patch.nutritionGrade !== undefined) p.nutritionGrade = patch.nutritionGrade;
    Object.assign(p, patch, { updatedAt: new Date().toISOString() });
    save();
    LifeStock.emit('product:updated', p);
    return p;
  }

  function remove(id) {
    products = products.filter(x => x.id !== id);
    save();
    LifeStock.emit('product:removed', id);
  }

  function list(filter) {
    if (!filter) return [...products];
    return products.filter(p => {
      if (filter.categoryId && p.categoryId !== filter.categoryId) return false;
      if (filter.search) {
        const s = filter.search.toLowerCase();
        if (!p.name.toLowerCase().includes(s) && !(p.barcode || '').includes(s)) return false;
      }
      return true;
    });
  }

  function get(id) { return products.find(x => x.id === id) || null; }
  function getByBarcode(code) { return products.find(x => x.barcode === code) || null; }
  function getCategories() { return [...categories]; }
  function getUnits() { return [...units]; }
  function addCategory(name, icon) {
    const c = { id: 'cat-' + Date.now(), name, icon: icon || '📦' };
    categories.push(c); save(); return c;
  }

  function seed() {
    if (products.length > 0) return;
    const samples = [
      { name: 'Молоко 3.2%', categoryId: 'cat-drink', unit: 'л', barcode: '48200', minStock: 3, price: 32.90, priceUnit: 'л', icon: '🥛' },
      { name: 'Хліб білий', categoryId: 'cat-food', unit: 'шт', barcode: '48201', minStock: 2, price: 18.50, priceUnit: 'шт', icon: '🍞' },
      { name: 'Сир Гауда', categoryId: 'cat-food', unit: 'г', barcode: '48202', minStock: 200, price: 89.00, priceUnit: 'кг', icon: '🧀' },
      { name: 'Яйця курячі', categoryId: 'cat-food', unit: 'шт', barcode: '48203', minStock: 10, price: 42.00, priceUnit: 'шт', icon: '🥚' },
      { name: 'Кава мелена', categoryId: 'cat-drink', unit: 'г', barcode: '48205', minStock: 100, price: 145.00, priceUnit: 'кг', icon: '☕' },
    ];
    samples.forEach(s => add(s));
  }

  return { init: () => seed(), add, update, remove, list, get, getByBarcode, getCategories, addCategory, getUnits };
})());

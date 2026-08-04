/**
 * [7] Recipe Engine — Recipes, ingredient calculation, portions
 * Stable since v1.0
 */
LifeStock.register('RecipeEngine', (function () {
  const store = LifeStock.store;
  let recipes = store.get('recipes', []);

  function save() { store.set('recipes', recipes); }

  function add(data) {
    const r = {
      id: 'r-' + Date.now(),
      name: data.name || 'Без назви',
      icon: data.icon || '🍽️',
      portions: data.portions || 2,
      ingredients: data.ingredients || [],
      instructions: data.instructions || '',
      createdAt: new Date().toISOString(),
    };
    recipes.push(r); save(); return r;
  }

  function update(id, patch) {
    const r = recipes.find(x => x.id === id);
    if (!r) return null;
    Object.assign(r, patch); save(); return r;
  }

  function remove(id) { recipes = recipes.filter(x => x.id !== id); save(); }
  function list() { return [...recipes]; }
  function get(id) { return recipes.find(x => x.id === id) || null; }

  function scaleIngredients(recipeId, targetPortions) {
    const r = get(recipeId);
    if (!r) return [];
    const factor = targetPortions / (r.portions || 1);
    return r.ingredients.map(ing => ({
      ...ing,
      quantity: +(ing.quantity * factor).toFixed(2),
    }));
  }

  function checkAvailability(recipeId, targetPortions) {
    const InventoryEngine = LifeStock.get('InventoryEngine');
    const scaled = scaleIngredients(recipeId, targetPortions);
    return scaled.map(ing => {
      const stock = InventoryEngine.getStock(ing.productId);
      return {
        ...ing,
        needed: ing.quantity,
        available: stock,
        enough: stock >= ing.quantity,
      };
    });
  }

  function seed() {
    if (recipes.length > 0) return;
    const products = LifeStock.get('ProductCore').list();
    const milk = products.find(p => p.name.includes('Молоко'));
    const eggs = products.find(p => p.name.includes('Яйця'));
    const bread = products.find(p => p.name.includes('Хліб'));
    if (milk && eggs) {
      add({
        name: 'Млинці', icon: '🥞', portions: 4,
        ingredients: [
          { productId: milk.id, name: milk.name, quantity: 0.5, unit: 'л' },
          { productId: eggs.id, name: eggs.name, quantity: 2, unit: 'шт' },
        ],
        instructions: 'Змішати молоко з яйцями, додати борошно, смажити на сковороді.',
      });
    }
  }

  return { init: () => seed(), add, update, remove, list, get, scaleIngredients, checkAvailability };
})());

/**
 * [3] Inventory Engine — Stock levels, available quantities
 * Stable since v1.0
 */
LifeStock.register('InventoryEngine', (function () {
  const ProductCore = () => LifeStock.get('ProductCore');
  const BatchManager = () => LifeStock.get('BatchManager');

  function getStock(productId) {
    const batches = BatchManager().list({ productId, status: 'active' });
    return batches.reduce((sum, b) => sum + (b.remaining || 0), 0);
  }

  function getAllStock() {
    const products = ProductCore().list();
    return products.map(p => {
      const qty = getStock(p.id);
      return {
        productId: p.id,
        name: p.name,
        icon: p.icon,
        unit: p.unit,
        stock: qty,
        minStock: p.minStock || 0,
        low: qty < (p.minStock || 0),
        price: p.price || 0,
        stockValue: qty * (p.price || 0),
      };
    });
  }

  function getLowStock() {
    return getAllStock().filter(i => i.low);
  }

  function getTotalValue() {
    return getAllStock().reduce((s, i) => s + i.stockValue, 0);
  }

  function getStats() {
    const all = getAllStock();
    const low = all.filter(i => i.low).length;
    const totalValue = all.reduce((s, i) => s + i.stockValue, 0);
    const expiring = BatchManager().getExpiring(3).length;
    return { totalProducts: all.length, lowStock: low, totalValue, expiringBatches: expiring };
  }

  return { getStock, getAllStock, getLowStock, getTotalValue, getStats };
})());

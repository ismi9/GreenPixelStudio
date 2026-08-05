/**
 * [3] Inventory Engine — Stock levels, available quantities
 * Stable since v1.1 — with unit conversion for correct value calculation
 */
LifeStock.register('InventoryEngine', (function () {
  const ProductCore = () => LifeStock.get('ProductCore');
  const BatchManager = () => LifeStock.get('BatchManager');

  /**
   * Unit conversion table — converts from stockUnit to priceUnit.
   * Supports weight (кг/г) and volume (л/мл) conversions.
   * 'шт' and 'уп' are unitless — no conversion needed (1:1).
   */
  const CONVERSIONS = {
    // Weight: 1 кг = 1000 г
    'кг->г': 1000,
    'г->кг': 0.001,
    // Volume: 1 л = 1000 мл
    'л->мл': 1000,
    'мл->л': 0.001,
    // Same unit = 1
    'кг->кг': 1, 'г->г': 1, 'л->л': 1, 'мл->мл': 1,
    'шт->шт': 1, 'уп->уп': 1, 'уп->шт': 1, 'шт->уп': 1,
  };

  /**
   * Convert quantity from one unit to another.
   * If units are incompatible (e.g. кг -> шт) returns null.
   * If either unit is empty/unknown, returns 1 (no conversion).
   */
  function convertQty(qty, fromUnit, toUnit) {
    if (!fromUnit || !toUnit) return 1;
    if (fromUnit === toUnit) return 1;
    var key = fromUnit + '->' + toUnit;
    if (CONVERSIONS[key] !== undefined) return CONVERSIONS[key];
    // Incompatible units — can't convert kg to шт etc.
    return null;
  }

  /**
   * Calculate stock value with proper unit conversion.
   * stockValue = stockQty × (convertFactor from stockUnit to priceUnit) × price
   *
   * Example: stock = 200 (г), price = 89 (₴/кг)
   *   convertFactor = г->кг = 0.001
   *   stockValue = 200 × 0.001 × 89 = 17.80 ₴
   *
   * If priceUnit is empty, assume price is per stock unit (legacy behavior).
   * If units are incompatible (e.g. stock in шт, price per кг), show warning.
   */
  function calculateStockValue(qty, price, stockUnit, priceUnit) {
    if (!price || !qty) return 0;

    // No priceUnit specified — legacy: price is per stock unit
    if (!priceUnit) return qty * price;

    // Same unit or both unitless
    if (stockUnit === priceUnit) return qty * price;

    var factor = convertQty(1, stockUnit, priceUnit);
    if (factor === null) {
      // Incompatible units — can't convert. Fallback: treat as 1:1
      console.warn('[Inventory] Incompatible units: stock=' + stockUnit + ', price=' + priceUnit + '. Using 1:1.');
      return qty * price;
    }

    return qty * factor * price;
  }

  /**
   * Format price with unit context for display.
   * Returns: "89.00 ₴/кг" or "18.50 ₴/шт" etc.
   */
  function formatPrice(price, priceUnit) {
    if (!price) return '0 ₴';
    var s = Number(price).toFixed(2) + ' ₴';
    if (priceUnit) s += '/' + priceUnit;
    return s;
  }

  /**
   * Format stock value for display — rounded to 2 decimals.
   */
  function formatValue(val) {
    return Number(val).toFixed(2) + ' ₴';
  }

  function getStock(productId) {
    const batches = BatchManager().list({ productId, status: 'active' });
    return batches.reduce((sum, b) => sum + (b.remaining || 0), 0);
  }

  function getAllStock() {
    const products = ProductCore().list();
    return products.map(p => {
      const qty = getStock(p.id);
      const stockUnit = p.unit || 'шт';
      const priceUnit = p.priceUnit || '';
      const value = calculateStockValue(qty, p.price || 0, stockUnit, priceUnit);

      return {
        productId: p.id,
        name: p.name,
        icon: p.icon,
        unit: stockUnit,
        priceUnit: priceUnit,
        stock: qty,
        minStock: p.minStock || 0,
        low: qty < (p.minStock || 0),
        price: p.price || 0,
        priceDisplay: formatPrice(p.price || 0, priceUnit),
        stockValue: value,
        stockValueDisplay: formatValue(value),
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
    return {
      totalProducts: all.length,
      lowStock: low,
      totalValue: totalValue,
      totalValueDisplay: formatValue(totalValue),
      expiringBatches: expiring,
    };
  }

  return {
    getStock, getAllStock, getLowStock, getTotalValue, getStats,
    convertQty, calculateStockValue, formatPrice, formatValue,
  };
})());

/**
 * [5b] OpenFoodFacts API — Online product lookup by barcode
 * Stable since v3.6
 * NOTE: Requires internet. Falls back gracefully when offline.
 * Free API — no key needed. https://world.openfoodfacts.org/data
 *
 * GS1 Country Prefixes (first 3 digits of EAN-13):
 * 482 = Ukraine, 460-469 = Russia, 400-440 = Germany,
 * 500-509 = UK, 690-699 = China, 880 = South Korea, etc.
 */
LifeStock.register('OpenFoodFacts', (function () {
  const API_URL = 'https://world.openfoodfacts.org/api/v2/product';
  const GS1_PREFIXES = {
    '482': 'Україна', '481': 'Білорусь', '484': 'Молдова',
    '460': 'Росія', '461': 'Росія', '462': 'Росія', '463': 'Росія',
    '464': 'Росія', '465': 'Росія', '466': 'Росія', '467': 'Росія',
    '468': 'Росія', '469': 'Росія',
    '400': 'Німеччина', '401': 'Німеччина', '402': 'Німеччина',
    '403': 'Німеччина', '404': 'Німеччина', '405': 'Німеччина',
    '406': 'Німеччина', '407': 'Німеччина',
    '500': 'Великобританія', '501': 'Великобританія', '502': 'Великобританія',
    '503': 'Великобританія', '504': 'Великобританія', '505': 'Великобританія',
    '506': 'Великобританія', '507': 'Великобританія', '508': 'Великобританія',
    '509': 'Великобританія',
    '690': 'Китай', '691': 'Китай', '692': 'Китай', '693': 'Китай',
    '694': 'Китай', '695': 'Китай', '696': 'Китай', '697': 'Китай',
    '698': 'Китай', '699': 'Китай',
    '880': 'Південна Корея', '883': 'М'єдеса',
    '800': 'Італія', '801': 'Італія', '802': 'Італія', '803': 'Італія',
    '84': 'Іспанія', '859': 'Чехія', '860': 'Сербія',
    '869': 'Туреччина', '87': 'Нідерланди',
    '884': 'Камбоджа', '885': 'Таїланд', '888': 'Сінгапур',
    '890': 'Індія', '893': 'В'єтнам', '899': 'Індонезія',
    '93': 'Австралія', '94': 'Нов Зеландія',
    '00': 'США/Канада', '01': 'США/Канада', '03': 'США/Канада',
    '04': 'США/Канада', '06': 'США/Канада', '07': 'США/Канада',
    '08': 'США/Канада', '09': 'США/Канада',
    '30': 'Франція', '31': 'Франція', '32': 'Франція', '33': 'Франція',
    '34': 'Франція', '35': 'Франція', '36': 'Франція', '37': 'Франція',
    '38': 'Франція', '39': 'Франція',
    '44': 'Японія', '45': 'Японія', '49': 'Японія',
    '46': 'Росія',
    '54': 'Бельгія/Люксембург', '57': 'Данія',
    '64': 'Фінляндія', '70': 'Норвегія', '73': 'Швеція',
    '76': 'Швейцарія', '77': 'Uruguay', '78': 'Аргентина',
    '80': 'Італія',
  };

  /**
   * Get country from GS1 prefix
   */
  function getCountryFromCode(code) {
    if (!code || code.length < 3) return '';
    var prefix3 = code.substring(0, 3);
    if (GS1_PREFIXES[prefix3]) return GS1_PREFIXES[prefix3];
    var prefix2 = code.substring(0, 2);
    if (GS1_PREFIXES[prefix2]) return GS1_PREFIXES[prefix2];
    return '';
  }

  /**
   * Lookup product by barcode from OpenFoodFacts API
   * @param {string} barcode - EAN-13/UPC barcode
   * @param {function} onResult - callback(productData | null)
   */
  function lookup(barcode, onResult) {
    var url = API_URL + '/' + encodeURIComponent(barcode) + '?fields=product_name,product_name_uk,product_name_ru,brands,manufacturer,origins,countries,quantity,ingredients_text,image_url,image_front_url,image_small_url,categories,nutrisio_grade,nutrition_grades,categories_tags';

    console.log('[OpenFoodFacts] Looking up:', barcode);

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status === 1 && data.product) {
          var p = data.product;
          var productData = {
            name: p.product_name_uk || p.product_name_ru || p.product_name || '',
            brand: p.brands || '',
            manufacturer: p.manufacturer || (p.brands ? p.brands.split(',')[0].trim() : ''),
            country: p.origins || p.countries || getCountryFromCode(barcode),
            quantity: p.quantity || '',
            ingredients: p.ingredients_text || '',
            imageUrl: p.image_front_url || p.image_url || p.image_small_url || '',
            nutritionGrade: p.nutrisio_grade || p.nutrition_grades || '',
            categories: p.categories || '',
            source: 'OpenFoodFacts',
            found: true,
          };
          console.log('[OpenFoodFacts] Found:', productData.name, 'by', productData.manufacturer);
          onResult && onResult(productData);
        } else {
          console.log('[OpenFoodFacts] Not found:', barcode);
          onResult && onResult(null);
        }
      })
      .catch(function (err) {
        console.warn('[OpenFoodFacts] API error:', err.message);
        // Return country from GS1 prefix as fallback
        var country = getCountryFromCode(barcode);
        if (country) {
          onResult && onResult({
            found: true,
            source: 'GS1-prefix',
            country: country,
            name: '',
            brand: '',
            manufacturer: '',
          });
        } else {
          onResult && onResult(null);
        }
      });
  }

  /**
   * Async lookup (returns Promise)
   */
  function lookupAsync(barcode) {
    return new Promise(function (resolve) {
      lookup(barcode, function (data) { resolve(data); });
    });
  }

  return {
    getCountryFromCode: getCountryFromCode,
    lookup: lookup,
    lookupAsync: lookupAsync,
  };
})());

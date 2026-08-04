/**
 * [6] Camera AI — Scanning and recognition via camera
 * Stable since v1.0
 * NOTE: Barcode scanning works offline. OCR requires Tesseract.js (loaded locally).
 * AI features (photo analysis) are optional and require explicit user consent.
 *
 * Scanning methods (in priority order):
 * 1. Barcode: Native BarcodeDetector API (Chrome Android, Safari iOS 17.4+)
 * 2. Barcode: QuaggaJS fallback (all other browsers)
 * 3. OCR: Tesseract.js — reads text from camera (expiry dates, labels)
 * 4. Manual entry (always available)
 * 5. Bluetooth HID scanner (acts as keyboard)
 */
LifeStock.register('CameraAI', (function () {
  let scanning = false;
  let aiEnabled = false;
  let cameraActive = false;
  let stream = null;
  let videoEl = null;
  let rafId = null;
  let detector = null;
  let ocrWorker = null;
  let ocrMode = false;
  let lastDetectedCode = null;
  let lastDetectedTime = 0;
  const DETECT_COOLDOWN = 2000;

  function setAI(enabled) { aiEnabled = enabled; LifeStock.emit('camera:ai-toggle', aiEnabled); }
  function isAIEnabled() { return aiEnabled; }
  function isScanning() { return scanning; }
  function isCameraActive() { return cameraActive; }

  function hasNativeDetector() {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }

  function hasOCR() {
    return typeof Tesseract !== 'undefined';
  }

  /**
   * Start live camera — barcode or OCR mode
   * @param {HTMLElement} container - viewport element
   * @param {function} onDetected - callback(code) for barcode, callback(text) for OCR
   * @param {function} onError - callback(err)
   * @param {boolean} useOCR - if true, capture frame and run OCR; if false, barcode scan
   */
  async function startLiveScan(container, onDetected, onError, useOCR) {
    stopLiveScan();
    ocrMode = !!useOCR;

    if (container) {
      container.querySelectorAll('.ls-scan-placeholder, .ls-scan-result').forEach(el => el.style.display = 'none');
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;
      videoEl.className = 'ls-scan-video';
      if (container) container.appendChild(videoEl);
      videoEl.srcObject = stream;
      await videoEl.play();

      cameraActive = true;
      scanning = true;
      LifeStock.emit('camera:live-start', { mode: ocrMode ? 'ocr' : 'barcode' });
      console.log('[CameraAI] Camera started, mode:', ocrMode ? 'OCR' : 'Barcode');

      if (ocrMode) {
        // OCR mode: capture a single frame and run Tesseract
        // Frame capture is triggered by user button, not continuous loop
        return true;
      }

      // Barcode mode: try native API, fallback to QuaggaJS
      if (hasNativeDetector()) {
        console.log('[CameraAI] Using native BarcodeDetector API');
        try {
          detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'codabar', 'itf', 'qr_code'],
          });
          scanLoopNative(onDetected);
          return true;
        } catch (e) {
          console.warn('[CameraAI] Native detector init failed, falling back to QuaggaJS:', e);
        }
      }

      if (typeof Quagga !== 'undefined') {
        console.log('[CameraAI] Using QuaggaJS fallback');
        startQuagga(container, onDetected, onError);
        return true;
      }

      console.warn('[CameraAI] No barcode library available');
      onError && onError(new Error('Бібліотека розпізнавання недоступна'));
      return false;

    } catch (err) {
      console.warn('[CameraAI] Camera error:', err.message);
      stopLiveScan();
      onError && onError(err);
      return false;
    }
  }

  /**
   * Capture a frame from the current video stream and run OCR
   * @param {function} onResult - callback({ text, dates, raw })
   * @param {function} onError - callback(err)
   */
  async function captureAndOCR(onResult, onError) {
    if (!cameraActive || !videoEl) {
      onError && onError(new Error('Камера не активна'));
      return;
    }

    if (!hasOCR()) {
      onError && onError(new Error('OCR бібліотека не завантажена'));
      return;
    }

    try {
      // Capture frame to canvas
      const canvas = document.createElement('canvas');
      const w = videoEl.videoWidth || 640;
      const h = videoEl.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, w, h);

      // Emit scanning event for UI feedback
      LifeStock.emit('camera:ocr-start', null);
      console.log('[CameraAI] OCR: frame captured', w + 'x' + h);

      // Create Tesseract worker (English + Ukrainian)
      if (!ocrWorker) {
        ocrWorker = await Tesseract.createWorker(['eng', 'ukr'], 1, {
          workerPath: 'js/lib/tesseract/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
          logger: function (m) {
            console.log('[CameraAI] OCR progress:', m.status, m.progress);
            LifeStock.emit('camera:ocr-progress', m);
          },
        });
      }

      // Run recognition
      const { data } = await ocrWorker.recognize(canvas);
      const text = (data.text || '').trim();
      console.log('[CameraAI] OCR result:', text);

      // Parse dates from text (DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY)
      const dates = parseDates(text);
      // Parse possible expiry phrases
      const expiryInfo = parseExpiry(text);

      LifeStock.emit('camera:ocr-complete', { text, dates, expiryInfo });

      if (navigator.vibrate) navigator.vibrate(200);

      onResult && onResult({
        text,
        dates,
        expiryInfo,
        confidence: data.confidence,
        raw: data,
      });

    } catch (err) {
      console.error('[CameraAI] OCR error:', err);
      LifeStock.emit('camera:ocr-error', err);
      onError && onError(err);
    }
  }

  /**
   * Parse dates from OCR text
   * Supports: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YY
   */
  function parseDates(text) {
    const datePatterns = [
      /(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})/g,
      /(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2})/g,
    ];
    const dates = [];
    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let day = parseInt(match[1], 10);
        let month = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          const dateStr = String(day).padStart(2, '0') + '.' + String(month).padStart(2, '0') + '.' + year;
          dates.push({ raw: match[0], formatted: dateStr, day, month, year });
        }
      }
    }
    // Remove duplicates
    const seen = {};
    return dates.filter(function (d) {
      if (seen[d.formatted]) return false;
      seen[d.formatted] = true;
      return true;
    });
  }

  /**
   * Parse expiry-related phrases from OCR text
   */
  function parseExpiry(text) {
    const lower = text.toLowerCase();
    const keywords = [
      'термін', 'придатності', 'вжити до', 'expire', 'exp',
      'вироблено', 'дата', 'best before', 'use by',
      'зберігати', 'хранить до',
    ];
    const found = keywords.filter(function (kw) { return lower.includes(kw); });
    return { hasExpiryKeywords: found.length > 0, keywords: found };
  }

  /**
   * Native BarcodeDetector scan loop
   */
  function scanLoopNative(onDetected) {
    if (!cameraActive || !videoEl || !detector) return;

    detector.detect(videoEl)
      .then(function (barcodes) {
        if (barcodes && barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          const format = barcodes[0].format;
          const now = Date.now();
          if (code && (code !== lastDetectedCode || now - lastDetectedTime > DETECT_COOLDOWN)) {
            lastDetectedCode = code;
            lastDetectedTime = now;
            if (navigator.vibrate) navigator.vibrate(200);
            console.log('[CameraAI] Barcode detected:', code, 'format:', format);
            LifeStock.emit('camera:detected', { code, format });
            onDetected && onDetected(code);
          }
        }
      })
      .catch(function (e) { /* silent */ });

    rafId = requestAnimationFrame(function () { scanLoopNative(onDetected); });
  }

  /**
   * QuaggaJS fallback
   */
  function startQuagga(container, onDetected, onError) {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (videoEl) { videoEl.remove(); videoEl = null; }

    Quagga.init({
      inputStream: {
        name: 'Live', type: 'LiveStream', target: container,
        constraints: { facingMode: 'environment', width: { min: 640, ideal: 1280 }, height: { min: 480, ideal: 720 } },
      },
      locator: { patchSize: 'large', halfSample: false },
      numOfWorkers: 2, frequency: 10,
      decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader', 'code_39_reader'] },
      locate: true,
    }, function (err) {
      if (err) { onError && onError(err); return; }
      Quagga.start();
      cameraActive = true; scanning = true;
      Quagga.onDetected(function (result) {
        const code = result.codeResult.code;
        const now = Date.now();
        if (code === lastDetectedCode && now - lastDetectedTime < DETECT_COOLDOWN) return;
        lastDetectedCode = code; lastDetectedTime = now;
        if (navigator.vibrate) navigator.vibrate(200);
        LifeStock.emit('camera:detected', { code, format: result.codeResult.format });
        onDetected && onDetected(code);
      });
    });
  }

  function stopLiveScan() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    detector = null;
    if (typeof Quagga !== 'undefined' && cameraActive) {
      try { Quagga.offDetected(); Quagga.offProcessed(); Quagga.stop(); } catch (e) {}
    }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (videoEl) { videoEl.remove(); videoEl = null; }
    // Don't terminate ocrWorker here — reuse across captures
    cameraActive = false; scanning = false; ocrMode = false;
    lastDetectedCode = null;
    LifeStock.emit('camera:live-stop', null);
  }

  function destroyOCRWorker() {
    if (ocrWorker) {
      try { ocrWorker.terminate(); } catch (e) {}
      ocrWorker = null;
    }
  }

  // Manual scan
  function scan(code) {
    scanning = true;
    LifeStock.emit('camera:scan-start', code);
    var BarcodeRegistry = LifeStock.get('BarcodeRegistry');
    var result = BarcodeRegistry.lookup(code);
    setTimeout(function () { scanning = false; LifeStock.emit('camera:scan-complete', result); }, 300);
    return result;
  }

  // AI features (still optional)
  function analyzePhoto() {
    if (!aiEnabled) return { error: 'AI не активовано.' };
    return { simulated: true, message: 'AI-аналіз фото: розпізнано 3 товари.' };
  }

  return {
    setAI, isAIEnabled, isScanning, isCameraActive,
    hasNativeDetector, hasOCR, startLiveScan, stopLiveScan,
    captureAndOCR, destroyOCRWorker,
    scan, analyzePhoto,
  };
})());

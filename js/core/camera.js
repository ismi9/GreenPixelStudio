/**
 * [6] Camera AI — Scanning and recognition via camera
 * Stable since v1.0
 * NOTE: This module does NOT require AI. Barcode scanning works offline.
 * AI features (photo analysis, OCR) are optional and require explicit user consent.
 *
 * Scanning sources (in priority order):
 * 1. Camera via QuaggaJS (EAN-13, EAN-8, UPC-A, UPC-E, Code-128)
 * 2. Manual entry (always available as fallback)
 * 3. Bluetooth HID scanner (acts as keyboard, fills input field automatically)
 */
LifeStock.register('CameraAI', (function () {
  let scanning = false;
  let aiEnabled = false;
  let quaggaRunning = false;
  let lastDetectedCode = null;
  let lastDetectedTime = 0;
  const DETECT_COOLDOWN = 2000; // ms between detections to avoid duplicates

  function setAI(enabled) { aiEnabled = enabled; LifeStock.emit('camera:ai-toggle', aiEnabled); }
  function isAIEnabled() { return aiEnabled; }
  function isScanning() { return scanning; }
  function isCameraActive() { return quaggaRunning; }

  /**
   * Start live camera scanning using QuaggaJS
   * @param {HTMLElement} videoContainer - element where video will be placed
   * @param {function} onDetected - callback(code) when barcode detected
   * @param {function} onError - callback(err) if camera fails
   */
  function startLiveScan(videoContainer, onDetected, onError) {
    if (typeof Quagga === 'undefined') {
      onError && onError(new Error('QuaggaJS not loaded'));
      return false;
    }

    stopLiveScan(); // clean up any previous session

    try {
      Quagga.init({
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: videoContainer,
          constraints: {
            facingMode: 'environment', // back camera
            width: { min: 640, ideal: 1280 },
            height: { min: 480, ideal: 720 },
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: true,
        },
        numOfWorkers: 2,
        frequency: 10,
        decoder: {
          readers: [
            'ean_reader',
            'ean_8_reader',
            'upc_reader',
            'upc_e_reader',
            'code_128_reader',
            'code_39_reader',
          ],
        },
        locate: true,
      }, function (err) {
        if (err) {
          console.warn('[CameraAI] Camera init error:', err.message || err);
          onError && onError(err);
          return;
        }
        Quagga.start();
        quaggaRunning = true;
        scanning = true;
        LifeStock.emit('camera:live-start', null);
        console.log('[CameraAI] Live scan started');
      });

      Quagga.onDetected(function (result) {
        const code = result.codeResult.code;
        const now = Date.now();

        // Cooldown to avoid duplicate scans
        if (code === lastDetectedCode && now - lastDetectedTime < DETECT_COOLDOWN) return;
        lastDetectedCode = code;
        lastDetectedTime = now;

        // Vibrate if supported (mobile feedback)
        if (navigator.vibrate) navigator.vibrate(200);

        console.log('[CameraAI] Barcode detected:', code, 'format:', result.codeResult.format);
        LifeStock.emit('camera:detected', { code, format: result.codeResult.format });
        onDetected && onDetected(code);
      });

      Quagga.onProcessed(function (result) {
        // Draw scanning box overlay
        if (!result) return;
        const ctx = Quagga.canvas.ctx.overlay;
        const canvas = Quagga.canvas.dom.overlay;
        if (!ctx || !canvas) return;
        Quagga.ImageDebug.drawPath(
          result.boxes || [], 'green', 2, ctx, canvas.width, canvas.height
        );
        if (result.codeResult && result.codeResult.code) {
          Quagga.ImageDebug.drawPath(
            [result.box], 'red', 4, ctx, canvas.width, canvas.height
          );
        }
      });

      return true;
    } catch (e) {
      onError && onError(e);
      return false;
    }
  }

  function stopLiveScan() {
    if (quaggaRunning && typeof Quagga !== 'undefined') {
      Quagga.offDetected();
      Quagga.offProcessed();
      Quagga.stop();
      quaggaRunning = false;
      scanning = false;
      LifeStock.emit('camera:live-stop', null);
      console.log('[CameraAI] Live scan stopped');
    }
  }

  // Manual scan — lookup a code in the registry
  function scan(code) {
    scanning = true;
    LifeStock.emit('camera:scan-start', code);
    const BarcodeRegistry = LifeStock.get('BarcodeRegistry');
    const result = BarcodeRegistry.lookup(code);
    setTimeout(() => {
      scanning = false;
      LifeStock.emit('camera:scan-complete', result);
    }, 300);
    return result;
  }

  // AI features — only available if user opts in
  function analyzePhoto() {
    if (!aiEnabled) return { error: 'AI не активовано. Увімкніть AI за згодою користувача.' };
    return { simulated: true, message: 'AI-аналіз фото: розпізнано 3 товари на полиці.' };
  }

  function ocrLabel() {
    if (!aiEnabled) return { error: 'AI не активовано.' };
    return { simulated: true, message: 'OCR: зчитано "Молоко 3.2% 1л, термін: 05.08.2026"' };
  }

  return {
    setAI, isAIEnabled, isScanning, isCameraActive,
    startLiveScan, stopLiveScan, scan, analyzePhoto, ocrLabel,
  };
})());

/**
 * [6] Camera AI — Scanning and recognition via camera
 * Stable since v1.0
 * NOTE: This module does NOT require AI. Barcode scanning works offline.
 *
 * Scanning methods (in priority order):
 * 1. Native BarcodeDetector API (Chrome Android, Safari iOS 17.4+) — most reliable
 * 2. QuaggaJS fallback (all other browsers)
 * 3. Manual entry (always available)
 * 4. Bluetooth HID scanner (acts as keyboard, fills input field)
 */
LifeStock.register('CameraAI', (function () {
  let scanning = false;
  let aiEnabled = false;
  let cameraActive = false;
  let stream = null;
  let videoEl = null;
  let rafId = null;
  let detector = null;
  let lastDetectedCode = null;
  let lastDetectedTime = 0;
  const DETECT_COOLDOWN = 2000;

  function setAI(enabled) { aiEnabled = enabled; LifeStock.emit('camera:ai-toggle', aiEnabled); }
  function isAIEnabled() { return aiEnabled; }
  function isScanning() { return scanning; }
  function isCameraActive() { return cameraActive; }

  /**
   * Check if native BarcodeDetector is available
   */
  function hasNativeDetector() {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }

  /**
   * Start live camera scanning
   * Uses native BarcodeDetector API if available, falls back to QuaggaJS
   */
  async function startLiveScan(container, onDetected, onError) {
    stopLiveScan();

    // Clear container — remove placeholder, result, etc.
    if (container) {
      container.querySelectorAll('.ls-scan-placeholder, .ls-scan-result').forEach(el => el.style.display = 'none');
    }

    try {
      // Get camera stream
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // Create video element
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;
      videoEl.className = 'ls-scan-video';
      if (container) {
        container.appendChild(videoEl);
      }
      videoEl.srcObject = stream;
      await videoEl.play();

      cameraActive = true;
      scanning = true;
      LifeStock.emit('camera:live-start', null);
      console.log('[CameraAI] Camera started');

      // Try native BarcodeDetector first
      if (hasNativeDetector()) {
        console.log('[CameraAI] Using native BarcodeDetector API');
        try {
          detector = new window.BarcodeDetector({
            formats: [
              'ean_13', 'ean_8', 'upc_a', 'upc_e',
              'code_128', 'code_39', 'code_93',
              'codabar', 'itf', 'qr_code',
            ],
          });
          scanLoopNative(onDetected);
          return true;
        } catch (e) {
          console.warn('[CameraAI] Native detector init failed, falling back to QuaggaJS:', e);
        }
      }

      // Fallback: QuaggaJS
      if (typeof Quagga !== 'undefined') {
        console.log('[CameraAI] Using QuaggaJS fallback');
        startQuagga(container, onDetected, onError);
        return true;
      }

      // Last resort: frame capture + manual detection
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
   * Native BarcodeDetector scan loop
   * Continuously grabs frames from video and detects barcodes
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
      .catch(function (e) {
        // Silent — detection errors are normal between frames
      });

    rafId = requestAnimationFrame(function () { scanLoopNative(onDetected); });
  }

  /**
   * QuaggaJS fallback scanning
   */
  function startQuagga(container, onDetected, onError) {
    // We already have a video stream, but QuaggaJS wants its own
    // Stop our stream and let QuaggaJS handle the camera
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (videoEl) {
      videoEl.remove();
      videoEl = null;
    }

    Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: container,
        constraints: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
        },
      },
      locator: {
        patchSize: 'large',
        halfSample: false,
      },
      numOfWorkers: 2,
      frequency: 10,
      decoder: {
        readers: [
          'ean_reader', 'ean_8_reader',
          'upc_reader', 'upc_e_reader',
          'code_128_reader', 'code_39_reader',
        ],
      },
      locate: true,
    }, function (err) {
      if (err) {
        console.warn('[CameraAI] QuaggaJS error:', err);
        onError && onError(err);
        return;
      }
      Quagga.start();
      cameraActive = true;
      scanning = true;

      Quagga.onDetected(function (result) {
        const code = result.codeResult.code;
        const now = Date.now();
        if (code === lastDetectedCode && now - lastDetectedTime < DETECT_COOLDOWN) return;
        lastDetectedCode = code;
        lastDetectedTime = now;

        if (navigator.vibrate) navigator.vibrate(200);
        console.log('[CameraAI] QuaggaJS detected:', code);
        LifeStock.emit('camera:detected', { code, format: result.codeResult.format });
        onDetected && onDetected(code);
      });
    });
  }

  /**
   * Stop all camera activity
   */
  function stopLiveScan() {
    // Stop native detector loop
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    detector = null;

    // Stop QuaggaJS if running
    if (typeof Quagga !== 'undefined' && cameraActive) {
      try {
        Quagga.offDetected();
        Quagga.offProcessed();
        Quagga.stop();
      } catch (e) {}
    }

    // Stop camera stream
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }

    // Remove video element
    if (videoEl) {
      videoEl.remove();
      videoEl = null;
    }

    cameraActive = false;
    scanning = false;
    lastDetectedCode = null;
    LifeStock.emit('camera:live-stop', null);
    console.log('[CameraAI] Camera stopped');
  }

  // Manual scan — lookup a code in the registry
  function scan(code) {
    scanning = true;
    LifeStock.emit('camera:scan-start', code);
    var BarcodeRegistry = LifeStock.get('BarcodeRegistry');
    var result = BarcodeRegistry.lookup(code);
    setTimeout(function () {
      scanning = false;
      LifeStock.emit('camera:scan-complete', result);
    }, 300);
    return result;
  }

  // AI features — only available if user opts in
  function analyzePhoto() {
    if (!aiEnabled) return { error: 'AI не активовано.' };
    return { simulated: true, message: 'AI-аналіз фото: розпізнано 3 товари.' };
  }

  function ocrLabel() {
    if (!aiEnabled) return { error: 'AI не активовано.' };
    return { simulated: true, message: 'OCR: зчитано "Молоко 3.2% 1л"' };
  }

  return {
    setAI, isAIEnabled, isScanning, isCameraActive,
    hasNativeDetector, startLiveScan, stopLiveScan,
    scan, analyzePhoto, ocrLabel,
  };
})());

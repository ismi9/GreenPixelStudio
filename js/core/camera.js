/**
 * [6] Camera AI — Scanning and recognition via camera
 * Stable since v1.0
 * NOTE: This module does NOT require AI. Basic scanning works offline.
 * AI features (photo analysis, OCR) are optional and require explicit user consent.
 */
LifeStock.register('CameraAI', (function () {
  let scanning = false;
  let aiEnabled = false;
  let stream = null;

  function setAI(enabled) { aiEnabled = enabled; LifeStock.emit('camera:ai-toggle', aiEnabled); }
  function isAIEnabled() { return aiEnabled; }

  async function startCamera(videoEl) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (videoEl) videoEl.srcObject = stream;
      return true;
    } catch (err) {
      console.warn('[CameraAI] Camera not available:', err.message);
      return false;
    }
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  function isScanning() { return scanning; }

  function scan(code) {
    scanning = true;
    LifeStock.emit('camera:scan-start', code);
    const BarcodeRegistry = LifeStock.get('BarcodeRegistry');
    const result = BarcodeRegistry.lookup(code);
    setTimeout(() => {
      scanning = false;
      LifeStock.emit('camera:scan-complete', result);
    }, 800);
    return result;
  }

  // AI features — only available if user opts in
  function analyzePhoto() {
    if (!aiEnabled) return { error: 'AI не активовано. Увімкніть AI за згодою користувача.' };
    // In real app, would call AI service. Here we simulate.
    return { simulated: true, message: 'AI-аналіз фото: розпізнано 3 товари на полиці.' };
  }

  function ocrLabel() {
    if (!aiEnabled) return { error: 'AI не активовано.' };
    return { simulated: true, message: 'OCR: зчитано "Молоко 3.2% 1л, термін: 05.08.2026"' };
  }

  return { setAI, isAIEnabled, startCamera, stopCamera, isScanning, scan, analyzePhoto, ocrLabel };
})());

// Mobile menu toggle
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger?.addEventListener('click', () => {
    burger.classList.toggle('active');
    nav.classList.toggle('active');
});
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        burger?.classList.remove('active');
        nav?.classList.remove('active');
    });
});

// Scroll fade-in animation
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1 });
document.querySelectorAll('.service-card, .portfolio-card, .price-card, .stat, .core-card, .ext-card, .ai-card, .roadmap-item').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
});

// Smooth scroll offset for sticky header
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            e.preventDefault();
            const offset = 72;
            const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// ===== CONTACT FORM =====
const form = document.getElementById('contactForm');
const note = document.getElementById('formNote');
const submitBtn = form?.querySelector('button[type="submit"]');
form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Відправка...';
    submitBtn.disabled = true;
    note.textContent = '';
    try {
        const formData = new FormData(form);
        formData.append('_subject', 'LifeStock — нова заявка з сайту');
        formData.append('_template', 'table');
        formData.append('_captcha', 'false');
        const response = await fetch(form.action, { method: 'POST', body: formData });
        if (response.ok) {
            note.textContent = '✅ Дякуємо! Заявку відправлено, ми зв\'яжемось з вами.';
            note.style.color = '#2ecc71';
            form.reset();
        } else { throw new Error('Помилка відправки'); }
    } catch (err) {
        note.textContent = '❌ Не вдалося відправити. Напишіть нам на email.';
        note.style.color = '#e74c3c';
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// ===== INTERACTIVE SCANNER DEMO =====
const barcodeDB = [
    { code: '48200', icon: '🥛', name: 'Молоко 3.2%', meta: '1л · 32.90 ₴ · термін: 5 днів' },
    { code: '48201', icon: '🍞', name: 'Хліб білий', meta: '500г · 18.50 ₴ · термін: 2 дні' },
    { code: '48202', icon: '🧀', name: 'Сир Гауда', meta: '200г · 89.00 ₴ · термін: 30 днів' },
    { code: '48203', icon: '🥚', name: 'Яйця курячі', meta: '10шт · 42.00 ₴ · термін: 14 днів' },
    { code: '48204', icon: '🥬', name: 'Капуста білокачанна', meta: '1кг · 22.00 ₴ · термін: 7 днів' },
    { code: '48205', icon: '☕', name: 'Кава мелена', meta: '250г · 145.00 ₴ · термін: 180 днів' },
    { code: '48206', icon: '🍝', name: 'Паста спагеті', meta: '450г · 38.00 ₴ · термін: 365 днів' },
    { code: '48207', icon: '🫒', name: 'Олія оливкова', meta: '500мл · 189.00 ₴ · термін: 540 днів' },
    { code: '48208', icon: '🍯', name: 'Мед натуральний', meta: '1кг · 120.00 ₴ · термін: 730 днів' },
    { code: '48209', icon: '🍫', name: 'Шоколад гіркий', meta: '100г · 45.00 ₴ · термін: 270 днів' },
    { code: '5449',  icon: '🧊', name: 'Вода мінеральна', meta: '1.5л · 15.00 ₴ · термін: 365 днів' },
    { code: '46070', icon: '🧈', name: 'Вершкове масло', meta: '200г · 55.00 ₴ · термін: 90 днів' },
];

const barcodeInput = document.getElementById('barcodeInput');
const scanBtn = document.getElementById('scanBtn');
const randomBtn = document.getElementById('randomBarcodeBtn');
const laser = document.getElementById('scannerLaser');
const placeholder = document.getElementById('scannerPlaceholder');
const resultDiv = document.getElementById('scannerResult');
const productIcon = document.getElementById('scanProductIcon');
const productName = document.getElementById('scanProductName');
const productMeta = document.getElementById('scanProductMeta');
const historyDiv = document.getElementById('scannerHistory');
let scanHistory = [];

function performScan(code) {
    if (!code || code.length < 3) {
        placeholder.querySelector('p').textContent = '⚠️ Введи штрихкод (мінімум 3 цифри)';
        placeholder.style.display = 'block';
        resultDiv.style.display = 'none';
        return;
    }

    // Show scanning animation
    placeholder.style.display = 'none';
    resultDiv.style.display = 'none';
    laser.classList.add('active');

    setTimeout(() => {
        laser.classList.remove('active');

        // Find product
        const product = barcodeDB.find(p => code.startsWith(p.code)) ||
            { icon: '📦', name: 'Невідомий товар', meta: `Код: ${code} · додай вручну` };

        // Show result
        productIcon.textContent = product.icon;
        productName.textContent = product.name;
        productMeta.textContent = product.meta;
        resultDiv.style.display = 'block';

        // Add to history
        scanHistory.unshift({ ...product, code, time: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) });
        if (scanHistory.length > 5) scanHistory.pop();
        renderHistory();
    }, 1200);
}

function renderHistory() {
    if (scanHistory.length === 0) {
        historyDiv.innerHTML = '<h4>Історія сканувань</h4><div class="history-empty">Порожньо — відскануй перший товар</div>';
        return;
    }
    let html = '<h4>Історія сканувань</h4>';
    scanHistory.forEach(item => {
        html += `<div class="history-item"><span class="history-item-icon">${item.icon}</span><span>${item.name}</span><span class="history-item-barcode">${item.code}</span></div>`;
    });
    historyDiv.innerHTML = html;
}

scanBtn?.addEventListener('click', () => performScan(barcodeInput.value.trim()));
barcodeInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') performScan(barcodeInput.value.trim()); });
randomBtn?.addEventListener('click', () => {
    const random = barcodeDB[Math.floor(Math.random() * barcodeDB.length)];
    barcodeInput.value = random.code;
    performScan(random.code);
});

// ===== INTERACTIVE AUTOMATION BUILDER =====
const ruleChecks = document.querySelectorAll('input[data-rule]');
const actionChecks = document.querySelectorAll('input[data-action]');
const previewText = document.getElementById('automationPreviewText');
const testBtn = document.getElementById('testAutomationBtn');
const testResult = document.getElementById('automationTestResult');

function updatePreview() {
    const rules = Array.from(ruleChecks).filter(c => c.checked).map(c => c.parentElement.querySelector('span:nth-of-type(2)').textContent);
    const actions = Array.from(actionChecks).filter(c => c.checked).map(c => c.parentElement.querySelector('span:nth-of-type(2)').textContent);

    if (rules.length === 0) {
        previewText.innerHTML = '<i>Не вибрано жодної умови. Відміть хоча б одну.</i>';
    } else if (actions.length === 0) {
        previewText.innerHTML = `<b>Якщо</b> ${rules.join(' або ')} → <i>не вибрано жодної дії</i>`;
    } else {
        previewText.innerHTML = `<b>Якщо</b> ${rules.join(' або ')} → <b>${actions.join(' та ')}</b>`;
    }
}

ruleChecks.forEach(c => c.addEventListener('change', updatePreview));
actionChecks.forEach(c => c.addEventListener('change', updatePreview));
updatePreview();

testBtn?.addEventListener('click', () => {
    const rules = Array.from(ruleChecks).filter(c => c.checked);
    const actions = Array.from(actionChecks).filter(c => c.checked);

    if (rules.length === 0 || actions.length === 0) {
        testResult.style.display = 'block';
        testResult.className = 'automation-test-result error';
        testResult.innerHTML = '❌ Не можна тестувати правило без умов або дій. Відміть хоча б одну умову і одну дію.';
        return;
    }

    testResult.style.display = 'block';
    testResult.className = 'automation-test-result success';
    let html = '✅ Правило активовано. Симуляція:<br><br>';
    
    if (rules.some(r => r.dataset.rule === 'low-stock')) {
        html += '📉 <b>Спрацювало:</b> "Молоко 3.2%" — залишок 2 шт., мінімум 5 шт.<br>';
    }
    if (rules.some(r => r.dataset.rule === 'expiry')) {
        html += '⏳ <b>Спрацювало:</b> "Хліб білий" — термін придатності 2 дні<br>';
    }
    if (rules.some(r => r.dataset.rule === 'temp')) {
        html += '🌡️ <b>Спрацювало:</b> Холодильник +8°C (норма до +5°C)<br>';
    }
    html += '<br><b>Виконано дії:</b><br>';
    if (actions.some(a => a.dataset.action === 'notify')) html += '🔔 → Сповіщення надіслано: "Молоко закінчується!"<br>';
    if (actions.some(a => a.dataset.action === 'shopping')) html += '🛒 → "Молоко 3.2%" додано до списку покупок<br>';
    if (actions.some(a => a.dataset.action === 'task')) html += '📋 → Завдання створено: "Перевірити запаси молочних продуктів"<br>';
    if (actions.some(a => a.dataset.action === 'priority')) html += '⏰ → Партія хліба #B-2845 позначена для першочергового використання<br>';
    html += '<br>⚡ Усе виконано локально, без AI та без інтернету.';

    testResult.innerHTML = html;
    testResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

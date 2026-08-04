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

// Contact form — sends email via Formsubmit.co
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

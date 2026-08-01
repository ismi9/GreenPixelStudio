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

document.querySelectorAll('.service-card, .portfolio-card, .price-card, .stat').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
});

// Contact form — sends email via Formspree
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
        const response = await fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            note.textContent = '✅ Дякуємо! Лист відправлено, ми зв\'яжемось з вами.';
            note.style.color = '#2ecc71';
            form.reset();
        } else {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.errors?.[0]?.message || 'Помилка відправки');
        }
    } catch (err) {
        note.textContent = '❌ Не вдалося відправити. Спробуйте ще раз або напишіть на email.';
        note.style.color = '#e74c3c';
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
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

// Mobile menu toggle
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger?.addEventListener('click', () => {
    burger.classList.toggle('active');
    nav.classList.toggle('active');
});
// Close menu on link click
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

// Contact form
const form = document.getElementById('contactForm');
const note = document.getElementById('formNote');
form?.addEventListener('submit', (e) => {
    e.preventDefault();
    note.textContent = '✅ Дякуємо! Ми зв\'яжемось з вами найближчим часом.';
    note.style.color = '#2ecc71';
    form.reset();
    setTimeout(() => note.textContent = '', 5000);
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

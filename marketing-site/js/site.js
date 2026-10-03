// ============================================================
// GUARDIAN GROUP — site.js
// Shared nav behavior for the marketing site
// (index.html, about/, services/, contact/)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  const toggle = nav.querySelector('.nav-toggle');
  const links = nav.querySelector('.nav-links');
  if (toggle) {
    if (links && !links.id) links.id = 'site-navigation';
    toggle.setAttribute('aria-controls', links?.id || 'site-navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  nav.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
    const btn = dropdown.querySelector('.nav-dropdown-toggle');
    if (!btn) return;
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      nav.querySelectorAll('.nav-dropdown.open').forEach((d) => {
        d.classList.remove('open');
        d.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        dropdown.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', () => {
    nav.querySelectorAll('.nav-dropdown.open').forEach((d) => {
      d.classList.remove('open');
      d.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    nav.classList.remove('mobile-open');
    toggle?.setAttribute('aria-expanded', 'false');
    nav.querySelectorAll('.nav-dropdown.open').forEach((d) => {
      d.classList.remove('open');
      d.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
    });
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('mobile-open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const word = document.querySelector('[data-rotator-word]');
  if (!word) return;

  const title = word.closest('.hero-title');
  const fitTitle = () => {
    if (!title) return;
    title.style.fontSize = '';
    const available = title.clientWidth;
    const needed = title.scrollWidth;
    if (needed > available) {
      const base = parseFloat(getComputedStyle(title).fontSize);
      title.style.fontSize = (base * (available / needed) * 0.98) + 'px';
    }
  };

  const words = ['Leadership', 'Education', 'Operational Excellence', 'Training'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;

  fitTitle();
  window.addEventListener('resize', fitTitle);
  if (reduceMotion) return;

  setInterval(() => {
    i = (i + 1) % words.length;
    word.classList.add('is-swapping');
    setTimeout(() => {
      word.textContent = words[i];
      fitTitle();
      word.classList.remove('is-swapping');
    }, 600);
  }, 2700);
});

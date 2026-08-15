// ============================================================
// GUARDIAN GROUP — site.js
// Shared nav behavior for the marketing site
// (index.html, about/, services/, contact/)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  const toggle = nav.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('mobile-open');
    });
  }

  nav.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
    const btn = dropdown.querySelector('.nav-dropdown-toggle');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      nav.querySelectorAll('.nav-dropdown.open').forEach((d) => d.classList.remove('open'));
      if (!wasOpen) dropdown.classList.add('open');
    });
  });

  document.addEventListener('click', () => {
    nav.querySelectorAll('.nav-dropdown.open').forEach((d) => d.classList.remove('open'));
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

  setInterval(() => {
    i = (i + 1) % words.length;
    if (reduceMotion) {
      word.textContent = words[i];
      fitTitle();
      return;
    }
    word.classList.add('is-swapping');
    setTimeout(() => {
      word.textContent = words[i];
      fitTitle();
      word.classList.remove('is-swapping');
    }, 600);
  }, 2700);
});

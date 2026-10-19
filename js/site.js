// Savanna site. Everything here enhances a page that already reads fine without script.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- reveal once on entry (from tasteskill base.js), staggered inside each section ----------
(() => {
  const targets = [...document.querySelectorAll('[data-reveal]')];
  // stagger siblings: heading, then text, then picture
  const groups = new Map();
  targets.forEach((el) => {
    const key = el.closest('section, footer, header') || document.body;
    const n = groups.get(key) || 0;
    el.style.setProperty('--i', n % 6);
    groups.set(key, n + 1);
  });
  if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  targets.forEach((el) => io.observe(el));
  addEventListener('load', () => setTimeout(() => {
    targets.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in'); });
  }, 2500));
})();

// ---------- a silent loop is decoration: under reduced motion show its poster ----------
if (reduce) document.querySelectorAll('[data-loop]').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });

// ---------- the sun sets as you scroll ----------
(() => {
  const sun = document.querySelector('.hero__sun');
  if (!sun || reduce) return;
  let ticking = false;
  const update = () => {
    const y = Math.min(scrollY, innerHeight * 1.2);
    sun.style.setProperty('--sink', `${y * 0.45}px`);
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
})();

// ---------- hero carousel: the folder stack ----------
(() => {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;
  const folders = [...root.querySelectorAll('.folder')];
  const tabs = [...root.querySelectorAll('.tab')];
  const SLIDE_MS = 6000;
  root.style.setProperty('--slide-ms', `${SLIDE_MS}ms`);
  // order[0] is the back-most folder, order[last] is the front
  let order = folders.map((_, i) => i).reverse(); // slide 0 starts in front
  let current = 0;
  let timer;

  const paint = () => {
    order.forEach((index, position) => {
      folders[index].style.setProperty('--p', position);
      tabs[index].style.setProperty('--p', position);
      const field = folders[index].style.getPropertyValue('--field');
      const ink = folders[index].style.getPropertyValue('--field-ink');
      tabs[index].style.setProperty('--field', field);
      tabs[index].style.setProperty('--field-ink', ink);
      const front = position === order.length - 1;
      folders[index].classList.toggle('is-front', front);
      folders[index].setAttribute('aria-hidden', String(!front));
      tabs[index].setAttribute('aria-selected', String(front));
      tabs[index].tabIndex = front ? 0 : -1;
    });
  };

  const show = (index) => {
    current = index;
    order = order.filter((i) => i !== index).concat(index);
    // restart the progress fill on the new front tab
    tabs.forEach((t) => { const f = t.querySelector('.tab__fill'); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; });
    paint();
  };

  const next = () => show((current + 1) % folders.length);
  const start = () => { if (reduce) return; stop(); timer = setInterval(next, SLIDE_MS); root.classList.remove('is-paused'); };
  const stop = () => { clearInterval(timer); root.classList.add('is-paused'); };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => { show(i); start(); });
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const to = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      show(to); tabs[to].focus(); start();
    });
  });
  root.addEventListener('pointerenter', stop);
  root.addEventListener('pointerleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', start);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  // swipe on touch
  let x0 = null;
  root.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) { show((current + (dx < 0 ? 1 : -1) + folders.length) % folders.length); start(); }
    x0 = null;
  });

  paint();
  start();
})();

// ---------- waveforms (deterministic bars, drawn once) ----------
(() => {
  document.querySelectorAll('.wave').forEach((el, n) => {
    const bars = 40;
    let seed = 7 + n * 13;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const rects = Array.from({ length: bars }, (_, i) => {
      const envelope = Math.sin((i / (bars - 1)) * Math.PI) * 0.7 + 0.3;
      const h = Math.max(8, Math.round((0.35 + rand() * 0.65) * envelope * 100));
      return `<rect x="${i * 5}" y="${(100 - h) / 2}" width="3" height="${h}" rx="1.5"/>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${bars * 5} 100" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${rects}</svg>`;
  });
})();

// ---------- the live thing: the record button ----------
(() => {
  const section = document.querySelector('.show');
  const button = document.querySelector('[data-rec]');
  if (!section || !button) return;
  const word = section.querySelector('[data-show-word]');
  const label = button.querySelector('[data-rec-label]');
  const time = button.querySelector('[data-rec-time]');
  let started = 0;
  let tick;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  button.addEventListener('click', () => {
    const recording = section.dataset.recording !== 'true';
    section.dataset.recording = String(recording);
    button.setAttribute('aria-pressed', String(recording));
    if (recording) {
      started = performance.now();
      word.textContent = 'Recording.';
      label.textContent = 'Stop';
      time.textContent = '0:00';
      tick = setInterval(() => { time.textContent = fmt((performance.now() - started) / 1000); }, 250);
    } else {
      clearInterval(tick);
      const seconds = (performance.now() - started) / 1000;
      const words = Math.round(seconds * 2.2);
      word.textContent = seconds < 3 ? 'A little longer.' : `That's ${words} words of narration.`;
      label.textContent = 'Record';
    }
  });
})();

// ---------- the figure set by a slider ----------
(() => {
  const input = document.querySelector('[data-minutes]');
  if (!input) return;
  const out = document.querySelector('[data-minutes-out]');
  const figure = document.querySelector('[data-figure]');
  const WORDS_PER_SECOND = 2.2; // the rate Savanna's voices speak at
  const update = () => {
    const minutes = Number(input.value);
    out.textContent = `${minutes % 1 ? minutes.toFixed(1) : minutes} min`;
    figure.textContent = Math.round(minutes * 60 * WORDS_PER_SECOND).toLocaleString('en-US');
  };
  input.addEventListener('input', update);
  update();
})();

// ---------- signature: index with preview ----------
(() => {
  const index = document.querySelector('[data-index]');
  if (!index) return;
  const frames = [...index.querySelectorAll('.index__frame img')];
  const show = (n) => frames.forEach((img, i) => img.classList.toggle('is-on', i === n));
  index.querySelectorAll('[data-preview]').forEach((row) => {
    const n = Number(row.dataset.preview);
    row.addEventListener('pointerenter', () => show(n));
    row.addEventListener('focus', () => show(n));
  });
})();

// ---------- downloads: always the newest signed build from the public releases repository ----------
(() => {
  const links = document.querySelectorAll('[data-download]');
  if (!links.length || !('fetch' in window)) return;
  fetch('https://api.github.com/repos/Savanna-App/releases/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((release) => {
      if (!release || release.draft || release.prerelease) return;
      const dmg = (release.assets || []).find((a) => a.name === 'Savanna.dmg');
      if (dmg) links.forEach((a) => { a.href = dmg.browser_download_url; });
      const version = String(release.tag_name || '').replace(/^v/, '');
      document.querySelectorAll('[data-release-version]').forEach((el) => { el.textContent = version ? ` · v${version}` : ''; });
      document.querySelectorAll('[data-release-page]').forEach((el) => { el.href = release.html_url; });
    })
    .catch(() => {});
})();

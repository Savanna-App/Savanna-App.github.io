// Hero: the window acts out Savanna on a loop, the way the app really works.
// select a region → record → click (zoom) → stop → editor: AI Script writes lines → Generate Voice → play.
(() => {
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;
  const screen = stage.querySelector('.stage__screen');
  const select = stage.querySelector('.stage__select');
  const dims = stage.querySelector('.stage__dims');
  const ripple = stage.querySelector('.stage__ripple');
  const time = stage.querySelector('.stage__time');
  const stop = stage.querySelector('.stage__stop');
  const generate = stage.querySelector('.stage__generate');
  const lines = [...stage.querySelectorAll('.stage__lines li')];
  const clips = [...stage.querySelectorAll('.stage__clip--voice')];
  const playhead = stage.querySelector('.stage__playhead');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const region = { x: 0.12, y: 0.14, w: 0.76, h: 0.7 };
  const click = { x: 0.6, y: 0.52 };
  const flags = ['is-selecting', 'is-rec', 'is-zoom', 'is-editor', 'is-writing', 'is-ready', 'is-end'];

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const on = (...names) => stage.classList.add(...names);
  const off = (...names) => stage.classList.remove(...names);
  const size = () => screen.getBoundingClientRect();

  function cursorTo(x, y, ms = 600) {
    const { width, height } = size();
    stage.style.setProperty('--ct', `${ms}ms`);
    stage.style.setProperty('--cx', `${x * width}px`);
    stage.style.setProperty('--cy', `${y * height}px`);
  }
  // point the cursor at an element inside the screen
  function cursorAt(el, ms) {
    const s = size(), r = el.getBoundingClientRect();
    cursorTo((r.left + r.width * 0.5 - s.left) / s.width, (r.top + r.height * 0.55 - s.top) / s.height, ms);
  }
  async function press(el) {
    stage.style.setProperty('--cs', '0.8');
    el?.classList.add('is-pressed');
    await wait(160);
    stage.style.setProperty('--cs', '1');
    el?.classList.remove('is-pressed');
  }

  function box(r, ms) {
    select.classList.toggle('is-moving', ms > 0);
    select.style.setProperty('--t', `${ms}ms`);
    select.style.setProperty('--sx', `${r.x * 100}%`);
    select.style.setProperty('--sy', `${r.y * 100}%`);
    select.style.setProperty('--sw', `${r.w * 100}%`);
    select.style.setProperty('--sh', `${r.h * 100}%`);
  }

  function countDims(ms) {
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      dims.textContent = `${Math.round(2560 * region.w * e)} × ${Math.round(1440 * region.h * e)}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let clockTimer = 0;
  function startClock() {
    let s = 0;
    time.textContent = '00:00';
    clearInterval(clockTimer);
    clockTimer = setInterval(() => { s += 1; time.textContent = `00:${String(s).padStart(2, '0')}`; }, 1000);
  }

  async function type(el, text, speed = 22) {
    el.textContent = '';
    for (const ch of text) { el.textContent += ch; await wait(speed); }
  }

  function playheadTo(fraction, ms) {
    playhead.classList.toggle('is-moving', ms > 0);
    playhead.style.setProperty('--pt', `${ms}ms`);
    playhead.style.setProperty('--ph', fraction);
  }

  function reset() {
    off(...flags);
    clearInterval(clockTimer);
    box({ x: region.x, y: region.y, w: 0, h: 0 }, 0);
    dims.textContent = '0 × 0';
    lines.forEach((li) => { li.className = ''; li.querySelector('.stage__say').textContent = ''; });
    clips.forEach((c) => c.classList.remove('is-in'));
    playheadTo(0, 0);
  }

  async function loop() {
    for (;;) {
      reset();
      cursorTo(0.5, 0.42, 0);
      await wait(600);

      // 1. drag out a region
      cursorTo(region.x, region.y, 700);
      await wait(800);
      on('is-selecting');
      countDims(1200);
      box(region, 1200);
      cursorTo(region.x + region.w, region.y + region.h, 1200);
      await wait(1500);

      // 2. it becomes the whole recording
      box({ x: 0, y: 0, w: 1, h: 1 }, 700);
      on('is-rec');
      startClock();
      await wait(900);

      // 3. a click: ripple, and Savanna zooms toward it
      cursorTo(click.x, click.y, 800);
      stage.style.setProperty('--zx', `${click.x * 100}%`);
      stage.style.setProperty('--zy', `${click.y * 100}%`);
      await wait(850);
      ripple.classList.remove('is-on'); void ripple.offsetWidth; ripple.classList.add('is-on');
      await press();
      on('is-zoom');
      await wait(2000);
      off('is-zoom');
      await wait(700);

      // 4. stop
      cursorAt(stop, 800);
      await wait(900);
      await press();
      clearInterval(clockTimer);
      on('is-editor');
      off('is-selecting');
      await wait(1100);

      // 5. the AI Script writes timed lines from the screen and what was said
      on('is-writing');
      cursorTo(0.5, 0.45, 900);
      await wait(1400);
      for (const li of lines) {
        if (getComputedStyle(li).display === 'none') continue;
        li.classList.add('is-in');
        await type(li.querySelector('.stage__say'), li.querySelector('.stage__say').dataset.line);
        await wait(150);
      }
      off('is-writing');
      on('is-ready');

      // 6. Generate Voice: each line gets its audio and lands on the Voice-over lane
      cursorAt(generate, 900);
      await wait(1000);
      await press(generate);
      for (const [i, li] of lines.entries()) {
        await wait(380);
        li.classList.add('is-voiced');
        clips[i]?.classList.add('is-in');
      }
      await wait(500);

      // 7. play it back: the line being read lights up
      cursorTo(0.36, 0.42, 900);
      const total = 6000;
      playheadTo(1, total);
      const marks = [0.06, 0.35, 0.68, 1];
      let at = 0;
      for (let i = 0; i < marks.length; i++) {
        await wait(total * (marks[i] - at));
        at = marks[i];
        lines.forEach((li, j) => li.classList.toggle('is-speaking', j === i));
      }
      lines.forEach((li) => li.classList.remove('is-speaking'));

      on('is-end');
      await wait(1200);
    }
  }

  // ---------- scroll: the window lifts away and the sun rises into view behind it ----------
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = Math.max(0, Math.min(scrollY, innerHeight));
      stage.style.setProperty('--lift', `${y * 0.35}px`);
      stage.style.setProperty('--shrink', 1 - y / innerHeight * 0.08);
      ticking = false;
    });
  }

  if (reduce) {
    on('is-rec', 'is-editor', 'is-ready');
    box({ x: 0, y: 0, w: 1, h: 1 }, 0);
    lines.forEach((li, i) => { li.classList.add('is-in', 'is-voiced'); li.querySelector('.stage__say').textContent = li.querySelector('.stage__say').dataset.line; clips[i]?.classList.add('is-in'); });
    return;
  }
  addEventListener('scroll', onScroll, { passive: true });
  requestAnimationFrame(() => loop());
})();

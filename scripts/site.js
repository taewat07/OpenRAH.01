(function () {
  'use strict';

  const REPOSITORY_API = 'https://api.github.com/repos/taewat07/OpenRAH.01';
  const CACHE_KEY = 'openrah:github-stars:v1';
  const CACHE_MAX_AGE = 30 * 60 * 1000;

  function initializePageScroll() {
    const demoLink = document.querySelector('a[href="#demo"]');
    const demo = document.getElementById('demo');
    if (!demoLink || !demo) return;

    demoLink.addEventListener('click', event => {
      event.preventDefault();
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`
      );
      demo.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  }

  function updateStarCount(count) {
    const formattedCount = new Intl.NumberFormat('th-TH', { notation: count >= 1000 ? 'compact' : 'standard' }).format(count);
    document.querySelectorAll('[data-star-count]').forEach(element => {
      element.textContent = formattedCount;
      element.hidden = false;
      element.setAttribute('aria-label', `${count} ดาวบน GitHub`);
    });
  }

  function readCachedStars() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (!Number.isInteger(cached?.count) || Date.now() - cached.savedAt > CACHE_MAX_AGE) return null;
      return cached.count;
    } catch (_error) {
      return null;
    }
  }

  function cacheStars(count) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ count, savedAt: Date.now() }));
    } catch (_error) {
      // A disabled or full localStorage must not affect the page or GitHub CTA.
    }
  }

  async function loadGithubStars() {
    const cachedCount = readCachedStars();
    if (cachedCount !== null) {
      updateStarCount(cachedCount);
      return;
    }

    try {
      const response = await fetch(REPOSITORY_API, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const repository = await response.json();
      if (!Number.isInteger(repository.stargazers_count)) throw new Error('GitHub response omitted stargazers_count');
      updateStarCount(repository.stargazers_count);
      cacheStars(repository.stargazers_count);
    } catch (_error) {
      // ปุ่ม GitHub ยังใช้งานได้ตามปกติ แม้โหลดจำนวนดาวไม่สำเร็จ
    }
  }

  function initializeReveals() {
    const reveals = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(element => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    reveals.forEach(element => observer.observe(element));
  }

  function initializeTearStory() {
    const story = document.querySelector('[data-tear-story]');
    if (!story) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frameId = 0;
    let enabled = false;

    const clamp = value => Math.min(1, Math.max(0, value));
    const range = (value, start, end) => clamp((value - start) / (end - start));
    const smoothStep = value => value * value * (3 - (2 * value));

    function setProgressProperties(progress) {
      const intro = smoothStep(range(progress, 0, .08));
      const split = smoothStep(range(progress, .18, .52));
      const pieces = smoothStep(range(progress, .15, .2));
      const fallProgress = range(progress, .5, .82);
      const fall = fallProgress * fallProgress;
      const fade = smoothStep(range(progress, .66, .84));
      const message = smoothStep(range(progress, .72, .9));

      story.style.setProperty('--paper-scale', (.975 + (.025 * intro)).toFixed(4));
      story.style.setProperty('--paper-y', `${(20 * (1 - intro)).toFixed(2)}px`);
      story.style.setProperty('--base-opacity', (1 - smoothStep(range(progress, .18, .24))).toFixed(4));
      story.style.setProperty('--piece-opacity', (pieces * (1 - fade)).toFixed(4));

      story.style.setProperty('--left-x', `${((-9 * split) - (5 * fall)).toFixed(3)}vw`);
      story.style.setProperty('--left-y', `${((-1.5 * split) + (82 * fall)).toFixed(3)}vh`);
      story.style.setProperty('--left-rotate', `${((-6.5 * split) - (9.5 * fall)).toFixed(3)}deg`);
      story.style.setProperty('--right-x', `${((8.5 * split) + (4.5 * fall)).toFixed(3)}vw`);
      story.style.setProperty('--right-y', `${((2.5 * split) + (86 * fall)).toFixed(3)}vh`);
      story.style.setProperty('--right-rotate', `${((5.5 * split) + (9.5 * fall)).toFixed(3)}deg`);
      story.style.setProperty('--message-opacity', message.toFixed(4));
      story.style.setProperty('--message-y', `${(3 - (28 * message)).toFixed(3)}vh`);
      story.style.setProperty('--message-scale', (.96 + (.04 * message)).toFixed(4));
    }

    function update() {
      frameId = 0;
      if (!enabled) return;

      const rect = story.getBoundingClientRect();
      const distance = Math.max(1, story.offsetHeight - window.innerHeight);
      const progress = clamp(-rect.top / distance);
      setProgressProperties(progress);
    }

    function scheduleUpdate() {
      if (!enabled || frameId) return;
      frameId = window.requestAnimationFrame(update);
    }

    function handleResize() {
      scheduleUpdate();
    }

    function applyMotionPreference() {
      enabled = !reducedMotion.matches;
      story.classList.toggle('is-enhanced', enabled);
      if (enabled) scheduleUpdate();
      if (!enabled && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    }

    function alignDirectAnchor() {
      if (window.location.hash !== '#how-it-works') return;

      const root = document.documentElement;
      const inlineScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.requestAnimationFrame(() => {
        window.scrollTo(0, window.scrollY + story.getBoundingClientRect().top);
        window.requestAnimationFrame(() => {
          root.style.scrollBehavior = inlineScrollBehavior;
          scheduleUpdate();
        });
      });
    }

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    reducedMotion.addEventListener?.('change', applyMotionPreference);
    applyMotionPreference();
    alignDirectAnchor();
  }

  initializePageScroll();
  initializeTearStory();
  initializeReveals();
  loadGithubStars();
})();

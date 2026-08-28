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

  initializePageScroll();
  initializeReveals();
  loadGithubStars();
})();

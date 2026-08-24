(() => {
  'use strict';

  const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function createDrawer({ drawer, trigger, scrim, closeButton = null, openClassTarget = drawer, openClass = 'open', mobileQuery = '(max-width: 760px)', focusTarget = null }) {
    if (!drawer || !trigger || !scrim) throw new Error('RAHShell drawer requires drawer, trigger, and scrim elements.');
    const media = matchMedia(mobileQuery);
    let lastFocus = null;

    const isOpen = () => openClassTarget.classList.contains(openClass);
    const sync = () => drawer.setAttribute('aria-hidden', String(media.matches && !isOpen()));
    const setOpen = (open, restoreFocus = true) => {
      const shouldOpen = Boolean(open && media.matches);
      if (shouldOpen) lastFocus = document.activeElement;
      openClassTarget.classList.toggle(openClass, shouldOpen);
      trigger.setAttribute('aria-expanded', String(shouldOpen));
      trigger.setAttribute('aria-label', shouldOpen ? 'ปิดเมนู' : 'เปิดเมนู');
      if ('hidden' in scrim) scrim.hidden = !shouldOpen;
      sync();
      if (shouldOpen) (focusTarget || drawer.querySelector(focusableSelector))?.focus();
      else if (restoreFocus && media.matches) (lastFocus || trigger)?.focus();
    };
    const onKeydown = event => {
      if (!isOpen()) return;
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
      if (event.key !== 'Tab') return;
      const nodes = [...drawer.querySelectorAll(focusableSelector)].filter(node => !node.hidden && node.getClientRects().length);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    trigger.addEventListener('click', () => setOpen(!isOpen()));
    scrim.addEventListener('click', () => setOpen(false));
    closeButton?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', onKeydown);
    media.addEventListener('change', () => setOpen(false, false));
    sync();

    return Object.freeze({ open: () => setOpen(true), close: restore => setOpen(false, restore), sync, isOpen });
  }

  function bindPopovers(items, wrapperSelector = '.popover-wrap') {
    const close = () => items.forEach(({ button, panel }) => { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); });
    items.forEach(({ button, panel }) => button.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = panel.hidden;
      close();
      panel.hidden = !willOpen;
      button.setAttribute('aria-expanded', String(willOpen));
    }));
    document.addEventListener('click', event => { if (!event.target.closest(wrapperSelector)) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    return Object.freeze({ close });
  }

  window.RAHShell = Object.freeze({ createDrawer, bindPopovers });
})();

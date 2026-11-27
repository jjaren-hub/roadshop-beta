// Disclosures are presentational. Leave controls mounted so drafts, selection,
// native validation and each module's existing listeners survive a toggle.
(() => {
  const candidates = '.card, details';
  const excluded = 'dialog, .customer-document, #wizard:not([data-edit-settings]), #guest, #local-disclosure, #tax-disclaimer-gate, #tax-disclaimer-notice, .ledger-tap-card';
  const paths = new WeakMap();
  const secondary = new Set(['Fixed expenses', 'Break-even revenue', 'Revenue targets',
    'Optional daily external backups', 'Older Road & Shop / EarnKeep records',
    'Delete all local financial data', 'IRS guidance']);
  const route = location.pathname.split('/').pop().replace(/\.html$/, '');

  function workspace() {
    try { return [BookStore.ownerId, BookStore.id]; } catch {}
    try {
      const owner = JSON.parse(localStorage.getItem('roadshop-auth-v1'))?.user?.id;
      if (!owner) return;
      const selected = JSON.parse(sessionStorage.getItem('roadshop-active-workspace') ||
        localStorage.getItem('roadshop-last-' + owner));
      return [owner, selected?.user === owner ? selected.id || null : null];
    } catch {}
  }

  function preference(card, path) {
    const scope = card.dataset.vaultWorkspace ? [card.dataset.vaultOwner, card.dataset.vaultWorkspace] : workspace();
    return scope && 'earnkeep-card:' + JSON.stringify([...scope, route, ...path]);
  }

  function enhance(card) {
    if (paths.has(card) || card.closest(excluded) || card.id === 'member') return;
    const native = card.tagName === 'DETAILS';
    const header = card.querySelector(native ? ':scope > summary' : ':scope > :is(h2,h3)');
    if (native && card.querySelector('.customer-document')) return;
    if (!header || header.querySelector('button,a,input')) return;
    const title = header.textContent.trim();
    if (!title || card.querySelector(':scope > label input[type=password]') && route === 'offline') return;
    const parent = card.parentElement?.closest(candidates);
    const path = [...(paths.get(parent) || []), card.dataset.cardId || header.id || title];
    paths.set(card, path);
    const key = preference(card, path);
    let open = native ? card.open : !secondary.has(title);
    try {
      const saved = key && localStorage.getItem(key);
      if (saved === '1' || saved === '0') open = saved === '1';
    } catch {}
    function remember(value) {
      try { if (key) localStorage.setItem(key, value ? '1' : '0'); } catch {}
    }
    card.classList.add('disclosure');
    header.classList.add('disclosure-heading');
    if (native) {
      card.open = open;
      // The native toggle event is queued as a later task. Persist the attribute
      // change before immediate navigation or a module redraw can discard it.
      new MutationObserver(() => remember(card.open)).observe(card, {attributes:true, attributeFilter:['open']});
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'disclosure-toggle';
    button.setAttribute('aria-label', 'Toggle ' + title);
    header.setAttribute('aria-label', title);
    button.append(...header.childNodes);
    header.append(button);
    function display(value) {
      card.classList.toggle('disclosure-closed', !value);
      button.setAttribute('aria-expanded', String(value));
    }
    display(open);
    button.addEventListener('click', () => {
      const value = card.classList.contains('disclosure-closed');
      display(value);
      remember(value);
    });
  }

  function scan(node) {
    if (!(node instanceof Element) || !node.isConnected) return;
    if (node.matches(candidates)) enhance(node);
    node.querySelectorAll(candidates).forEach(enhance);
  }
  // Authenticated pages bootstrap asynchronously. Wait for selection before
  // binding static markup, then enhance only newly rendered subtrees.
  function start() {
    if (document.body.hasAttribute('data-auth-pending')) return;
    ready.disconnect();
    scan(document.body);
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) scan(node);
    }).observe(document.body, {childList:true, subtree:true});
  }
  const ready = new MutationObserver(start);
  ready.observe(document.body, {attributes:true, attributeFilter:['data-auth-pending']});
  start();
  document.addEventListener('invalid', event => {
    for (let p = event.target.parentElement; p; p = p.parentElement) {
      if (p.matches('.disclosure-closed')) p.querySelector(':scope > .disclosure-heading > button').click();
      if (p.matches('details.disclosure')) p.open = true;
    }
  }, true);
})();

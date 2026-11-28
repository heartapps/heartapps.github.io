// Mentor Heart help: search as you type, the topics menu on phones, "On this page", and the pages kept for offline.
// The index is window.MH_HELP_INDEX from search-index.js (written by _docs/build.py). No server, no libraries.
// Copied into docs/ by _docs/build.py: edit _docs/static/docs.js, not the copy.
(() => {
  const INDEX = window.MH_HELP_INDEX || [];
  const STOP = new Set('a an and are be can do does how i if in into is it me my of on or the to what when where which who why will with you your am get'.split(' '));
  // Words people type for the same thing.
  const ALIKE = {
    hod: ['head'], principal: ['college'], od: ['duty'], pwd: ['password'], pass: ['password'], login: ['sign'], signin: ['sign'],
    logout: ['sign'], apk: ['android'], ios: ['iphone'], mobile: ['phone'], notification: ['notifications'], alert: ['notifications'],
    absent: ['leave', 'attendance'], marks: ['marks', 'assignments'], homework: ['assignments'], notes: ['notes', 'materials'],
    bday: ['birthday'], dob: ['birth'], timetable: ['timetable'], schedule: ['timetable', 'schedule'], delete: ['delete', 'remove'],
    playstore: ['play'], mentee: ['mentees'], approve: ['approve', 'approval'], register: ['register', 'sign'], signup: ['register'],
  };

  const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9.]+/g, ' ').replace(/\.(?!\d)/g, ' ').trim();
  const words = (s) => norm(s).split(' ').filter(Boolean);
  const stem = (w) => (w.length > 4 ? w.replace(/(ings?|es|s)$/, '') : w);

  // Each entry's words, once.
  const docs = INDEX.map((e) => ({ e, title: words(e.t), keys: words(e.k), page: words(e.p), text: words(e.x) }));

  function hit(list, t) {
    let best = 0;
    for (const w of list) {
      if (w === t) return 1;
      if (w.startsWith(t) || (t.length > 3 && w.startsWith(stem(t)))) best = Math.max(best, 0.75);
    }
    return best;
  }

  function search(query, limit) {
    let terms = words(query);
    const kept = terms.filter((t) => !STOP.has(t));
    if (kept.length) terms = kept;
    if (!terms.length) return { terms: [], results: [], total: 0 };
    const groups = terms.map((t) => [t, ...(ALIKE[t] || [])]);
    const score = (d, all) => {
      let total = 0, matched = 0;
      for (const g of groups) {
        let s = 0;
        for (const t of g) {
          s = Math.max(s, hit(d.title, t) * 10 + hit(d.keys, t) * 6 + hit(d.page, t) * 3 + hit(d.text, t) * 1.5);
        }
        if (s > 0) matched++;
        total += s;
      }
      if (all && matched < groups.length) return 0;
      // A phrase in the title counts most.
      if (norm(d.e.t).includes(norm(query))) total += 8;
      return total;
    };
    let found = docs.map((d) => [d, score(d, true)]).filter((x) => x[1] > 0);
    if (!found.length) found = docs.map((d) => [d, score(d, false) * 0.5]).filter((x) => x[1] > 0);
    found.sort((a, b) => b[1] - a[1]);
    return { terms: groups.flat(), results: found.slice(0, limit).map((x) => x[0].e), total: found.length };
  }

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function mark(text, terms) {
    let out = esc(text);
    const ts = [...new Set(terms.filter((t) => t.length > 1))].sort((a, b) => b.length - a.length);
    if (!ts.length) return out;
    const re = new RegExp(`\\b(${ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return out.replace(re, '<mark>$1</mark>');
  }
  function snippet(text, terms) {
    if (!text) return '';
    const low = text.toLowerCase();
    let at = -1;
    for (const t of terms) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
    if (at < 60) return text.length > 170 ? text.slice(0, 170).replace(/\s\S*$/, '') + '…' : text;
    const start = text.lastIndexOf(' ', at - 50) + 1;
    const part = text.slice(start, start + 170);
    return '…' + (part.length < text.length - start ? part.replace(/\s\S*$/, '') + '…' : part);
  }

  // ---------------------------------------------------------------- the search boxes
  let uid = 0;
  for (const form of document.querySelectorAll('[data-search]')) {
    const input = form.querySelector('input');
    const panel = form.querySelector('.search-panel');
    const list = form.querySelector('.search-list');
    const status = form.querySelector('.search-status');
    const full = form.classList.contains('search-page');
    let active = -1, timer = 0;

    const open = (on) => { panel.hidden = !on; input.setAttribute('aria-expanded', String(on)); };
    const options = () => [...list.querySelectorAll('[role="option"]')];
    const setActive = (i) => {
      const opts = options();
      active = opts.length ? (i + opts.length) % opts.length : -1;
      opts.forEach((o, n) => o.setAttribute('aria-selected', String(n === active)));
      if (active >= 0) {
        const o = opts[active];
        input.setAttribute('aria-activedescendant', o.id);
        // Scroll the results panel only, never the page under it.
        if (full) o.scrollIntoView({ block: 'nearest' });
        else {
          const top = o.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
          if (top < panel.scrollTop) panel.scrollTop = top - 8;
          else if (top + o.offsetHeight > panel.scrollTop + panel.clientHeight) panel.scrollTop = top + o.offsetHeight - panel.clientHeight + 8;
        }
      }
      else input.removeAttribute('aria-activedescendant');
    };

    function render() {
      const q = input.value.trim();
      active = -1;
      input.removeAttribute('aria-activedescendant');
      if (!q) {
        list.innerHTML = '';
        status.textContent = '';
        open(false);
        if (full) history.replaceState(null, '', location.pathname);
        return;
      }
      const { results, terms, total } = search(q, full ? 60 : 8);
      list.innerHTML = results.map((e) => {
        const id = `r${++uid}`;
        const where = e.p === 'Help' ? 'Topic' : e.p;
        const roles = e.r && e.r.length && e.r.length < 8 ? ` · ${e.r.join(', ')}` : '';
        return `<li role="option" id="${id}" aria-selected="false"><a href="${esc(e.u)}" tabindex="-1">`
          + `<span class="res-ic"><svg class="i" aria-hidden="true"><use href="#i-${esc(e.i)}"/></svg></span>`
          + `<span class="res-t">${mark(e.t, terms)}</span><span class="res-p">${esc(where)}${esc(roles)}</span>`
          + `<span class="res-x">${mark(snippet(e.x, terms), terms)}</span></a></li>`;
      }).join('');
      if (!results.length) status.textContent = `Nothing found for “${q}”. Try another word, such as “leave”, “password” or “timetable”.`;
      else status.textContent = full ? `${total} result${total === 1 ? '' : 's'} for “${q}”` : `${total} result${total === 1 ? '' : 's'}`;
      if (!full && total > results.length) {
        list.insertAdjacentHTML('beforeend', `<li role="presentation"><a class="search-more" href="search.html?q=${encodeURIComponent(q)}">See all ${total} results</a></li>`);
      }
      open(true);
      if (full) history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
    }

    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { timer = 0; render(); }, 70); });
    // Keys pressed before the typing pause ends act on the newest results, not on ones about to be replaced.
    const settle = () => { if (timer) { clearTimeout(timer); timer = 0; render(); } };
    input.addEventListener('focus', () => { if (input.value.trim() && !full) render(); });
    input.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) settle();
      if (e.key === 'ArrowDown') { e.preventDefault(); if (panel.hidden) render(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); options()[active].querySelector('a').click(); }
      else if (e.key === 'Escape') {
        if (!panel.hidden && !full) { e.preventDefault(); open(false); }
        else if (input.value) { e.preventDefault(); input.value = ''; render(); }
        else input.blur();
      }
    });
    // Enter with nothing chosen: all the results on the search page.
    form.addEventListener('submit', (e) => {
      if (!input.value.trim()) e.preventDefault();
      else if (full) { e.preventDefault(); render(); }
    });
    list.addEventListener('mousemove', (e) => {
      const li = e.target.closest('[role="option"]');
      if (li) setActive(options().indexOf(li));
    });
    // Following a link to a question on this page: open it there.
    list.addEventListener('click', () => { if (!full) setTimeout(() => open(false), 0); });
    document.addEventListener('pointerdown', (e) => { if (!full && !form.contains(e.target)) open(false); });
    form.addEventListener('focusout', (e) => { if (!full && !form.contains(e.relatedTarget)) open(false); });

    if (full) {
      const q = new URLSearchParams(location.search).get('q');
      if (q) { input.value = q; render(); }
      input.focus();
    }
  }

  // "/" or Ctrl+K jumps to the search box, as on most help sites.
  addEventListener('keydown', (e) => {
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing) return;
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      const input = document.querySelector('[data-search] input');
      if (input) { e.preventDefault(); input.focus(); input.select(); }
    }
  });

  // ---------------------------------------------------------------- the topics menu
  const side = document.querySelector('[data-side]');
  if (side) {
    const wide = matchMedia('(min-width: 961px)');
    const fit = () => { side.open = wide.matches; };
    fit();
    wide.addEventListener('change', fit);
  }

  // ---------------------------------------------------------------- a question named in the address opens
  const openTarget = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView({ block: 'start' }); }
  };
  openTarget();
  addEventListener('hashchange', openTarget);

  // ---------------------------------------------------------------- "On this page" follows the reading
  const toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    const links = new Map([...toc.querySelectorAll('a')].map((a) => [a.hash.slice(1), a]));
    const seen = new Map();
    const io = new IntersectionObserver((items) => {
      for (const it of items) seen.set(it.target.id, it.isIntersecting);
      const first = [...links.keys()].find((id) => seen.get(id));
      if (first) links.forEach((a, id) => a.classList.toggle('is-here', id === first));
    }, { rootMargin: '-90px 0px -55% 0px' });
    links.forEach((_, id) => { const h = document.getElementById(id); if (h) io.observe(h); });
  }

  // ---------------------------------------------------------------- offline
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();

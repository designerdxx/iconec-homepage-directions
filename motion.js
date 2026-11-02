/* Iconec motion prototypes · shared motion engine (no build step; Lenis loads from jsDelivr when available).
   Attributes used by the pages:
   data-reveal ["" | "fade" | "left" | "img" | "rule"]  reveal when scrolled into view ("img" wraps its <img> in .rv-mask)
   data-stagger["=ms"]                children with data-reveal get steps of that size, capped at 50ms
   data-hero                          gets .loaded after first paint (line rises, push-in)
   data-header ["" | "overlay"]       .scrolled past 40px (overlay: past the hero), .hidden on fast scroll down
   data-parallax="0.08"               drifts against scroll by that factor (reads batched, then writes)
   data-tabs + [role=tab][data-tab] + [data-panel]   tab panels, new panel arrives in 240ms
   details.acc > .acc-body            open 280ms ease-out, close 200ms ease-in
   data-menu-open / data-menu / data-menu-close      sheet + dimmed backdrop; Escape closes
   window.countTo(el, n, prefix)      280ms number tween; window.iconecScrollTo(target) smooth scroll;
   window.iconecReduce()              true under the system's reduced-motion setting or ?still
*/
(function () {
  var html = document.documentElement;
  html.classList.add('js');
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
                del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  store.del('iconec-rm'); /* the old manual toggle is gone; only the system setting counts now */
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var still = /[?&]still\b/.test(location.search);
  var reduce = still || !!(mq && mq.matches);
  if (still) html.classList.add('still');
  /* every page opens at the top: no restored scroll from history, reloads or the back/forward cache */
  var toTop = function () { if (!location.hash) { window.scrollTo(0, 0); if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); } };
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  toTop();
  window.addEventListener('pageshow', toTop);
  if (reduce) html.classList.add('rm');
  if (still) {
    window.addEventListener('load', function () {
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
        setTimeout(function () { document.title = 'H=' + document.documentElement.scrollHeight; }, 150);
      });
    });
  }

  var EASE_OUT = function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  var lenis = null;
  function headerOffset() { var h = document.querySelector('[data-header]'); return h ? h.offsetHeight : 0; }
  window.iconecScrollTo = function (target, opts) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    var off = (opts && opts.offset != null) ? opts.offset : -headerOffset() - 8;
    if (lenis) { lenis.scrollTo(el || 0, { offset: off, duration: 1.1, easing: EASE_OUT }); return; }
    var y = el ? el.getBoundingClientRect().top + window.scrollY + off : 0;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };
  window.iconecReduce = function () { return reduce; };

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  /* smooth wheel scrolling on desktop pointers only; touch keeps native momentum */
  function startLenis(onTick) {
    var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (reduce || !fine) return;
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js';
    s.async = true;
    s.onload = function () {
      if (!window.Lenis) return;
      lenis = new window.Lenis({ duration: 1.15, easing: EASE_OUT, smoothWheel: true, wheelMultiplier: 0.9 });
      lenis.on('scroll', onTick);
      if (!location.hash) lenis.scrollTo(0, { immediate: true, force: true });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
      if (document.body.classList.contains('menu-open')) lenis.stop();
    };
    document.head.appendChild(s);
  }

  ready(function () {
    /* image masks: wrap the first image of each img-reveal so only transforms animate */
    document.querySelectorAll('[data-reveal="img"]').forEach(function (w) {
      if (w.querySelector('.rv-mask')) return;
      var img = w.tagName === 'IMG' ? null : w.querySelector('img');
      if (!img) return;
      var m = document.createElement('span'); m.className = 'rv-mask';
      img.parentNode.insertBefore(m, img); m.appendChild(img);
    });

    /* stagger delays, capped at 50ms per step */
    document.querySelectorAll('[data-stagger]').forEach(function (g) {
      var step = Math.min(50, parseInt(g.getAttribute('data-stagger'), 10) || 45);
      g.querySelectorAll('[data-reveal]').forEach(function (el, i) { el.style.setProperty('--d', (i * step) + 'ms'); });
    });

    /* reveals; .done drops will-change once the entrance has finished */
    var items = [].slice.call(document.querySelectorAll('[data-reveal]'));
    function finish(el) { setTimeout(function () { el.classList.add('done'); }, 1600); }
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); finish(e.target); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      items.forEach(function (el) { io.observe(el); });
    } else { items.forEach(function (el) { el.classList.add('in', 'done'); }); }

    /* hero load */
    document.querySelectorAll('[data-hero]').forEach(function (h) {
      h.querySelectorAll('.h-line').forEach(function (l, i) { l.style.setProperty('--i', i); });
      requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add('loaded'); }); });
    });

    /* header + parallax, one rAF per frame; all layout reads happen before any writes */
    var hdr = document.querySelector('[data-header]');
    var hero = document.querySelector('[data-hero]');
    var par = [].slice.call(document.querySelectorAll('[data-parallax]')).map(function (el) {
      var f = parseFloat(el.getAttribute('data-parallax')) || 0.08;
      return { el: el, f: f, s: (1 + Math.abs(f) * 1.6).toFixed(3) };
    });
    var lastY = window.scrollY, queued = false;
    function frame() {
      queued = false;
      var y = window.scrollY, vh = window.innerHeight;
      var limit = 40;
      if (hdr && hdr.getAttribute('data-header') === 'overlay' && hero) limit = Math.max(40, hero.offsetHeight - hdr.offsetHeight - 10);
      var rects = reduce ? [] : par.map(function (p) { return p.el.parentElement.getBoundingClientRect(); });
      if (hdr) {
        hdr.classList.toggle('scrolled', y > limit);
        var down = y > lastY + 4, up = y < lastY - 4;
        if (down && y > 600 && !document.body.classList.contains('menu-open')) hdr.classList.add('hidden');
        if (up || y < 600) hdr.classList.remove('hidden');
      }
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (r.bottom < -200 || r.top > vh + 200) continue;
        var c = r.top + r.height / 2 - vh / 2;
        par[i].el.style.transform = 'translate3d(0,' + (-c * par[i].f).toFixed(1) + 'px,0) scale(' + par[i].s + ')';
      }
      lastY = y;
    }
    function tick() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    frame();
    startLenis(tick);

    /* in-page anchors go through the same smooth scroll */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      window.iconecScrollTo(t);
    });

    /* tabs */
    document.querySelectorAll('[data-tabs]').forEach(function (root) {
      var tabs = [].slice.call(root.querySelectorAll('[role="tab"][data-tab]'));
      var panels = [].slice.call(root.querySelectorAll('[data-panel]'));
      function show(key, focus) {
        tabs.forEach(function (t) { var on = t.getAttribute('data-tab') === key; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
        panels.forEach(function (p) {
          var on = p.getAttribute('data-panel') === key;
          if (on && p.hidden) { p.hidden = false; p.classList.add('enter'); requestAnimationFrame(function () { requestAnimationFrame(function () { p.classList.remove('enter'); }); }); }
          if (!on) p.hidden = true;
        });
        root.dispatchEvent(new CustomEvent('tabchange', { detail: { key: key } }));
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { show(t.getAttribute('data-tab')); });
        t.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (d) { e.preventDefault(); var n = tabs[(i + d + tabs.length) % tabs.length]; show(n.getAttribute('data-tab'), true); }
        });
      });
    });

    /* accordions: 280ms ease-out open, 200ms ease-in close */
    document.querySelectorAll('details.acc').forEach(function (d) {
      var s = d.querySelector('summary'), b = d.querySelector('.acc-body');
      if (!s || !b) return;
      var busy = false;
      s.addEventListener('click', function (e) {
        if (reduce) return;
        e.preventDefault();
        if (busy) return; busy = true;
        if (d.open) {
          b.style.height = b.scrollHeight + 'px';
          requestAnimationFrame(function () { b.style.transition = 'height .2s cubic-bezier(.7,0,.84,0), opacity .2s cubic-bezier(.7,0,.84,0)'; b.style.height = '0px'; b.style.opacity = '0'; });
          setTimeout(function () { d.open = false; b.style.cssText = ''; busy = false; }, 210);
        } else {
          d.open = true; var h = b.scrollHeight; b.style.height = '0px'; b.style.opacity = '0';
          requestAnimationFrame(function () { b.style.transition = 'height .28s cubic-bezier(.16,1,.3,1), opacity .28s cubic-bezier(.16,1,.3,1)'; b.style.height = h + 'px'; b.style.opacity = '1'; });
          setTimeout(function () { b.style.cssText = ''; busy = false; }, 290);
        }
      });
    });

    /* menu sheet with dimmed backdrop */
    var menu = document.querySelector('[data-menu]');
    var scrim = null;
    if (menu) { scrim = document.createElement('div'); scrim.className = 'menu-scrim'; scrim.setAttribute('aria-hidden', 'true'); document.body.appendChild(scrim); }
    var opener = null;
    function openMenu(b) { if (!menu) return; opener = b; menu.classList.add('open'); document.body.classList.add('menu-open'); if (lenis) lenis.stop();
      document.querySelectorAll('[data-menu-open]').forEach(function (o) { o.setAttribute('aria-expanded', 'true'); });
      var f = menu.querySelector('[data-menu-close], a, button'); if (f) setTimeout(function () { f.focus(); }, 60); }
    function closeMenu() { if (!menu || !menu.classList.contains('open')) return; menu.classList.remove('open'); document.body.classList.remove('menu-open'); if (lenis) lenis.start();
      document.querySelectorAll('[data-menu-open]').forEach(function (o) { o.setAttribute('aria-expanded', 'false'); }); if (opener) opener.focus(); }
    document.querySelectorAll('[data-menu-open]').forEach(function (b) { b.addEventListener('click', function () { openMenu(b); }); });
    document.querySelectorAll('[data-menu-close], [data-menu] a').forEach(function (b) { b.addEventListener('click', closeMenu); });
    if (scrim) scrim.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    if (menu) menu.querySelectorAll('.m-links a').forEach(function (a, i) { a.style.setProperty('--i', i); });

    /* language toggle (visual only unless a page handles it) */
    document.querySelectorAll('[data-lang] button').forEach(function (b) {
      b.addEventListener('click', function () { b.parentElement.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
    });

    /* review bar: back to the gallery, the direction's name, previous / next direction */
    var DIRS = [['vitrine', 'The Vitrine'], ['showroom', 'The Showroom'], ['catalogue', 'The Catalogue'], ['maison', 'The Maison'],
                ['campaign', 'The Campaign'], ['split', 'The Split'], ['everyday', 'The Everyday'], ['sets', 'The Sets']];
    var back = document.querySelector('meta[name="iconec-index"]');
    var slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    var at = -1; DIRS.forEach(function (d, i) { if (d[0] === slug) at = i; });
    if (back) {
      try { sessionStorage.setItem('iconec-from', slug); } catch (e) {}
      var icon = function (d) { return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
      var bar = document.createElement('nav'); bar.className = 'rv'; bar.setAttribute('aria-label', 'Directions');
      var h = '<a href="' + back.content + '" aria-label="All directions">' + icon('<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>') + '</a>';
      if (at > -1) {
        var prev = DIRS[(at + DIRS.length - 1) % DIRS.length], next = DIRS[(at + 1) % DIRS.length];
        h += '<span class="rv-n">' + DIRS[at][1] + '</span>' +
             '<a href="' + prev[0] + '.html" aria-label="Previous: ' + prev[1] + '">' + icon('<path d="M10 3.5 5.5 8l4.5 4.5"/>') + '</a>' +
             '<a href="' + next[0] + '.html" aria-label="Next: ' + next[1] + '">' + icon('<path d="M6 3.5 10.5 8 6 12.5"/>') + '</a>';
      }
      bar.innerHTML = h;
      document.body.appendChild(bar);
    }
  });

  /* number tween for prices: visitor-triggered, so 280ms ease-out */
  window.countTo = function (el, to, prefix) {
    prefix = prefix || '';
    var from = parseInt((el.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
    if (reduce || from === to) { el.textContent = prefix + to; return; }
    var t0 = performance.now(), dur = 280;
    if (el._countRaf) cancelAnimationFrame(el._countRaf);
    function step(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + Math.round(from + (to - from) * e);
      if (p < 1) el._countRaf = requestAnimationFrame(step);
    }
    el._countRaf = requestAnimationFrame(step);
  };
})();

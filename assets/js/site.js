/* Small progressive enhancements. Every page works without this file. */
(function () {
  var root = document.documentElement;

  /* ---------- theme toggle: system -> light -> dark -> system ---------- */
  var btn = document.querySelector('.theme-toggle');
  if (btn) {
    var order = ['system', 'light', 'dark'];
    var current = function () { return root.getAttribute('data-theme') || 'system'; };
    var render = function () {
      var t = current();
      btn.setAttribute('data-mode', t);
      btn.setAttribute('aria-label', 'Theme: ' + t + ' (click to change)');
      btn.title = 'Theme: ' + t;
    };
    btn.hidden = false;
    render();
    btn.addEventListener('click', function () {
      var next = order[(order.indexOf(current()) + 1) % order.length];
      if (next === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', next);
      try {
        if (next === 'system') localStorage.removeItem('theme');
        else localStorage.setItem('theme', next);
      } catch (e) {}
      render();
    });
  }

  /* ---------- mark the current section in the header nav ---------- */
  var path = location.pathname;
  document.querySelectorAll('.site-nav a[href^="/"]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href !== '/' && path.indexOf(href) === 0) a.setAttribute('aria-current', 'page');
  });

  /* ---------- ADR table of contents: highlight the section in view ---------- */
  var toc = document.querySelector('.adr-toc');
  if (toc && 'IntersectionObserver' in window) {
    var links = {};
    toc.querySelectorAll('a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.querySelector('h2').id] = e.isIntersecting; });
      var active = null;
      document.querySelectorAll('.adr-sec').forEach(function (s) {
        var id = s.querySelector('h2').id;
        if (!active && visible[id]) active = id;
      });
      if (!active) return;
      Object.keys(links).forEach(function (id) { links[id].classList.toggle('is-active', id === active); });
    }, { rootMargin: '-80px 0px -55% 0px' });
    document.querySelectorAll('.adr-sec').forEach(function (s) { if (s.querySelector('h2')) io.observe(s); });
  }
})();

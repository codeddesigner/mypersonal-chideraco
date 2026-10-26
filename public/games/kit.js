/* The tiny games (public/games): the pieces they share.
   Plain browser JavaScript with no build step, so the "not available" page (lib/offline.ts) can load the games
   while the rest of the site is off, and the Play page (components/Arcade.tsx) can load the same files.
   Each game registers itself as chideraGames.<name>(canvas, ui) and returns a function that stops it.
   ui.score is an element the game writes its scores into. Best scores are kept in this browser only. */
(function () {
  'use strict';
  var games = (window.chideraGames = window.chideraGames || {});

  // The site's colours (lib/accent.ts), plus a few of the games' own.
  games.colours = {
    pool: '#BFE3E8', poolDeep: '#4F9AAB', leaf: '#43BD8E', leafDeep: '#1D6E50',
    lemon: '#E8EBB4', lemonDeep: '#A8AE36', blush: '#F3CFC6', blushDeep: '#B85F7A',
    iris: '#CFC8F2', irisDeep: '#6E5CCB', saffron: '#F5C845', saffronDeep: '#B5800F',
    ink: '#142218', paper: '#FAFAF5', ball: '#EE7A2F', rim: '#D2491F', shadow: 'rgba(20, 34, 24, 0.18)'
  };

  games.kit = function (canvas, ui, W, H) {
    var ctx = canvas.getContext('2d');
    var offs = [], stopped = false, raf = 0, frameFn = null, last = 0, running = false, scoreKey = '';
    var k = { ctx: ctx, W: W, H: H, C: games.colours };

    // Listeners are remembered so stopping the game removes every one of them.
    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      offs.push(function () { target.removeEventListener(type, fn, opts) });
    }
    k.on = on;

    // The game is drawn in its own units (W x H) and the canvas is scaled to fit.
    k.size = function () {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    k.pos = function (e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };

    // The keyboard works anywhere on the page unless a link, button or field has focus.
    // down(key) returns true when the game used the key, so the page doesn't scroll as well.
    k.keys = function (down, up) {
      on(window, 'keydown', function (e) {
        var el = document.activeElement;
        if (el && el !== canvas && el !== document.body && el !== document.documentElement) return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (down(e.key, e)) e.preventDefault();
      });
      if (up) {
        on(window, 'keyup', function (e) { up(e.key, e) });
        on(window, 'blur', function () { up('', null) });
      }
    };

    // Animation. frame(dt, now) runs once a frame and returns true while it needs more frames;
    // wake() starts it again. A game that's standing still uses no power.
    k.loop = function (fn) { frameFn = fn };
    function tick(now) {
      raf = 0;
      if (stopped) { running = false; return }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (frameFn(dt, now)) raf = requestAnimationFrame(tick);
      else { running = false; last = 0 }
    }
    k.wake = function () {
      if (running || stopped || !frameFn) return;
      running = true; last = 0; raf = requestAnimationFrame(tick);
    };

    // Games that keep moving pause when the page is hidden or the game is scrolled out of view.
    k.onPause = function (fn) {
      on(document, 'visibilitychange', function () { if (document.hidden) fn() });
      on(window, 'blur', fn);
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (list) {
          if (list[list.length - 1].intersectionRatio < 0.3) fn();
        }, { threshold: [0, 0.3] });
        io.observe(canvas);
        offs.push(function () { io.disconnect() });
      }
    };

    // Best scores, kept in this browser.
    k.load = function (key, fallback) {
      try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v) } catch (e) { return fallback }
    };
    k.save = function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) {}
    };

    // The scores under the game: [['Best', 4], ...].
    k.score = function (pairs) {
      var el = ui && ui.score, key = JSON.stringify(pairs);
      if (!el || key === scoreKey) return;
      scoreKey = key;
      while (el.firstChild) el.removeChild(el.firstChild);
      pairs.forEach(function (p) {
        var s = document.createElement('span'), b = document.createElement('b');
        s.appendChild(document.createTextNode(p[0]));
        b.textContent = String(p[1]);
        s.appendChild(b);
        el.appendChild(s);
      });
    };

    // The site's heading face: the Play page names it in --font-display; the "not available" page loads it itself.
    var display = '';
    try { display = getComputedStyle(canvas).getPropertyValue('--font-display').trim() } catch (e) {}
    display = (display || '"Chidera SPAR"') + ', Georgia, serif';
    k.font = function (px) { return px + 'px ' + display };
    k.fontReady = function (fn) {
      if (!document.fonts || !document.fonts.load) return;
      document.fonts.load(k.font(32)).then(function () { if (!stopped) fn() }, function () {});
    };
    k.text = function (str, x, y, px, colour, align) {
      ctx.font = k.font(px); ctx.fillStyle = colour || k.C.ink;
      ctx.textAlign = align || 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(str, x, y);
    };
    // A message over the game, on a paper card.
    k.card = function (lines, y, cx) {
      var big = lines[0], small = lines[1] || '', w = 0;
      cx = cx || W / 2;
      ctx.font = k.font(34); w = ctx.measureText(big).width;
      ctx.font = k.font(19); w = Math.max(w, ctx.measureText(small).width);
      w = Math.min(W - 40, w + 64);
      var h = small ? 104 : 72, x = cx - w / 2, top = (y || H / 2) - h / 2;
      ctx.fillStyle = k.C.paper; ctx.strokeStyle = k.C.ink; ctx.lineWidth = 2.5;
      k.rrect(x, top, w, h, 14); ctx.fill(); ctx.stroke();
      k.text(big, cx, top + (small ? 46 : 47), 34);
      if (small) k.text(small, cx, top + 80, 19, k.C.ink);
    };

    // Drawing helpers.
    k.circ = function (x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2) };
    k.rrect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    };
    k.cloud = function (x, y, s) {
      ctx.fillStyle = k.C.paper;
      k.circ(x, y, 14 * s); ctx.fill();
      k.circ(x + 22 * s, y - 10 * s, 20 * s); ctx.fill();
      k.circ(x + 46 * s, y, 14 * s); ctx.fill();
      ctx.fillRect(x, y - 4 * s, 46 * s, 18 * s);
    };
    // Whether the person is using a mouse (for the hints drawn in the game).
    k.fine = function () {
      try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches } catch (e) { return true }
    };

    k.stopped = function () { return stopped };
    k.stop = function () {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      offs.forEach(function (off) { off() });
      offs = [];
    };

    k.size();
    return k;
  };
})();

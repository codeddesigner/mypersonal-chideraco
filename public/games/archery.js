/* Archery. Five arrows a round at a target that moves further away and starts to bob up and down.
   With a mouse: point where to shoot and click (the further from the bow, the harder the shot).
   On a touch screen: pull back anywhere and let go. With a keyboard: the arrows aim and Space shoots.
   Needs kit.js. */
(function () {
  'use strict';
  var games = (window.chideraGames = window.chideraGames || {});

  games.archery = function (canvas, ui) {
    var W = 600, H = 450, k = games.kit(canvas, ui, W, H), ctx = k.ctx, C = k.C, circ = k.circ;
    var GROUND = 372, G = 520, BX = 96, BY = 284, AIM = 2.7, K = 5.2, MINV = 300, MAXV = 1000;
    var TR = 46, POST_TOP = 132, ARROWS = 5, KEY = 'chidera-archery-best';

    var mode = 'ready', drag = null, hover = null, keyAim = false, kb = { angle: 14, power: 0.55 }, lastInput = '';
    var arrow = null, stuck = [], pops = [], left = ARROWS, score = 0, nextAt = 0, shots = 0;
    var best = parseInt(k.load(KEY, 0), 10) || 0;
    var target = { x: 400, from: 400, to: 400, slide: 1, base: 250, amp: 0, speed: 1.5, phase: 0 };

    function show() { k.score([['Score', score], ['Best', best]]) }
    function rand(a, b) { return a + Math.random() * (b - a) }
    function targetY() { return target.base + target.amp * Math.sin(target.phase) }

    // Each arrow the target moves somewhere new, and from the second arrow on it bobs, more each time.
    function nextTarget(first) {
      var i = ARROWS - left;
      target.from = target.x;
      target.to = first ? 400 : rand(360, 530);
      target.slide = first ? 1 : 0;
      if (first) target.x = target.to;
      target.amp = i < 5 ? [0, 26, 40, 52, 60][i] : 60;
      target.speed = rand(1.3, 2.1) + i * 0.1;
    }
    function newRound() {
      left = ARROWS; score = 0; stuck = []; arrow = null; mode = 'ready'; target.phase = 0;
      nextTarget(true); show();
    }

    // Touch: pull back to draw the bow. Mouse: shoot towards the pointer. Keyboard: angle and power.
    function velocity() {
      var vx, vy, m, a;
      if (drag) { vx = (drag.x0 - drag.x) * K; vy = (drag.y0 - drag.y) * K }
      else if (hover && !keyAim) { vx = (hover.x - BX) * AIM; vy = (hover.y - BY) * AIM }
      else { a = kb.angle * Math.PI / 180; m = MINV + kb.power * (MAXV - MINV); vx = Math.cos(a) * m; vy = -Math.sin(a) * m }
      a = Math.max(-1.2, Math.min(1.2, Math.atan2(vy, Math.max(1, vx))));
      m = Math.max(MINV, Math.min(MAXV, Math.sqrt(vx * vx + vy * vy)));
      return { x: Math.cos(a) * m, y: Math.sin(a) * m, a: a, p: (m - MINV) / (MAXV - MINV) };
    }
    function aiming() { return mode === 'ready' && target.slide >= 1 && (drag || hover || keyAim) }

    function loose() {
      var v = velocity();
      arrow = { x: BX + Math.cos(v.a) * (40 - v.p * 26), y: BY + Math.sin(v.a) * (40 - v.p * 26), vx: v.x, vy: v.y, t: 0 };
      mode = 'flying'; left--; shots++;
      k.wake();
    }
    function land(text, x, y) {
      pops.push({ text: text, x: x, y: y, t: 1 });
      mode = 'landed'; arrow = null; nextAt = performance.now() + 850;
      show();
    }

    function step(dt) {
      var px = arrow.x, py = arrow.y, ty = targetY();
      arrow.vy += G * dt; arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt; arrow.t += dt;
      var a = Math.atan2(arrow.vy, arrow.vx);
      // It reaches the target's face: points by how close to the middle it lands.
      if (px < target.x && arrow.x >= target.x) {
        var hy = py + (arrow.y - py) * ((target.x - px) / (arrow.x - px)), dy = hy - ty;
        if (Math.abs(dy) <= TR) {
          var points = Math.max(2, 10 - 2 * Math.floor(Math.abs(dy) / (TR / 5)));
          score += points;
          stuck.push({ on: true, dy: dy, a: a });
          land(points === 10 ? 'Bullseye!' : '+' + points, target.x - 30, ty - TR - 18);
          return;
        }
      }
      if (arrow.y >= GROUND + 6) { stuck.push({ on: false, x: arrow.x, a: a }); land('Miss', Math.min(W - 50, arrow.x), GROUND - 40); return }
      if (arrow.x > W + 80 || arrow.t > 4) land('Miss', W - 70, 120);
    }

    function drawArrow(x, y, a, buried) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-58, 0); ctx.lineTo(buried ? 0 : -8, 0); ctx.stroke();
      if (!buried) {
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-10, -6); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = C.rim; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-55, -8); ctx.lineTo(-63, -8); ctx.lineTo(-55, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-55, 8); ctx.lineTo(-63, 8); ctx.lineTo(-55, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    function drawBow(v) {
      var pull = 6 + v.p * 26;
      // The stand the bow rests on.
      ctx.fillStyle = C.saffronDeep; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.fillRect(BX - 5, BY + 18, 10, GROUND - BY - 18); ctx.strokeRect(BX - 5, BY + 18, 10, GROUND - BY - 18);
      ctx.fillStyle = C.ink; ctx.fillRect(BX - 22, GROUND - 6, 44, 6);
      ctx.save(); ctx.translate(BX, BY); ctx.rotate(v.a);
      // The string, pulled back to the nock.
      var tipX = -58 + 58 * Math.cos(0.9), tipY = 58 * Math.sin(0.9);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tipX, -tipY); ctx.lineTo(tipX - (mode === 'ready' ? pull : 0), 0); ctx.lineTo(tipX, tipY); ctx.stroke();
      // The bow itself.
      ctx.lineCap = 'round';
      ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(-58, 0, 58, -0.9, 0.9); ctx.stroke();
      ctx.strokeStyle = C.saffronDeep; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-58, 0, 58, -0.9, 0.9); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.fillRect(-4, -9, 8, 18);
      ctx.restore();
      // The next arrow, on the string.
      if (mode === 'ready' && left > 0) {
        var back = tipX - pull + 62;
        drawArrow(BX + Math.cos(v.a) * back, BY + Math.sin(v.a) * back, v.a, false);
      }
    }
    function drawTarget(x, y) {
      var rings = [C.paper, C.ink, C.poolDeep, C.rim, C.saffron], i;
      for (i = 0; i < 5; i++) { circ(x, y, TR * (1 - i * 0.2)); ctx.fillStyle = rings[i]; ctx.fill() }
      ctx.strokeStyle = C.paper; ctx.lineWidth = 1.2;
      for (i = 2; i < 5; i++) { circ(x, y, TR * (1 - i * 0.2)); ctx.stroke() }
      circ(x, y, TR); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke();
    }

    function draw() {
      var i, v = velocity(), ty = targetY();
      ctx.fillStyle = C.pool; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.saffron; circ(206, 84, 34); ctx.fill();
      k.cloud(300, 70, 0.9); k.cloud(430, 118, 0.7);
      // Hills, then the field.
      ctx.fillStyle = C.lemon;
      ctx.beginPath(); ctx.moveTo(0, GROUND);
      ctx.quadraticCurveTo(110, 286, 250, GROUND - 22); ctx.quadraticCurveTo(400, 300, W, GROUND - 30);
      ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.leaf; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = C.ink; ctx.fillRect(0, GROUND - 1.5, W, 3);
      ctx.globalAlpha = 0.35; ctx.fillStyle = C.leafDeep;
      for (i = 0; i < 14; i++) ctx.fillRect(22 + i * 44, GROUND + 22 + (i % 3) * 14, 16, 3);
      ctx.globalAlpha = 1;

      // The target on its post.
      ctx.fillStyle = C.ink;
      ctx.fillRect(target.x - 4, POST_TOP, 8, GROUND - POST_TOP);
      ctx.fillRect(target.x - 26, GROUND - 6, 52, 6);
      ctx.fillRect(target.x - 9, POST_TOP - 6, 18, 6);
      drawTarget(target.x, ty);
      for (i = 0; i < stuck.length; i++) if (stuck[i].on) drawArrow(target.x + 3, ty + stuck[i].dy, stuck[i].a, true);

      // Arrows that missed, stuck in the grass.
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, GROUND + 1); ctx.clip();
      for (i = 0; i < stuck.length; i++) if (!stuck[i].on) drawArrow(stuck[i].x, GROUND + 6, stuck[i].a, false);
      ctx.restore();

      // Where the arrow sets off to, while aiming: only the start, so the distance is still yours to judge.
      if (aiming()) {
        var x0 = BX + Math.cos(v.a) * 40, y0 = BY + Math.sin(v.a) * 40;
        ctx.fillStyle = C.ink;
        for (i = 1; i <= 9; i++) {
          var t = i * 0.03, x = x0 + v.x * t, y = y0 + v.y * t + 0.5 * G * t * t;
          ctx.globalAlpha = 0.8 - i * 0.07; circ(x, y, 3.2 - i * 0.15); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      drawBow(mode === 'ready' && (drag || hover || keyAim) ? v : { a: -0.05, p: 0, x: 0, y: 0 });
      if (arrow) drawArrow(arrow.x, arrow.y, Math.atan2(arrow.vy, arrow.vx), false);

      // Arrows left this round.
      for (i = 0; i < ARROWS; i++) {
        ctx.globalAlpha = i < left ? 1 : 0.22;
        drawArrow(28 + i * 15, 78, Math.PI / 2, false);
      }
      ctx.globalAlpha = 1;
      if (shots === 0 && mode === 'ready' && !drag && !hover && !keyAim) {
        ctx.setLineDash([4, 5]); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
        circ(BX, BY, 72); ctx.stroke(); ctx.setLineDash([]);
      }

      for (i = 0; i < pops.length; i++) {
        ctx.globalAlpha = Math.min(1, pops[i].t * 1.6);
        k.text(pops[i].text, pops[i].x, pops[i].y - (1 - pops[i].t) * 26, pops[i].text === 'Bullseye!' ? 30 : 32);
      }
      ctx.globalAlpha = 1;

      if (mode === 'over') {
        var how = lastInput === 'key' ? 'Press Space' : lastInput === 'touch' || !k.fine() ? 'Tap' : 'Click';
        k.card([score + (score === 1 ? ' point' : ' points'), how + ' to shoot another round'], 200);
      }
    }

    k.loop(function (dt, now) {
      var n, i;
      target.phase += dt * target.speed;
      if (target.slide < 1) {
        target.slide = Math.min(1, target.slide + dt * 2.2);
        var e = 1 - Math.pow(1 - target.slide, 3);
        target.x = target.from + (target.to - target.from) * e;
      }
      if (mode === 'flying' && dt > 0) {
        n = Math.ceil(dt / (1 / 240));
        for (i = 0; i < n && mode === 'flying'; i++) step(dt / n);
      }
      if (mode === 'landed' && now >= nextAt) {
        if (left > 0) { mode = 'ready'; nextTarget(false) }
        else {
          mode = 'over';
          if (score > best) { best = score; k.save(KEY, best) }
          show();
        }
      }
      for (i = pops.length - 1; i >= 0; i--) { pops[i].t -= dt * 1.1; if (pops[i].t <= 0) pops.splice(i, 1) }
      draw();
      return mode === 'flying' || mode === 'landed' || target.amp > 0 && mode !== 'over' || target.slide < 1 || pops.length > 0 || !!drag;
    });

    k.on(canvas, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      lastInput = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      if (mode === 'over') { e.preventDefault(); newRound(); k.wake(); return }
      if (mode !== 'ready' || target.slide < 1) return;
      e.preventDefault();
      if (e.pointerType === 'mouse') { hover = k.pos(e); keyAim = false; loose(); return }
      var p = k.pos(e);
      drag = { x0: p.x, y0: p.y, x: p.x, y: p.y }; keyAim = false;
      try { canvas.setPointerCapture(e.pointerId) } catch (err) {}
      k.wake();
    });
    k.on(canvas, 'pointermove', function (e) {
      if (drag) { var p = k.pos(e); drag.x = p.x; drag.y = p.y; k.wake(); return }
      if (e.pointerType === 'mouse') { hover = k.pos(e); keyAim = false; k.wake() }
    });
    k.on(canvas, 'pointerleave', function (e) {
      if (e.pointerType === 'mouse' && hover) { hover = null; k.wake() }
    });
    k.on(canvas, 'pointerup', function () {
      if (!drag) return;
      var d = drag;
      if (Math.abs(d.x - d.x0) + Math.abs(d.y - d.y0) > 14 && mode === 'ready') loose();
      drag = null; k.wake();
    });
    k.on(canvas, 'pointercancel', function () { drag = null; k.wake() });

    k.keys(function (key) {
      if (key === ' ' || key === 'Enter') {
        lastInput = 'key';
        if (mode === 'over') { newRound(); k.wake() }
        else if (mode === 'ready' && target.slide >= 1) { keyAim = true; loose() }
        return true;
      }
      if (key === 'ArrowUp') kb.angle = Math.min(60, kb.angle + 2);
      else if (key === 'ArrowDown') kb.angle = Math.max(-30, kb.angle - 2);
      else if (key === 'ArrowRight') kb.power = Math.min(1, kb.power + 0.03);
      else if (key === 'ArrowLeft') kb.power = Math.max(0, kb.power - 0.03);
      else return false;
      lastInput = 'key'; keyAim = true; k.wake();
      return true;
    });
    k.on(canvas, 'focus', function () {
      try { if (canvas.matches(':focus-visible')) { keyAim = true; k.wake() } } catch (e) {}
    });
    k.on(canvas, 'blur', function () { keyAim = false; k.wake() });

    newRound(); draw();
    k.fontReady(draw);
    return k.stop;
  };
})();

/* A tiny car race: weave through the traffic for as long as you can while the road gets faster.
   With a mouse or a finger the car steers towards you; with a keyboard the up and down arrows steer.
   Needs kit.js. */
(function () {
  'use strict';
  var games = (window.chideraGames = window.chideraGames || {});

  games.racing = function (canvas, ui) {
    var W = 600, H = 450, k = games.kit(canvas, ui, W, H), ctx = k.ctx, C = k.C;
    var TOP = 86, BOTTOM = 364, LANES = 4, LANE = (BOTTOM - TOP) / LANES, CAR_X = 112, CAR_W = 64, CAR_H = 32;
    var ROAD = '#4A5A4F', KEY = 'chidera-racing-best';
    var PAINT = [C.blush, C.iris, C.pool, C.leaf, C.paper, C.lemon];

    var car = { y: TOP + LANE * 2.5, to: TOP + LANE * 2.5, vy: 0, spin: 0 };
    var traffic = [], scenery = [], mode = 'ready', speed = 0, scroll = 0, untilWave = 0, openLane = 2, lastInput = '';
    var keys = { up: false, down: false }, crashT = 0;
    var best = parseInt(k.load(KEY, 0), 10) || 0;

    function metres() { return Math.floor(scroll / 8) }
    function show() { k.score([['Distance', metres() + ' m'], ['Best', best + ' m']]) }
    function how() { return lastInput === 'key' ? 'Press Space' : lastInput === 'touch' || !k.fine() ? 'Tap' : 'Click' }
    function rand(a, b) { return a + Math.random() * (b - a) }
    function laneY(l) { return TOP + LANE * (l + 0.5) }
    function clampY(y) { return Math.max(TOP + CAR_H / 2 + 6, Math.min(BOTTOM - CAR_H / 2 - 6, y)) }

    // Trees and bushes along both sides of the road.
    for (var i = 0; i < 14; i++) {
      scenery.push({ x: i * 48 + rand(0, 30), y: i % 2 ? rand(14, TOP - 22) : rand(BOTTOM + 22, H - 14), r: rand(9, 17), tree: Math.random() < 0.6 });
    }

    function reset() {
      traffic = []; scroll = 0; speed = 250; untilWave = 260; openLane = 2;
      car.y = car.to = laneY(2); car.vy = 0; car.spin = 0;
      show();
    }
    function start(input) {
      lastInput = input;
      if (mode === 'ready' || mode === 'crashed') { reset(); mode = 'race'; k.wake(); return }
      if (mode === 'paused') { mode = 'race'; k.wake() }
    }
    function pause() { if (mode === 'race') { mode = 'paused'; keys.up = keys.down = false; k.wake() } }

    // Traffic comes in rows. Each row leaves a lane open within a lane of the last row's open lane,
    // so there's always a way through.
    function wave() {
      var lanes = [0, 1, 2, 3], open = Math.max(0, Math.min(LANES - 1, openLane + Math.floor(rand(-1, 2)))), blocked = [];
      lanes.forEach(function (l) { if (l !== open && Math.random() < 0.42) blocked.push(l) });
      if (!blocked.length) blocked.push(open === 0 ? 1 + Math.floor(rand(0, 3)) : Math.floor(rand(0, open)));
      blocked.forEach(function (l) {
        var truck = Math.random() < 0.22;
        traffic.push({ x: W + 70 + rand(0, 40), y: laneY(l), w: truck ? 104 : 62, h: truck ? 36 : 30, truck: truck, paint: PAINT[Math.floor(rand(0, PAINT.length))] });
      });
      openLane = open;
    }

    function step(dt) {
      // Steering: towards the pointer or finger, or with the keys.
      if (keys.up || keys.down) car.to = clampY(car.y + (keys.down ? 1 : -1) * 40);
      var d = car.to - car.y, max = (keys.up || keys.down ? 380 : 560) * dt, before = car.y;
      car.y = clampY(Math.abs(d) <= max ? car.to : car.y + (d > 0 ? max : -max));
      car.vy = dt > 0 ? (car.y - before) / dt : 0;

      speed = Math.min(640, speed + dt * 9);
      var move = speed * dt;
      scroll += move;
      untilWave -= move;
      if (untilWave <= 0) { wave(); untilWave = speed * rand(0.78, 1.05) + 90 }

      // Everything else drives a little slower than you, so it slides back past.
      for (var i = traffic.length - 1; i >= 0; i--) {
        var t = traffic[i];
        t.x -= move * 0.72;
        if (t.x < -140) { traffic.splice(i, 1); continue }
        if (Math.abs(t.x - CAR_X) < (t.w + CAR_W) / 2 - 6 && Math.abs(t.y - car.y) < (t.h + CAR_H) / 2 - 5) { crash(); return }
      }
      scenery.forEach(function (s) { s.x -= move; if (s.x < -30) { s.x += W + 60; s.r = rand(9, 17); s.tree = Math.random() < 0.6 } });
      show();
    }
    function crash() {
      mode = 'crashed'; crashT = 0; keys.up = keys.down = false;
      if (metres() > best) { best = metres(); k.save(KEY, best) }
      show();
    }

    function drawCar(x, y, w, h, paint, truck, angle, player) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = C.shadow; k.rrect(-w / 2 + 3, -h / 2 + 5, w, h, 8); ctx.fill();
      ctx.fillStyle = C.ink;
      [[-w * 0.3, -h / 2 - 2], [w * 0.28, -h / 2 - 2], [-w * 0.3, h / 2 - 4], [w * 0.28, h / 2 - 4]].forEach(function (p) { ctx.fillRect(p[0] - 7, p[1], 14, 6) });
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
      if (truck) {
        ctx.fillStyle = C.paper; k.rrect(-w / 2, -h / 2, w * 0.7, h, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = paint; k.rrect(w * 0.22, -h / 2 + 2, w * 0.28, h - 4, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.pool; ctx.fillRect(w * 0.36, -h / 2 + 6, 8, h - 12);
      } else {
        ctx.fillStyle = paint; k.rrect(-w / 2, -h / 2, w, h, 9); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.pool; k.rrect(w * 0.08, -h / 2 + 5, w * 0.16, h - 10, 3); ctx.fill();
        ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(20, 34, 24, 0.12)'; k.rrect(-w * 0.26, -h / 2 + 6, w * 0.32, h - 12, 3); ctx.fill();
        if (player) {
          // Racing stripes, a number and a spoiler.
          ctx.fillStyle = C.ink; ctx.fillRect(-w / 2 + 4, -3, w - 10, 2); ctx.fillRect(-w / 2 + 4, 1.5, w - 10, 2);
          ctx.fillRect(-w / 2 - 5, -h / 2 + 1, 6, h - 2);
          ctx.fillStyle = C.paper; k.circ(-w * 0.1, 0, 7); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
          ctx.font = '700 10px system-ui, -apple-system, sans-serif'; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('7', -w * 0.1, 0.5); ctx.textBaseline = 'alphabetic';
        }
      }
      ctx.restore();
    }

    function draw() {
      var i, off = scroll % 64;
      // Grass and the things beside the road.
      ctx.fillStyle = C.leaf; ctx.fillRect(0, 0, W, H);
      scenery.forEach(function (s) {
        if (s.tree) {
          ctx.fillStyle = C.shadow; k.circ(s.x + 4, s.y + 5, s.r); ctx.fill();
          ctx.fillStyle = C.leafDeep; k.circ(s.x, s.y, s.r); ctx.fill();
          ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
        } else {
          ctx.fillStyle = C.saffron; k.circ(s.x, s.y, 4); ctx.fill(); k.circ(s.x + 9, s.y + 5, 3.5); ctx.fill();
        }
      });
      // The road, its kerbs and lanes.
      ctx.fillStyle = ROAD; ctx.fillRect(0, TOP, W, BOTTOM - TOP);
      for (i = -1; i < W / 32 + 2; i++) {
        ctx.fillStyle = i % 2 ? C.rim : C.paper;
        ctx.fillRect(i * 32 - off, TOP - 8, 32, 8); ctx.fillRect(i * 32 - off, BOTTOM, 32, 8);
      }
      ctx.fillStyle = C.ink; ctx.fillRect(0, TOP - 9.5, W, 1.5); ctx.fillRect(0, BOTTOM + 8, W, 1.5);
      ctx.fillStyle = C.paper;
      for (var l = 1; l < LANES; l++) for (i = -1; i < W / 64 + 2; i++) ctx.fillRect(i * 64 - off, TOP + l * LANE - 1.5, 34, 3);

      // A starting line until the race begins.
      if (mode === 'ready') {
        var sq = (BOTTOM - TOP) / 18;
        for (i = 0; i < 18; i++) {
          ctx.fillStyle = i % 2 ? C.ink : C.paper; ctx.fillRect(CAR_X + 40, TOP + i * sq, 10, sq);
          ctx.fillStyle = i % 2 ? C.paper : C.ink; ctx.fillRect(CAR_X + 50, TOP + i * sq, 10, sq);
        }
      }

      for (i = 0; i < traffic.length; i++) { var t = traffic[i]; drawCar(t.x, t.y, t.w, t.h, t.paint, t.truck, 0, false) }
      var tilt = mode === 'crashed' ? crashT * 7 : Math.max(-0.28, Math.min(0.28, car.vy * 0.0007));
      drawCar(CAR_X, car.y, CAR_W, CAR_H, C.saffron, false, tilt, true);

      if (mode === 'race' || mode === 'paused') {
        ctx.fillStyle = 'rgba(250, 250, 245, 0.92)'; k.rrect(W - 132, 14, 118, 50, 10); ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
        k.text(metres() + ' m', W - 73, 49, 28);
      }
      if (mode === 'ready') k.card(['Weave through the traffic', how() + ' to start'], H / 2 + 6);
      if (mode === 'paused') k.card(['Paused', how() + ' to carry on'], H / 2);
      if (mode === 'crashed' && crashT > 0.45) {
        k.card(['Crash! ' + metres() + ' m', how() + ' to race again'], H / 2);
      }
    }

    k.loop(function (dt) {
      if (mode === 'race') {
        var n = Math.max(1, Math.ceil(dt / (1 / 120)));
        for (var i = 0; i < n && mode === 'race'; i++) step(dt / n);
      } else if (mode === 'crashed' && crashT < 0.6) crashT += dt;
      draw();
      return mode === 'race' || (mode === 'crashed' && crashT < 0.6);
    });

    function follow(e) { car.to = clampY(k.pos(e).y); keys.up = keys.down = false }
    k.on(canvas, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      var wasRacing = mode === 'race';
      if (mode === 'crashed' && crashT < 0.45) return;
      start(e.pointerType === 'mouse' ? 'mouse' : 'touch');
      if (wasRacing || e.pointerType !== 'mouse') follow(e);
      if (e.pointerType !== 'mouse') { try { canvas.setPointerCapture(e.pointerId) } catch (err) {} }
    });
    k.on(canvas, 'pointermove', function (e) {
      if (mode !== 'race') return;
      if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) follow(e);
    });

    k.keys(function (key) {
      if (key === ' ' || key === 'Enter') { if (!(mode === 'crashed' && crashT < 0.45)) start('key'); return true }
      if (key === 'ArrowUp' || key === 'w' || key === 'W') { keys.up = true; keys.down = false }
      else if (key === 'ArrowDown' || key === 's' || key === 'S') { keys.down = true; keys.up = false }
      else return false;
      if (lastInput !== 'key') { lastInput = 'key'; k.wake() }
      return true;
    }, function (key) {
      if (!key || key === 'ArrowUp' || key === 'w' || key === 'W') keys.up = false;
      if (!key || key === 'ArrowDown' || key === 's' || key === 'S') keys.down = false;
      if (!keys.up && !keys.down) car.to = car.y;
    });
    k.onPause(pause);

    reset(); draw();
    k.fontReady(draw);
    return k.stop;
  };
})();

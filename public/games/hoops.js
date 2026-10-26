/* Basketball. With a mouse: point where to throw and click; the dotted arc shows where the ball will go.
   On a touch screen: pull back anywhere on the court and let go. With a keyboard: the arrows aim and Space shoots.
   Needs kit.js. */
(function () {
  'use strict';
  var games = (window.chideraGames = window.chideraGames || {});

  games.hoops = function (canvas, ui) {
    var W = 600, H = 450, k = games.kit(canvas, ui, W, H), ctx = k.ctx, C = k.C, circ = k.circ;
    var FLOOR = 384, R = 16, G = 1500, K = 5.4, AIM = 3.2, MAXV = 1180;
    var RIM_X = 486, RIM_Y = 178, RIM_RX = 32, RIM_RY = 7, FRONT = RIM_X - RIM_RX, BACK = RIM_X + RIM_RX;
    var BOARD = { x: 522, y: 94, w: 30, h: 110 };
    var KEY = 'chidera-hoops-best';
    var colours = { sky: C.pool, floor: C.saffron, boards: C.saffronDeep, sun: C.saffron };

    var ball = { x: 150, y: FLOOR - R, vx: 0, vy: 0, rot: 0 };
    var mode = 'ready', drag = null, hover = null, keyAim = false, kb = { angle: 60, power: 0.55 };
    var scored = false, shotT = 0, resetAt = 0, swish = 0, shots = 0, streak = 0;
    var best = parseInt(k.load(KEY, 0), 10) || 0;

    function show() { k.score([['In a row', streak], ['Best', best]]) }
    function place() {
      ball.x = 70 + Math.random() * 270; ball.y = FLOOR - R; ball.vx = 0; ball.vy = 0;
      scored = false; mode = 'ready';
    }

    // Touch: pulling back sends the ball the other way. Mouse: the ball goes towards the pointer.
    // Either way, the further you go, the harder the throw.
    function velocity() {
      var vx, vy;
      if (drag) { vx = (drag.x0 - drag.x) * K; vy = (drag.y0 - drag.y) * K }
      else if (hover && !keyAim) { vx = (hover.x - ball.x) * AIM; vy = (hover.y - ball.y) * AIM }
      else { var a = kb.angle * Math.PI / 180, s = 480 + kb.power * 680; vx = Math.cos(a) * s; vy = -Math.sin(a) * s }
      var m = Math.sqrt(vx * vx + vy * vy);
      if (m > MAXV) { vx *= MAXV / m; vy *= MAXV / m; m = MAXV }
      return { x: vx, y: vy, m: m };
    }
    function shoot(v) {
      ball.vx = v.x; ball.vy = v.y; mode = 'flying'; scored = false; shotT = 0; shots++;
      k.wake();
    }
    function end() {
      mode = 'done';
      if (!scored) { streak = 0; show() }
      resetAt = performance.now() + 650;
    }

    // Bounce off a point (the rim's two edges, or the nearest point of the backboard).
    function hit(px, py, pr, bounce) {
      var dx = ball.x - px, dy = ball.y - py, d = Math.sqrt(dx * dx + dy * dy), min = R + pr, nx, ny;
      if (d >= min) return;
      if (d < 0.001) { nx = -1; ny = 0 } else { nx = dx / d; ny = dy / d }
      ball.x = px + nx * min; ball.y = py + ny * min;
      var vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= (1 + bounce) * vn * nx; ball.vy -= (1 + bounce) * vn * ny;
        ball.vx *= 0.97; ball.vy *= 0.97;
      }
    }
    function step(dt) {
      var px = ball.x, py = ball.y;
      ball.vy += G * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.rot += ball.vx * dt / R;
      hit(FRONT, RIM_Y, 3, 0.5); hit(BACK, RIM_Y, 3, 0.5);
      hit(Math.max(BOARD.x, Math.min(ball.x, BOARD.x + BOARD.w)), Math.max(BOARD.y, Math.min(ball.y, BOARD.y + BOARD.h)), 0, 0.55);

      // A basket: the ball's centre drops through the hoop from above.
      if (!scored && py < RIM_Y && ball.y >= RIM_Y && ball.vy > 0) {
        var t = (RIM_Y - py) / (ball.y - py), cx = px + (ball.x - px) * t;
        if (cx > FRONT + 4 && cx < BACK - 4) {
          scored = true; swish = 1; streak++;
          if (streak > best) { best = streak; k.save(KEY, best) }
          show();
        }
      }

      if (ball.y > FLOOR - R) {
        ball.y = FLOOR - R;
        if (ball.vy > 0) { ball.vy = ball.vy < 90 ? 0 : -ball.vy * 0.55; ball.vx *= 0.88 }
      }
      if (ball.y >= FLOOR - R - 0.5 && ball.vy === 0) ball.vx *= 1 - 3 * dt;
      shotT += dt;
      var resting = ball.y >= FLOOR - R - 0.5 && ball.vy === 0 && Math.abs(ball.vx) < 25;
      if (resting || ball.x > W + 2 * R || ball.x < -2 * R || shotT > 6) end();
    }

    function drawBall(x, y, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      circ(0, 0, R); ctx.fillStyle = C.ball; ctx.fill();
      ctx.save(); circ(0, 0, R); ctx.clip();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.stroke();
      ctx.beginPath(); ctx.arc(-R * 1.35, 0, R, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(R * 1.35, 0, R, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
      ctx.restore();
      circ(0, 0, R); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.restore();
    }
    function drawNet() {
      var drop = 46 + swish * 12, half = 20 - swish * 4, n = 6, top = [], bot = [], i, a;
      for (i = 0; i <= n; i++) {
        a = Math.PI - (Math.PI * i) / n;
        top.push([RIM_X + Math.cos(a) * RIM_RX, RIM_Y + Math.sin(a) * RIM_RY]);
        bot.push([RIM_X - half + (2 * half * i) / n, RIM_Y + drop]);
      }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath();
      for (i = 0; i < n; i++) {
        ctx.moveTo(top[i][0], top[i][1]); ctx.lineTo(bot[i + 1][0], bot[i + 1][1]);
        ctx.moveTo(top[i + 1][0], top[i + 1][1]); ctx.lineTo(bot[i][0], bot[i][1]);
      }
      ctx.moveTo(top[0][0], top[0][1]); ctx.lineTo(bot[0][0], bot[0][1]);
      ctx.moveTo(top[n][0], top[n][1]); ctx.lineTo(bot[n][0], bot[n][1]);
      ctx.moveTo(bot[0][0], bot[0][1]); ctx.lineTo(bot[n][0], bot[n][1]);
      ctx.stroke();
    }

    function draw() {
      var i;
      ctx.fillStyle = colours.sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = colours.sun; circ(96, 92, 38); ctx.fill();
      k.cloud(214, 80, 1); k.cloud(322, 142, 0.7);

      // Court floor.
      ctx.fillStyle = colours.floor; ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.globalAlpha = 0.45; ctx.fillStyle = colours.boards;
      ctx.fillRect(0, FLOOR + 24, W, 2); ctx.fillRect(0, FLOOR + 48, W, 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.ink; ctx.fillRect(0, FLOOR - 1.5, W, 3);

      // Pole, arm and base.
      ctx.fillStyle = C.ink;
      ctx.fillRect(562, 148, 12, FLOOR - 148);
      ctx.fillRect(BOARD.x + BOARD.w - 4, 140, 574 - (BOARD.x + BOARD.w - 4), 10);
      ctx.fillRect(546, FLOOR - 12, 44, 12);

      // Backboard and the back of the rim.
      ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h); ctx.strokeRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
      ctx.strokeStyle = C.rim; ctx.lineWidth = 2.5; ctx.strokeRect(BOARD.x + 7, BOARD.y + 50, BOARD.w - 14, 30);
      ctx.fillStyle = C.ink; ctx.fillRect(BACK - 2, RIM_Y - 3, BOARD.x - BACK + 4, 6);
      ctx.strokeStyle = C.rim; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(RIM_X, RIM_Y, RIM_RX, RIM_RY, 0, Math.PI, Math.PI * 2); ctx.stroke();

      // Where the ball will go, while aiming.
      if (mode === 'ready' && (drag || hover || keyAim)) {
        var v = velocity();
        if (v.m > 60) {
          ctx.fillStyle = C.ink;
          for (i = 1; i <= 20; i++) {
            var t = i * 0.04, x = ball.x + v.x * t, y = ball.y + v.y * t + 0.5 * G * t * t;
            if (y > FLOOR) break;
            ctx.globalAlpha = 0.85 - i * 0.035; circ(x, y, 3.6 - i * 0.1); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }

      // The ball and its shadow.
      var lift = Math.max(0, FLOOR - R - ball.y);
      ctx.fillStyle = C.shadow;
      ctx.beginPath(); ctx.ellipse(ball.x, FLOOR + 6, Math.max(6, R * (1 - Math.min(0.7, lift / 300))), 4, 0, 0, Math.PI * 2); ctx.fill();
      if (mode === 'ready' && shots === 0 && !drag && !hover) {
        ctx.setLineDash([4, 5]); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
        circ(ball.x, ball.y, R + 9); ctx.stroke(); ctx.setLineDash([]);
      }
      drawBall(ball.x, ball.y, ball.rot);

      // The net and the front of the rim go over the ball, so it drops through.
      drawNet();
      ctx.strokeStyle = C.rim; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(RIM_X, RIM_Y, RIM_RX, RIM_RY, 0, 0, Math.PI); ctx.stroke();

      if (swish > 0) {
        ctx.globalAlpha = Math.min(1, swish * 1.5);
        k.text('+1', RIM_X - 64, RIM_Y - 30 - (1 - swish) * 28, 32);
        ctx.globalAlpha = 1;
      }
    }

    k.loop(function (dt, now) {
      var n, i;
      if (mode === 'flying' && dt > 0) {
        n = Math.ceil(dt / (1 / 240));
        for (i = 0; i < n && mode === 'flying'; i++) step(dt / n);
      }
      if (mode === 'done' && now >= resetAt) place();
      swish = Math.max(0, swish - dt * 1.4);
      draw();
      return mode !== 'ready' || swish > 0 || !!drag;
    });

    k.on(canvas, 'pointerdown', function (e) {
      if (mode !== 'ready') return;
      e.preventDefault();
      if (e.pointerType === 'mouse') {
        // A mouse aims at the pointer, and a click throws.
        if (e.button !== 0) return;
        hover = k.pos(e); keyAim = false; shoot(velocity());
        return;
      }
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
      var v = velocity(), d = drag; drag = null;
      if (Math.abs(d.x - d.x0) + Math.abs(d.y - d.y0) > 14) shoot(v); else k.wake();
    });
    k.on(canvas, 'pointercancel', function () { drag = null; k.wake() });

    k.keys(function (key) {
      if (key === 'ArrowUp') kb.angle = Math.min(80, kb.angle + 2);
      else if (key === 'ArrowDown') kb.angle = Math.max(20, kb.angle - 2);
      else if (key === 'ArrowRight') kb.power = Math.min(1, kb.power + 0.03);
      else if (key === 'ArrowLeft') kb.power = Math.max(0, kb.power - 0.03);
      else if (key === ' ' || key === 'Enter') { if (mode === 'ready') { keyAim = true; shoot(velocity()) } return true }
      else return false;
      keyAim = true; k.wake();
      return true;
    });
    k.on(canvas, 'focus', function () {
      try { if (canvas.matches(':focus-visible')) { keyAim = true; k.wake() } } catch (e) {}
    });
    k.on(canvas, 'blur', function () { keyAim = false; k.wake() });

    show(); draw();
    k.fontReady(draw);
    return k.stop;
  };
})();

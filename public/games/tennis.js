/* Tennis against the computer, first to five points. Where the ball meets your racket sets where it goes:
   hit it with the edge to send it wide. With a mouse or a finger your player follows you up and down the court;
   with a keyboard the up and down arrows move them. Needs kit.js. */
(function () {
  'use strict';
  var games = (window.chideraGames = window.chideraGames || {});

  games.tennis = function (canvas, ui) {
    var W = 600, H = 450, k = games.kit(canvas, ui, W, H), ctx = k.ctx, C = k.C, circ = k.circ;
    var X0 = 50, X1 = 550, Y0 = 72, Y1 = 378, MID = (Y0 + Y1) / 2, NET = 300, BR = 7, REACH = 36, TO = 5;
    var YOU_X = 64, CPU_X = 536, YOU_HIT = YOU_X + 22, CPU_HIT = CPU_X - 22;
    var KEY = 'chidera-tennis-wins', BALL = '#DCEB5B';

    var you = { y: MID, to: MID, vy: 0, swing: 0 }, cpu = { y: MID, to: MID, vy: 0, swing: 0, err: 0 };
    var ball = null, mode = 'ready', server = 'you', serveAt = 0, hits = 0, points = { you: 0, cpu: 0 };
    var message = null, keys = { up: false, down: false }, lastInput = '';
    var wins = parseInt(k.load(KEY, 0), 10) || 0;

    function show() { k.score([['You', points.you], ['Computer', points.cpu], ['Wins', wins]]) }
    function rand(a, b) { return a + Math.random() * (b - a) }
    function clampY(y) { return Math.max(Y0 + 22, Math.min(Y1 - 22, y)) }
    function how() { return lastInput === 'key' ? 'Press Space' : lastInput === 'touch' || !k.fine() ? 'Tap' : 'Click' }

    // The ball flies in a straight line to where the other player stands, bouncing once on the way.
    function send(fromX, fromY, toX, toY, by) {
      var speed = Math.min(660, 290 + hits * 24), dx = toX - fromX, dy = toY - fromY, d = Math.sqrt(dx * dx + dy * dy);
      ball = { x: fromX, y: fromY, vx: dx / d * speed, vy: dy / d * speed, run: 0, len: d, by: by };
      if (by === 'you') { cpu.err = Math.random() < 0.08 + hits * 0.012 ? rand(40, 54) * (Math.random() < 0.5 ? -1 : 1) : rand(-22, 22) }
    }
    function serve() {
      hits = 0; message = null; mode = 'play';
      if (server === 'you') send(YOU_HIT, you.y, CPU_HIT, rand(Y0 + 40, Y1 - 40), 'you');
      else send(CPU_HIT, cpu.y, YOU_HIT, rand(Y0 + 40, Y1 - 40), 'cpu');
      (server === 'you' ? you : cpu).swing = 1;
    }
    function point(winner) {
      points[winner]++;
      ball = null; server = server === 'you' ? 'cpu' : 'you';
      if (points[winner] >= TO) {
        mode = 'over';
        if (winner === 'you') { wins++; k.save(KEY, wins) }
      } else {
        mode = 'between'; serveAt = performance.now() + 1100;
        message = winner === 'you' ? 'Your point' : 'Computer’s point';
      }
      show();
    }
    function newMatch() {
      points = { you: 0, cpu: 0 }; server = 'you'; you.y = you.to = MID; cpu.y = cpu.to = MID;
      mode = 'between'; serveAt = performance.now() + 700; message = null; ball = null;
      show(); k.wake();
    }
    function pause() { if (mode === 'play' || mode === 'between') { mode = 'paused'; k.wake() } }
    function carryOn() { mode = ball ? 'play' : 'between'; serveAt = performance.now() + 700; k.wake() }

    function move(p, speed, dt) {
      var d = p.to - p.y, step = speed * dt, before = p.y;
      p.y = clampY(Math.abs(d) <= step ? p.to : p.y + (d > 0 ? step : -step));
      p.vy = dt > 0 ? (p.y - before) / dt : 0;
      p.swing = Math.max(0, p.swing - dt * 4);
    }

    function step(dt) {
      // You: towards the pointer or finger, or with the keys.
      if (keys.up || keys.down) you.to = clampY(you.y + (keys.down ? 1 : -1) * 60);
      move(you, keys.up || keys.down ? 420 : 1100, dt);
      // The computer: heads for where the ball will arrive once it has crossed the net, give or take.
      if (ball && ball.vx > 0 && ball.x > 210) cpu.to = clampY(ball.y + ball.vy / ball.vx * (CPU_HIT - ball.x) + cpu.err);
      else if (!ball || ball.vx < 0) cpu.to = MID + (ball ? (ball.y - MID) * 0.3 : 0);
      move(cpu, 250 + Math.min(90, hits * 8), dt);

      if (mode !== 'play' || !ball) return;
      var px = ball.x;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.run += Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * dt;
      if (ball.y < Y0 + BR || ball.y > Y1 - BR) { ball.vy = -ball.vy; ball.y = Math.max(Y0 + BR, Math.min(Y1 - BR, ball.y)) }

      if (ball.vx < 0 && px >= YOU_HIT && ball.x < YOU_HIT) {
        var off = (ball.y - you.y) / REACH;
        if (Math.abs(off) <= 1) {
          hits++; you.swing = 1;
          send(YOU_HIT, ball.y, CPU_HIT, Math.max(Y0 + 24, Math.min(Y1 - 24, MID + off * 150 + you.vy * 0.12)), 'you');
          return;
        }
      }
      if (ball.vx > 0 && px <= CPU_HIT && ball.x > CPU_HIT) {
        var o = (ball.y - cpu.y) / REACH;
        if (Math.abs(o) <= 1) {
          hits++; cpu.swing = 1;
          send(CPU_HIT, ball.y, YOU_HIT, Math.max(Y0 + 24, Math.min(Y1 - 24, MID + o * 140 + rand(-40, 40))), 'cpu');
          return;
        }
      }
      if (ball.x < 8) point('cpu');
      else if (ball.x > W - 8) point('you');
    }

    // The ball's height above the court, for the drawing only: up from the racket, a bounce past the net, up again.
    function height(b) {
      var f = b.run / b.len, bounce = 0.66;
      if (f < bounce) return (1 - f / bounce) * 16 + 46 * Math.sin(Math.PI * f / bounce);
      return 30 * Math.abs(Math.sin(Math.PI * (f - bounce) / 0.72));
    }

    function drawPlayer(x, y, facing, shirt, swing) {
      // Seen from above: shoulders, head, and the racket held out towards the net.
      ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(x + 4, y + 6, 17, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = shirt; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      circ(0, 0, 7.5); ctx.fillStyle = C.ink; ctx.fill();
      ctx.rotate(facing * swing * 0.7);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(facing * 8, 6); ctx.lineTo(facing * 18, 8); ctx.stroke();
      ctx.fillStyle = C.paper; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(facing * 22, 0, 6.5, 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 0.8; ctx.beginPath();
      for (var i = -12; i <= 12; i += 6) { ctx.moveTo(facing * 22 - 5, i); ctx.lineTo(facing * 22 + 5, i) }
      ctx.moveTo(facing * 22, -17); ctx.lineTo(facing * 22, 17); ctx.stroke();
      ctx.restore();
    }

    function draw() {
      var i;
      ctx.fillStyle = C.leaf; ctx.fillRect(0, 0, W, H);
      // The court and its lines.
      ctx.fillStyle = C.poolDeep; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
      ctx.strokeStyle = C.paper; ctx.lineWidth = 3;
      ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
      ctx.beginPath();
      ctx.moveTo(X0, Y0 + 36); ctx.lineTo(X1, Y0 + 36); ctx.moveTo(X0, Y1 - 36); ctx.lineTo(X1, Y1 - 36);
      ctx.moveTo(NET - 130, Y0 + 36); ctx.lineTo(NET - 130, Y1 - 36); ctx.moveTo(NET + 130, Y0 + 36); ctx.lineTo(NET + 130, Y1 - 36);
      ctx.moveTo(NET - 130, MID); ctx.lineTo(NET + 130, MID);
      ctx.moveTo(X0, MID); ctx.lineTo(X0 + 10, MID); ctx.moveTo(X1, MID); ctx.lineTo(X1 - 10, MID);
      ctx.stroke();
      // The net, with its shadow and posts.
      ctx.fillStyle = 'rgba(20, 34, 24, 0.22)'; ctx.fillRect(NET + 2, Y0 - 14, 8, Y1 - Y0 + 28);
      ctx.fillStyle = C.paper; ctx.fillRect(NET - 3, Y0 - 14, 6, Y1 - Y0 + 28);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.strokeRect(NET - 3, Y0 - 14, 6, Y1 - Y0 + 28);
      ctx.fillStyle = C.ink; circ(NET, Y0 - 16, 5); ctx.fill(); circ(NET, Y1 + 16, 5); ctx.fill();

      // The score on each side.
      ctx.font = '600 15px system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.fillStyle = C.ink;
      ctx.textAlign = 'right'; ctx.fillText('You', 136, 46);
      ctx.textAlign = 'left'; ctx.fillText('Computer', 464, 46);
      k.text(String(points.you), 158, 50, 34, C.ink, 'left');
      k.text(String(points.cpu), 442, 50, 34, C.ink, 'right');

      drawPlayer(YOU_X, you.y, 1, C.saffron, you.swing);
      drawPlayer(CPU_X, cpu.y, -1, C.blush, cpu.swing);

      if (ball) {
        var z = height(ball);
        ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(ball.x + z * 0.25, ball.y + 3, BR, BR * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        circ(ball.x, ball.y - z, BR); ctx.fillStyle = BALL; ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.strokeStyle = C.paper; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(ball.x - BR * 0.9, ball.y - z, BR * 0.75, -0.9, 0.9); ctx.stroke();
      } else if (mode === 'between' || mode === 'ready') {
        // The server holds the ball.
        var sx = server === 'you' ? YOU_HIT : CPU_HIT, sy = server === 'you' ? you.y - 26 : cpu.y - 26;
        circ(sx, sy, BR); ctx.fillStyle = BALL; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.stroke();
      }

      if (message) k.card([message], H / 2);
      if (mode === 'ready') k.card(['First to five', how() + ' to start'], H / 2);
      if (mode === 'paused') k.card(['Paused', how() + ' to carry on'], H / 2);
      if (mode === 'over') {
        var won = points.you > points.cpu;
        k.card([(won ? 'You win ' : 'Computer wins ') + Math.max(points.you, points.cpu) + '–' + Math.min(points.you, points.cpu), how() + ' to play again'], H / 2);
      }
    }

    k.loop(function (dt, now) {
      var n, i;
      if (mode === 'play' || mode === 'between') {
        n = Math.max(1, Math.ceil(dt / (1 / 240)));
        for (i = 0; i < n; i++) step(dt / n);
        if (mode === 'between' && now >= serveAt) serve();
      }
      draw();
      return mode === 'play' || mode === 'between';
    });

    function start(input) {
      lastInput = input;
      if (mode === 'ready' || mode === 'over') { newMatch(); return true }
      if (mode === 'paused') { carryOn(); return true }
      return false;
    }
    function follow(e) {
      var p = k.pos(e);
      you.to = clampY(p.y); keys.up = keys.down = false;
    }
    k.on(canvas, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      start(e.pointerType === 'mouse' ? 'mouse' : 'touch');
      follow(e);
      if (e.pointerType !== 'mouse') { try { canvas.setPointerCapture(e.pointerId) } catch (err) {} }
    });
    k.on(canvas, 'pointermove', function (e) {
      if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) follow(e);
    });

    k.keys(function (key) {
      if (key === ' ' || key === 'Enter') { start('key'); return true }
      if (key === 'ArrowUp' || key === 'w' || key === 'W') { keys.up = true; keys.down = false }
      else if (key === 'ArrowDown' || key === 's' || key === 'S') { keys.down = true; keys.up = false }
      else return false;
      if (lastInput !== 'key') { lastInput = 'key'; k.wake() }
      return true;
    }, function (key) {
      if (!key || key === 'ArrowUp' || key === 'w' || key === 'W') keys.up = false;
      if (!key || key === 'ArrowDown' || key === 's' || key === 'S') keys.down = false;
      if (!keys.up && !keys.down) you.to = you.y;
    });
    k.onPause(pause);

    show(); draw();
    k.fontReady(draw);
    return k.stop;
  };
})();

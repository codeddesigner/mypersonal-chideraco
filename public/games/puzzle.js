/* A sliding picture puzzle: put the eight tiles back in order to finish the picture.
   Click or tap a tile next to the gap (or in line with it) to slide it; with a keyboard the arrows slide a tile
   into the gap. Each new puzzle is a different picture. Needs kit.js. */
(function () {
  'use strict';
  var games = (window.chideraGames = window.chideraGames || {});

  games.puzzle = function (canvas, ui) {
    var W = 600, H = 450, k = games.kit(canvas, ui, W, H), ctx = k.ctx, C = k.C;
    var N = 3, S = 348, T = S / N, BX = 34, BY = 51, PX = 412, PY = 51, PS = 152, KEY = 'chidera-puzzle-best';
    var NEW = { x: PX, y: 351, w: PS, h: 48 };

    var tiles = [], shown = [], moves = 0, picture = -1, solved = false, done = 0, hoverTile = -1, lastInput = '';
    var best = parseInt(k.load(KEY, 0), 10) || 0;
    var art = document.createElement('canvas'), scale = 2;
    art.width = S * scale; art.height = S * scale;
    var a = art.getContext('2d');

    function show() { k.score([['Moves', moves], ['Best', best || '–']]) }
    function how() { return lastInput === 'key' ? 'Press Space' : lastInput === 'touch' || !k.fine() ? 'Tap' : 'Click' }

    /* The pictures, drawn in the puzzle's own 348 x 348 units. */
    function circle(x, y, r, fill) { a.beginPath(); a.arc(x, y, r, 0, Math.PI * 2); a.fillStyle = fill; a.fill() }
    function cloud(x, y, s) {
      circle(x, y, 13 * s, C.paper); circle(x + 20 * s, y - 9 * s, 18 * s, C.paper); circle(x + 42 * s, y, 13 * s, C.paper);
      a.fillRect(x, y - 3 * s, 42 * s, 16 * s);
    }
    var pictures = [
      function hills() {
        a.fillStyle = C.pool; a.fillRect(0, 0, S, S);
        circle(258, 92, 44, C.saffron); cloud(40, 70, 1); cloud(170, 128, 0.8);
        a.fillStyle = C.lemon; a.beginPath(); a.moveTo(0, 230); a.quadraticCurveTo(120, 150, 240, 215); a.quadraticCurveTo(300, 190, S, 205); a.lineTo(S, S); a.lineTo(0, S); a.fill();
        a.fillStyle = C.leaf; a.beginPath(); a.moveTo(0, 270); a.quadraticCurveTo(170, 214, S, 262); a.lineTo(S, S); a.lineTo(0, S); a.fill();
        a.fillStyle = C.paper; a.beginPath(); a.moveTo(150, S); a.quadraticCurveTo(170, 300, 120, 268); a.lineTo(132, 266); a.quadraticCurveTo(196, 300, 186, S); a.fill();
        // A house and a tree.
        a.fillStyle = C.blush; a.fillRect(64, 214, 66, 50);
        a.fillStyle = C.rim; a.beginPath(); a.moveTo(56, 216); a.lineTo(97, 180); a.lineTo(138, 216); a.fill();
        a.fillStyle = C.ink; a.fillRect(90, 236, 14, 28); a.fillStyle = C.saffron; a.fillRect(70, 226, 13, 13); a.fillRect(110, 226, 13, 13);
        a.fillStyle = C.ink; a.fillRect(262, 196, 8, 56);
        circle(266, 182, 30, C.leafDeep); circle(248, 200, 20, C.leafDeep); circle(286, 200, 20, C.leafDeep);
      },
      function sea() {
        a.fillStyle = C.blush; a.fillRect(0, 0, S, S);
        a.fillStyle = C.saffron; a.beginPath(); a.arc(110, 200, 62, Math.PI, 0); a.fill();
        a.fillStyle = C.poolDeep; a.fillRect(0, 200, S, S - 200);
        a.strokeStyle = C.pool; a.lineWidth = 4; a.lineCap = 'round';
        for (var r = 0; r < 4; r++) {
          a.beginPath();
          for (var x = 10 + (r % 2) * 30; x < S; x += 64) { a.moveTo(x, 236 + r * 30); a.quadraticCurveTo(x + 12, 228 + r * 30, x + 24, 236 + r * 30) }
          a.stroke();
        }
        // A sailing boat and three birds.
        a.fillStyle = C.rim; a.beginPath(); a.moveTo(190, 222); a.lineTo(296, 222); a.lineTo(280, 246); a.lineTo(206, 246); a.fill();
        a.fillStyle = C.ink; a.fillRect(240, 110, 5, 112);
        a.fillStyle = C.paper; a.beginPath(); a.moveTo(246, 112); a.lineTo(246, 214); a.lineTo(300, 214); a.fill();
        a.fillStyle = C.iris; a.beginPath(); a.moveTo(238, 132); a.lineTo(238, 214); a.lineTo(198, 214); a.fill();
        a.strokeStyle = C.ink; a.lineWidth = 3;
        [[60, 80], [96, 60], [292, 70]].forEach(function (b) {
          a.beginPath(); a.moveTo(b[0] - 12, b[1]); a.quadraticCurveTo(b[0] - 6, b[1] - 8, b[0], b[1]); a.quadraticCurveTo(b[0] + 6, b[1] - 8, b[0] + 12, b[1]); a.stroke();
        });
      },
      function court() {
        a.fillStyle = C.pool; a.fillRect(0, 0, S, S);
        circle(70, 74, 36, C.saffron); cloud(150, 60, 0.9);
        a.fillStyle = C.saffron; a.fillRect(0, 272, S, S - 272);
        a.fillStyle = C.saffronDeep; a.fillRect(0, 296, S, 2); a.fillRect(0, 320, S, 2);
        a.fillStyle = C.ink; a.fillRect(0, 270, S, 3);
        a.fillRect(300, 110, 10, 162); a.fillRect(286, 262, 40, 10);
        a.fillStyle = C.paper; a.strokeStyle = C.ink; a.lineWidth = 3; a.fillRect(268, 70, 26, 96); a.strokeRect(268, 70, 26, 96);
        a.strokeStyle = C.rim; a.lineWidth = 4; a.beginPath(); a.ellipse(238, 140, 28, 6, 0, 0, Math.PI * 2); a.stroke();
        a.strokeStyle = C.ink; a.lineWidth = 1.5; a.beginPath();
        for (var i = 0; i <= 4; i++) { a.moveTo(212 + i * 13, 142); a.lineTo(222 + i * 8, 182) }
        a.moveTo(220, 182); a.lineTo(256, 182); a.stroke();
        // The ball, on its way.
        circle(150, 120, 22, C.ball); a.strokeStyle = C.ink; a.lineWidth = 2.5; a.beginPath(); a.arc(150, 120, 22, 0, Math.PI * 2); a.stroke();
        a.lineWidth = 2; a.beginPath(); a.moveTo(128, 120); a.lineTo(172, 120); a.moveTo(150, 98); a.lineTo(150, 142); a.stroke();
        a.setLineDash([3, 7]); a.beginPath(); a.moveTo(60, 250); a.quadraticCurveTo(90, 120, 126, 116); a.stroke(); a.setLineDash([]);
      },
    ];
    function paint(i) {
      a.setTransform(scale, 0, 0, scale, 0, 0);
      a.clearRect(0, 0, S, S);
      pictures[i]();
    }

    /* The puzzle: tiles[cell] is the tile in that cell, 8 is the gap. */
    function gap() { return tiles.indexOf(N * N - 1) }
    function isSolved() { for (var i = 0; i < tiles.length; i++) if (tiles[i] !== i) return false; return true }
    function newPuzzle() {
      var i, last = -1;
      picture = (picture + 1) % pictures.length; paint(picture);
      tiles = []; for (i = 0; i < N * N; i++) tiles.push(i);
      // Shuffle by sliding tiles at random from the finished picture, so it can always be solved.
      do {
        for (i = 0; i < 80; i++) {
          var g = gap(), options = neighbours(g).filter(function (c) { return c !== last });
          var c = options[Math.floor(Math.random() * options.length)];
          tiles[g] = tiles[c]; tiles[c] = N * N - 1; last = g;
        }
      } while (isSolved());
      shown = []; for (i = 0; i < N * N; i++) shown[tiles[i]] = cellXY(i);
      moves = 0; solved = false; done = 0; show();
    }
    function neighbours(cell) {
      var r = Math.floor(cell / N), c = cell % N, out = [];
      if (r > 0) out.push(cell - N); if (r < N - 1) out.push(cell + N);
      if (c > 0) out.push(cell - 1); if (c < N - 1) out.push(cell + 1);
      return out;
    }
    function cellXY(cell) { return { x: (cell % N) * T, y: Math.floor(cell / N) * T } }

    // Slide the tiles between this cell and the gap (in the same row or column) one step towards the gap.
    function slide(cell) {
      if (solved || cell < 0) return false;
      var g = gap(), gr = Math.floor(g / N), gc = g % N, r = Math.floor(cell / N), c = cell % N, stepBy;
      if (cell === g || (r !== gr && c !== gc)) return false;
      stepBy = r === gr ? (c < gc ? -1 : 1) : (r < gr ? -N : N);
      while (g !== cell) { tiles[g] = tiles[g + stepBy]; tiles[g + stepBy] = N * N - 1; g += stepBy; moves++ }
      show();
      if (isSolved()) {
        solved = true;
        if (!best || moves < best) { best = moves; k.save(KEY, best); show() }
      }
      k.wake();
      return true;
    }
    function cellAt(p) {
      var x = p.x - BX, y = p.y - BY;
      if (x < 0 || y < 0 || x >= S || y >= S) return -1;
      return Math.floor(y / T) * N + Math.floor(x / T);
    }
    function movable(cell) {
      if (cell < 0 || solved) return false;
      var g = gap();
      return cell !== g && (Math.floor(cell / N) === Math.floor(g / N) || cell % N === g % N);
    }
    function onNew(p) { return p.x >= NEW.x && p.x <= NEW.x + NEW.w && p.y >= NEW.y && p.y <= NEW.y + NEW.h }

    function draw() {
      var i, id, pos, label;
      ctx.fillStyle = C.lemon; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.ink; k.rrect(BX - 6, BY - 6, S + 12, S + 12, 10); ctx.fill();
      for (id = 0; id < N * N; id++) {
        pos = shown[id];
        if (!pos) continue;
        if (id === N * N - 1) {
          if (!solved) continue;
          ctx.globalAlpha = Math.min(1, done * 2.5);
        }
        ctx.drawImage(art, (id % N) * T * scale, Math.floor(id / N) * T * scale, T * scale, T * scale, BX + pos.x + 2, BY + pos.y + 2, T - 4, T - 4);
        ctx.globalAlpha = 1;
        if (!solved) {
          ctx.fillStyle = C.paper; k.circ(BX + pos.x + 17, BY + pos.y + 17, 11); ctx.fill();
          ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.font = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.fillStyle = C.ink;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(id + 1), BX + pos.x + 17, BY + pos.y + 17.5);
          ctx.textBaseline = 'alphabetic';
          if (hoverTile === id) { ctx.strokeStyle = C.paper; ctx.lineWidth = 3; ctx.strokeRect(BX + pos.x + 4, BY + pos.y + 4, T - 8, T - 8) }
        }
      }

      // Once it's solved, the picture without the joins.
      if (solved && done > 0) { ctx.globalAlpha = done; ctx.drawImage(art, 0, 0, S * scale, S * scale, BX, BY, S, S); ctx.globalAlpha = 1 }

      // The finished picture, small, and a button for a new one.
      ctx.fillStyle = C.ink; k.rrect(PX - 3, PY - 3, PS + 6, PS + 6, 6); ctx.fill();
      ctx.drawImage(art, 0, 0, S * scale, S * scale, PX, PY, PS, PS);
      ctx.font = '15px system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.fillStyle = C.ink; ctx.textAlign = 'left';
      ctx.fillText('The finished picture', PX, PY + PS + 26);
      label = moves === 1 ? 'move' : 'moves';
      k.text(String(moves), PX, PY + PS + 86, 44, C.ink, 'left');
      var numberWidth = ctx.measureText(String(moves)).width;
      ctx.font = '15px system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.fillStyle = C.ink; ctx.textAlign = 'left';
      ctx.fillText(label, PX + numberWidth + 10, PY + PS + 86);
      ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      k.rrect(NEW.x, NEW.y, NEW.w, NEW.h, 24); ctx.fill(); ctx.stroke();
      ctx.font = '600 16px system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.fillStyle = C.ink; ctx.textAlign = 'center';
      ctx.textBaseline = 'middle'; ctx.fillText('New picture', NEW.x + NEW.w / 2, NEW.y + NEW.h / 2 + 1); ctx.textBaseline = 'alphabetic';

      if (solved && done >= 0.5) k.card(['Solved in ' + moves + (moves === 1 ? ' move' : ' moves'), how() + ' for a new picture'], BY + S / 2, BX + S / 2);
    }

    k.loop(function (dt) {
      var id, moving = false;
      for (id = 0; id < N * N; id++) {
        var cell = tiles.indexOf(id), to = cellXY(cell), p = shown[id];
        var dx = to.x - p.x, dy = to.y - p.y, d = Math.sqrt(dx * dx + dy * dy), s = 1300 * dt;
        if (d <= s || dt === 0 && d < 1) { p.x = to.x; p.y = to.y } else { p.x += dx / d * s; p.y += dy / d * s; moving = true }
      }
      if (solved && !moving) done = Math.min(1, done + dt * 1.6);
      draw();
      return moving || (solved && done < 1);
    });

    k.on(canvas, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      lastInput = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      var p = k.pos(e);
      e.preventDefault();
      if (onNew(p) || (solved && done >= 0.5)) { newPuzzle(); k.wake(); return }
      slide(cellAt(p));
    });
    k.on(canvas, 'pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var p = k.pos(e), cell = cellAt(p), id = movable(cell) ? tiles[cell] : -1;
      canvas.style.cursor = id >= 0 || onNew(p) || (solved && done >= 0.5) ? 'pointer' : 'default';
      if (id !== hoverTile) { hoverTile = id; k.wake() }
    });
    k.on(canvas, 'pointerleave', function () { if (hoverTile !== -1) { hoverTile = -1; k.wake() } });

    // Arrow keys move the tile beside the gap into it: Left moves the tile on the gap's right, and so on.
    k.keys(function (key) {
      var g = gap(), r = Math.floor(g / N), c = g % N;
      if (key === ' ' || key === 'Enter') { lastInput = 'key'; if (solved) { newPuzzle(); k.wake() } return true }
      if (key === 'n' || key === 'N') { lastInput = 'key'; newPuzzle(); k.wake(); return true }
      var cell = key === 'ArrowLeft' ? (c < N - 1 ? g + 1 : -1)
        : key === 'ArrowRight' ? (c > 0 ? g - 1 : -1)
        : key === 'ArrowUp' ? (r < N - 1 ? g + N : -1)
        : key === 'ArrowDown' ? (r > 0 ? g - N : -1) : null;
      if (cell === null) return false;
      lastInput = 'key';
      slide(cell);
      return true;
    });

    newPuzzle(); draw();
    k.fontReady(draw);
    return function () { canvas.style.cursor = ''; k.stop() };
  };
})();

/* Tetris — 7-bag randomizer, hold, ghost piece, wall kicks. */
GameHub.register({
  id: 'tetris',
  name: 'Tetris',
  emoji: '🧱',
  category: 'Puzzle',
  desc: 'Stack, clear, survive. Hold piece and ghost included.',
  controls: '<kbd>←</kbd><kbd>→</kbd> move · <kbd>↑</kbd>/<kbd>X</kbd> rotate · <kbd>↓</kbd> soft drop · ' +
            '<kbd>Space</kbd> hard drop · <kbd>C</kbd> hold · <kbd>P</kbd> pause',

  mount: function (api) {
    var COLS = 10, ROWS = 20, CELL = 26;
    var BW = COLS * CELL, PANEL = 132;
    var W = BW + PANEL, H = ROWS * CELL;
    var cv = api.canvas(W, H, { maxWidth: 440 });
    var ctx = cv.ctx;
    var U = GameHub.util;

    /* Each piece as its own square matrix so rotation is a matrix transpose. */
    var SHAPES = {
      I: { color: '#22d3ee', cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
      J: { color: '#3b82f6', cells: [[1,0,0],[1,1,1],[0,0,0]] },
      L: { color: '#f97316', cells: [[0,0,1],[1,1,1],[0,0,0]] },
      O: { color: '#facc15', cells: [[1,1],[1,1]] },
      S: { color: '#4ade80', cells: [[0,1,1],[1,1,0],[0,0,0]] },
      T: { color: '#a78bfa', cells: [[0,1,0],[1,1,1],[0,0,0]] },
      Z: { color: '#f43f5e', cells: [[1,1,0],[0,1,1],[0,0,0]] }
    };
    var KEYS = Object.keys(SHAPES);

    var board, piece, nextQueue, bag, held, canHold;
    var score, lines, level, dropAcc, dropInterval, over, paused, clearFx;

    function newBag() { return U.shuffle(KEYS); }

    function pullPiece() {
      if (bag.length === 0) bag = newBag();
      return bag.pop();
    }

    function spawn(type) {
      var s = SHAPES[type];
      var p = {
        type: type,
        color: s.color,
        cells: s.cells.map(function (r) { return r.slice(); }),
        x: Math.floor((COLS - s.cells.length) / 2),
        y: type === 'I' ? -1 : 0
      };
      return p;
    }

    function reset() {
      board = U.grid(ROWS, COLS, null);
      bag = newBag();
      nextQueue = [pullPiece(), pullPiece(), pullPiece()];
      held = null;
      canHold = true;
      score = 0; lines = 0; level = 1;
      dropAcc = 0;
      dropInterval = 0.8;
      over = false; paused = false;
      clearFx = null;
      piece = spawn(nextQueue.shift());
      nextQueue.push(pullPiece());
      api.hud('Score', 0);
      api.hud('Lines', 0);
      api.hud('Level', 1);
      api.hud('Best', api.best());
    }

    function collides(p, dx, dy, cells) {
      cells = cells || p.cells;
      for (var r = 0; r < cells.length; r++) {
        for (var c = 0; c < cells[r].length; c++) {
          if (!cells[r][c]) continue;
          var x = p.x + c + dx, y = p.y + r + dy;
          if (x < 0 || x >= COLS || y >= ROWS) return true;
          if (y >= 0 && board[y][x]) return true;
        }
      }
      return false;
    }

    function rotate(cells, cw) {
      var n = cells.length;
      var out = U.grid(n, n, 0);
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (cw) out[c][n - 1 - r] = cells[r][c];
          else out[n - 1 - c][r] = cells[r][c];
        }
      }
      return out;
    }

    /* Try the rotation in place, then nudge sideways/up — a simplified kick
     * table that covers the cases players actually feel (wall and floor). */
    function tryRotate(cw) {
      if (over || paused || piece.type === 'O') return;
      var rotated = rotate(piece.cells, cw);
      var kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];
      for (var i = 0; i < kicks.length; i++) {
        if (!collides(piece, kicks[i][0], kicks[i][1], rotated)) {
          piece.cells = rotated;
          piece.x += kicks[i][0];
          piece.y += kicks[i][1];
          GameHub.sound.tone(430, 0.03, 'square', 0.022);
          return;
        }
      }
    }

    function move(dx) {
      if (over || paused) return;
      if (!collides(piece, dx, 0)) {
        piece.x += dx;
        GameHub.sound.tone(300, 0.02, 'square', 0.018);
      }
    }

    function softDrop() {
      if (over || paused) return;
      if (!collides(piece, 0, 1)) { piece.y++; score += 1; api.hud('Score', score); }
      else lock();
      dropAcc = 0;
    }

    function hardDrop() {
      if (over || paused) return;
      var d = 0;
      while (!collides(piece, 0, d + 1)) d++;
      piece.y += d;
      score += d * 2;
      GameHub.sound.tone(180, 0.07, 'square', 0.04);
      lock();
    }

    function hold() {
      if (over || paused || !canHold) return;
      var swap = held;
      held = piece.type;
      piece = swap ? spawn(swap) : spawn(nextQueue.shift());
      if (!swap) nextQueue.push(pullPiece());
      canHold = false;
      GameHub.sound.tone(620, 0.05, 'triangle', 0.03);
      if (collides(piece, 0, 0)) gameOver();
    }

    function lock() {
      for (var r = 0; r < piece.cells.length; r++) {
        for (var c = 0; c < piece.cells[r].length; c++) {
          if (!piece.cells[r][c]) continue;
          var y = piece.y + r, x = piece.x + c;
          if (y < 0) return gameOver();
          board[y][x] = piece.color;
        }
      }
      clearLines();
      canHold = true;
      piece = spawn(nextQueue.shift());
      nextQueue.push(pullPiece());
      if (collides(piece, 0, 0)) gameOver();
    }

    function clearLines() {
      var full = [];
      for (var r = 0; r < ROWS; r++) {
        if (board[r].every(function (c) { return c; })) full.push(r);
      }
      if (!full.length) return;

      full.forEach(function (r) { board.splice(r, 1); board.unshift(U.grid(1, COLS, null)[0]); });

      lines += full.length;
      var table = [0, 100, 300, 500, 800];
      score += table[full.length] * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(0.06, 0.8 * Math.pow(0.85, level - 1));
      clearFx = { rows: full, t: 1 };

      api.hud('Score', score);
      api.hud('Lines', lines);
      api.hud('Level', level);

      if (full.length === 4) GameHub.sound.seq([[523, 0], [659, .06], [880, .12], [1174, .18]], 'triangle');
      else GameHub.sound.seq([[600, 0], [820, .05]], 'triangle');
    }

    function gameOver() {
      over = true;
      api.gameOver({
        score: score,
        lines: ['Lines: ' + lines, 'Level: ' + level],
        buttons: [
          { label: 'Play again', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    function togglePause() {
      if (over) return;
      paused = !paused;
      if (paused) {
        api.overlay({
          emoji: '⏸️', title: 'Paused',
          buttons: [
            { label: 'Resume', primary: true, onClick: function () { paused = false; } },
            { label: 'Hub', onClick: api.exit }
          ]
        });
      } else api.closeOverlay();
    }

    /* --------------------------------------------------------------- draw */

    function block(x, y, color, alpha) {
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.fillStyle = color;
      U.roundRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(x + 3, y + 3, CELL - 6, 3);
      ctx.globalAlpha = 1;
    }

    function drawMini(cells, color, ox, oy, size) {
      var n = cells.length;
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (!cells[r][c]) continue;
          ctx.fillStyle = color;
          U.roundRect(ctx, ox + c * size, oy + r * size, size - 2, size - 2, 3);
          ctx.fill();
        }
      }
    }

    function draw() {
      ctx.fillStyle = '#070a15';
      ctx.fillRect(0, 0, W, H);

      /* Playfield grid. */
      ctx.strokeStyle = 'rgba(167,139,250,.07)';
      ctx.lineWidth = 1;
      for (var i = 1; i < COLS; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL + .5, 0); ctx.lineTo(i * CELL + .5, H); ctx.stroke();
      }
      for (var j = 1; j < ROWS; j++) {
        ctx.beginPath(); ctx.moveTo(0, j * CELL + .5); ctx.lineTo(BW, j * CELL + .5); ctx.stroke();
      }

      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          if (board[r][c]) block(c * CELL, r * CELL, board[r][c]);
        }
      }

      if (!over) {
        /* Ghost: where a hard drop would land. */
        var gd = 0;
        while (!collides(piece, 0, gd + 1)) gd++;
        drawPiece(piece, 0, gd, 0.22);
        drawPiece(piece, 0, 0, 1);
      }

      if (clearFx) {
        clearFx.t -= 0.06;
        if (clearFx.t <= 0) clearFx = null;
        else {
          ctx.fillStyle = 'rgba(255,255,255,' + clearFx.t * 0.5 + ')';
          clearFx.rows.forEach(function (r) { ctx.fillRect(0, r * CELL, BW, CELL); });
        }
      }

      /* Side panel. */
      ctx.fillStyle = '#0c1020';
      ctx.fillRect(BW, 0, PANEL, H);
      ctx.strokeStyle = '#2a3157';
      ctx.beginPath(); ctx.moveTo(BW + .5, 0); ctx.lineTo(BW + .5, H); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#97a0c8';
      ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('HOLD', BW + 16, 22);
      ctx.fillText('NEXT', BW + 16, 128);

      ctx.fillStyle = 'rgba(255,255,255,.04)';
      U.roundRect(ctx, BW + 14, 30, 100, 76, 8); ctx.fill();
      U.roundRect(ctx, BW + 14, 136, 100, 214, 8); ctx.fill();

      if (held) drawMini(SHAPES[held].cells, canHold ? SHAPES[held].color : '#4a5378', BW + 26, 44, 18);
      nextQueue.forEach(function (t, k) {
        drawMini(SHAPES[t].cells, SHAPES[t].color, BW + 26, 150 + k * 68, 18);
      });

      ctx.fillStyle = '#97a0c8';
      ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('LEVEL', BW + 16, H - 54);
      ctx.fillStyle = '#6ee7ff';
      ctx.font = '800 28px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(String(level), BW + 16, H - 24);
    }

    function drawPiece(p, dx, dy, alpha) {
      for (var r = 0; r < p.cells.length; r++) {
        for (var c = 0; c < p.cells[r].length; c++) {
          if (!p.cells[r][c]) continue;
          var y = p.y + r + dy;
          if (y < 0) continue;
          block((p.x + c + dx) * CELL, y * CELL, p.color, alpha);
        }
      }
    }

    /* ------------------------------------------------------------- input */

    api.hudInit(['Score', 'Lines', 'Level', 'Best']);
    reset();

    var repeat = { left: 0, right: 0, down: 0 };

    api.onKey(function (e) {
      var k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(k) >= 0) e.preventDefault();
      if (k === 'ArrowLeft' || k === 'a') { move(-1); repeat.left = -0.17; }
      else if (k === 'ArrowRight' || k === 'd') { move(1); repeat.right = -0.17; }
      else if (k === 'ArrowDown' || k === 's') { softDrop(); }
      else if (k === 'ArrowUp' || k === 'x' || k === 'X' || k === 'w') tryRotate(true);
      else if (k === 'z' || k === 'Z' || k === 'Control') tryRotate(false);
      else if (k === ' ') hardDrop();
      else if (k === 'c' || k === 'C' || k === 'Shift') hold();
      else if (k === 'p' || k === 'P') togglePause();
    });

    api.onSwipe(cv.el, function (d) {
      if (d === 'left') move(-1);
      else if (d === 'right') move(1);
      else if (d === 'down') hardDrop();
      else tryRotate(true);
    }, function () { tryRotate(true); });

    api.buttons([
      { label: '←', onClick: function () { move(-1); } },
      { label: '⟳', onClick: function () { tryRotate(true); } },
      { label: '→', onClick: function () { move(1); } },
      { label: '↓', onClick: softDrop },
      { label: '⤓', onClick: hardDrop },
      { label: 'Hold', onClick: hold }
    ], 'touch-only');

    api.loop(function (dt) {
      if (!over && !paused) {
        /* Auto-repeat for held movement keys after a short delay. */
        ['left', 'right', 'down'].forEach(function (name) {
          var pressed = name === 'left' ? (api.keys.ArrowLeft || api.keys.a)
            : name === 'right' ? (api.keys.ArrowRight || api.keys.d)
            : (api.keys.ArrowDown || api.keys.s);
          if (!pressed) { repeat[name] = 0; return; }
          repeat[name] += dt;
          if (repeat[name] >= 0.045) {
            repeat[name] = 0;
            if (name === 'left') move(-1);
            else if (name === 'right') move(1);
            else softDrop();
          }
        });

        dropAcc += dt;
        if (dropAcc >= dropInterval) {
          dropAcc = 0;
          if (!collides(piece, 0, 1)) piece.y++;
          else lock();
        }
      }
      draw();
    });
  }
});

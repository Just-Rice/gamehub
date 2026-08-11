/* Connect Four — alpha-beta CPU with a positional heuristic. */
GameHub.register({
  id: 'connect4',
  name: 'Connect Four',
  emoji: '🔴',
  category: 'Strategy',
  desc: 'Drop discs, make four in a row. The CPU searches ahead.',
  controls: 'Click a column · <kbd>1</kbd>–<kbd>7</kbd> drop · <kbd>←</kbd><kbd>→</kbd> aim, <kbd>Space</kbd> drop',
  scoreLabel: 'Wins',

  mount: function (api) {
    var COLS = 7, ROWS = 6, R = 32, CELL = 72, TOP = 62;
    var W = COLS * CELL, H = TOP + ROWS * CELL;
    var cv = api.canvas(W, H, { maxWidth: 520 });
    var ctx = cv.ctx;
    var U = GameHub.util;

    var HUMAN = 1, CPU = 2;
    var board, turn, over, winLine, aim, falling, mode, record;

    var bar = api.el('div', 'btn-bar');
    var modeBtns = {};
    [['easy', 'CPU: easy'], ['hard', 'CPU: hard'], ['2p', '2 players']]
      .forEach(function (m) {
        var b = api.el('button', 'gbtn', m[1]);
        b.type = 'button';
        api.on(b, 'click', function () {
          mode = m[0];
          GameHub.store.set('c4:mode', mode);
          syncBtns();
          reset();
        });
        modeBtns[m[0]] = b;
        bar.appendChild(b);
      });
    api.mount(bar);
    mode = GameHub.store.get('c4:mode', 'hard');

    function syncBtns() {
      Object.keys(modeBtns).forEach(function (k) {
        modeBtns[k].classList.toggle('on', k === mode);
      });
    }

    var msg = api.el('div', 'msg');
    api.mount(msg);

    record = GameHub.store.get('c4:record', { w: 0, l: 0, d: 0 });

    function reset() {
      board = U.grid(ROWS, COLS, 0);
      turn = HUMAN;
      over = false;
      winLine = null;
      falling = null;
      aim = 3;
      updateMsg();
      api.hud('W / L / D', record.w + ' / ' + record.l + ' / ' + record.d);
      api.hud('Wins', api.best());
      api.closeOverlay();
    }

    function updateMsg() {
      if (over) return;
      if (mode === '2p') {
        msg.innerHTML = turn === HUMAN
          ? '<strong>Red</strong> to move' : '<strong>Yellow</strong> to move';
      } else {
        msg.innerHTML = turn === HUMAN ? 'Your move (<strong>red</strong>)' : 'CPU thinking…';
      }
    }

    function dropRow(b, c) {
      for (var r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r;
      return -1;
    }

    function findWin(b, player) {
      var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          if (b[r][c] !== player) continue;
          for (var d = 0; d < dirs.length; d++) {
            var dr = dirs[d][0], dc = dirs[d][1];
            var line = [[r, c]];
            for (var k = 1; k < 4; k++) {
              var nr = r + dr * k, nc = c + dc * k;
              if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) break;
              if (b[nr][nc] !== player) break;
              line.push([nr, nc]);
            }
            if (line.length === 4) return line;
          }
        }
      }
      return null;
    }

    function isFull(b) { return b[0].every(function (c) { return c; }); }

    function drop(col) {
      if (over || falling) return;
      if (mode !== '2p' && turn !== HUMAN) return;
      place(col);
    }

    function place(col) {
      var row = dropRow(board, col);
      if (row < 0) return;

      var player = turn;
      /* Animate the disc down the column before it counts on the board. */
      falling = {
        col: col, row: row, player: player,
        y: TOP - CELL / 2, vy: 0
      };
      GameHub.sound.tone(400, 0.05, 'triangle', 0.03);
    }

    function settle(f) {
      board[f.row][f.col] = f.player;
      falling = null;
      GameHub.sound.tone(240, 0.07, 'square', 0.035);

      var line = findWin(board, f.player);
      if (line) return finish(f.player, line);
      if (isFull(board)) return finish(0, null);

      turn = f.player === HUMAN ? CPU : HUMAN;
      updateMsg();
      if (mode !== '2p' && turn === CPU) api.timeout(cpuMove, 220);
    }

    /* ------------------------------------------------------------- the AI */

    /* Score a 4-cell window: heavy weight on threats, negative on the
     * opponent's, so the search prefers building while blocking. */
    function scoreWindow(w, player) {
      var opp = player === CPU ? HUMAN : CPU;
      var me = 0, them = 0, empty = 0;
      for (var i = 0; i < 4; i++) {
        if (w[i] === player) me++;
        else if (w[i] === opp) them++;
        else empty++;
      }
      if (me && them) return 0;
      if (me === 4) return 10000;
      if (me === 3 && empty === 1) return 60;
      if (me === 2 && empty === 2) return 8;
      if (them === 4) return -10000;
      if (them === 3 && empty === 1) return -80;
      if (them === 2 && empty === 2) return -8;
      return 0;
    }

    function evaluate(b, player) {
      var score = 0;

      /* Centre control is worth real points in Connect Four. */
      for (var r = 0; r < ROWS; r++) {
        if (b[r][3] === player) score += 6;
        else if (b[r][3]) score -= 6;
      }

      var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          for (var d = 0; d < dirs.length; d++) {
            var dr = dirs[d][0], dc = dirs[d][1];
            var er = r + dr * 3, ec = c + dc * 3;
            if (er < 0 || ec < 0 || er >= ROWS || ec >= COLS) continue;
            var w = [];
            for (var k = 0; k < 4; k++) w.push(b[r + dr * k][c + dc * k]);
            score += scoreWindow(w, player);
          }
        }
      }
      return score;
    }

    function validCols(b) {
      /* Centre-first ordering makes alpha-beta prune far more. */
      return [3, 2, 4, 1, 5, 0, 6].filter(function (c) { return dropRow(b, c) >= 0; });
    }

    function negamax(b, depth, alpha, beta, player) {
      var opp = player === CPU ? HUMAN : CPU;
      if (findWin(b, opp)) return { score: -100000 - depth };
      var cols = validCols(b);
      if (!cols.length) return { score: 0 };
      if (depth === 0) return { score: evaluate(b, player) };

      var best = { score: -Infinity, col: cols[0] };
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        var r = dropRow(b, c);
        b[r][c] = player;
        var val = -negamax(b, depth - 1, -beta, -alpha, opp).score;
        b[r][c] = 0;

        if (val > best.score) { best.score = val; best.col = c; }
        if (best.score > alpha) alpha = best.score;
        if (alpha >= beta) break;
      }
      return best;
    }

    function cpuMove() {
      if (over) return;
      var cols = validCols(board);
      if (!cols.length) return;

      var col;
      if (mode === 'easy') {
        /* Easy still takes an immediate win or block — just doesn't plan. */
        col = immediate(CPU) ;
        if (col === null) col = immediate(HUMAN);
        if (col === null || Math.random() < 0.3) col = U.pick(cols);
      } else {
        col = negamax(board, 5, -Infinity, Infinity, CPU).col;
      }
      turn = CPU;
      place(col);
    }

    function immediate(player) {
      var cols = validCols(board);
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i], r = dropRow(board, c);
        board[r][c] = player;
        var win = findWin(board, player);
        board[r][c] = 0;
        if (win) return c;
      }
      return null;
    }

    /* -------------------------------------------------------------- end */

    function finish(player, line) {
      over = true;
      winLine = line;

      var title, emoji;
      if (!player) {
        title = 'Draw'; emoji = '🤝';
        record.d++;
        GameHub.sound.tone(280, 0.2, 'triangle', 0.03);
      } else if (mode === '2p') {
        title = (player === HUMAN ? 'Red' : 'Yellow') + ' wins';
        emoji = '🏆';
        GameHub.sound.win();
      } else if (player === HUMAN) {
        title = 'You win!'; emoji = '🏆';
        record.w++;
        api.submit(api.best() + 1);
        GameHub.sound.win();
      } else {
        title = 'CPU wins'; emoji = '🤖';
        record.l++;
        GameHub.sound.bad();
      }

      GameHub.store.set('c4:record', record);
      api.hud('W / L / D', record.w + ' / ' + record.l + ' / ' + record.d);
      api.hud('Wins', api.best());

      api.timeout(function () {
        api.overlay({
          emoji: emoji, title: title,
          lines: ['Record: ' + record.w + 'W · ' + record.l + 'L · ' + record.d + 'D'],
          buttons: [
            { label: 'Play again', primary: true, onClick: reset },
            { label: 'Hub', onClick: api.exit }
          ]
        });
      }, 700);
    }

    /* ------------------------------------------------------------- draw */

    function discColor(v) { return v === HUMAN ? '#f43f5e' : '#facc15'; }

    function draw(dt) {
      ctx.fillStyle = '#070a15';
      ctx.fillRect(0, 0, W, H);

      /* Hover / aim indicator above the board. */
      if (!over && !falling && (mode === '2p' || turn === HUMAN)) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = discColor(turn);
        ctx.beginPath();
        ctx.arc(aim * CELL + CELL / 2, TOP / 2, R - 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* A disc above the board is drawn plainly; once it enters the frame it
       * is clipped to the column's holes so it reads as falling behind it. */
      if (falling) {
        falling.vy += 2100 * dt;
        falling.y += falling.vy * dt;
        var target = TOP + falling.row * CELL + CELL / 2;
        if (falling.y >= target) falling.y = target;
        if (falling.y < TOP) {
          ctx.fillStyle = discColor(falling.player);
          ctx.beginPath();
          ctx.arc(falling.col * CELL + CELL / 2, falling.y, R, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* Board panel. */
      var panel = ctx.createLinearGradient(0, TOP, 0, H);
      panel.addColorStop(0, '#2f47ad');
      panel.addColorStop(1, '#1b2a6e');
      ctx.fillStyle = panel;
      ctx.fillRect(0, TOP, W, H - TOP);

      /* Holes: empty ones show the dark background, filled ones show a disc. */
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var cx = c * CELL + CELL / 2, cy = TOP + r * CELL + CELL / 2;
          var v = board[r][c];
          ctx.fillStyle = v ? discColor(v) : '#0a0f22';
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.fill();
          if (v) {
            ctx.fillStyle = 'rgba(255,255,255,.2)';
            ctx.beginPath();
            ctx.arc(cx - 7, cy - 8, R * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (falling && falling.y >= TOP) {
        ctx.save();
        ctx.beginPath();
        for (var hr = 0; hr < ROWS; hr++) {
          ctx.moveTo(falling.col * CELL + CELL / 2 + R, TOP + hr * CELL + CELL / 2);
          ctx.arc(falling.col * CELL + CELL / 2, TOP + hr * CELL + CELL / 2,
                  R, 0, Math.PI * 2);
        }
        ctx.clip();
        ctx.fillStyle = discColor(falling.player);
        ctx.beginPath();
        ctx.arc(falling.col * CELL + CELL / 2, falling.y, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (falling && falling.y >= TOP + falling.row * CELL + CELL / 2) {
        settle(falling);
      }

      if (winLine) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        var a = winLine[0], b = winLine[3];
        ctx.moveTo(a[1] * CELL + CELL / 2, TOP + a[0] * CELL + CELL / 2);
        ctx.lineTo(b[1] * CELL + CELL / 2, TOP + b[0] * CELL + CELL / 2);
        ctx.stroke();
      }
    }

    /* ------------------------------------------------------------ input */

    api.hudInit(['W / L / D', 'Wins']);
    syncBtns();
    reset();

    api.on(cv.el, 'mousemove', function (e) {
      var p = api.canvasPoint(cv, e);
      aim = U.clamp(Math.floor(p.x / CELL), 0, COLS - 1);
    });
    api.on(cv.el, 'pointerdown', function (e) {
      var p = api.canvasPoint(cv, e);
      drop(U.clamp(Math.floor(p.x / CELL), 0, COLS - 1));
    });

    api.onKey(function (e) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 7) return drop(n - 1);
      if (e.key === 'ArrowLeft') { e.preventDefault(); aim = Math.max(0, aim - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); aim = Math.min(COLS - 1, aim + 1); }
      if (e.key === ' ') { e.preventDefault(); drop(aim); }
    });

    api.loop(draw);
  }
});

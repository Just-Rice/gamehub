/* Minesweeper — flood reveal, flagging, three difficulties. */
GameHub.register({
  id: 'minesweeper',
  name: 'Minesweeper',
  emoji: '💣',
  category: 'Puzzle',
  desc: 'Clear the field without detonating. First click is always safe.',
  controls: 'Click to reveal · right-click (or long-press) to flag · click a number to chord · ' +
    '<kbd>Tab</kbd> to the board, arrows move, <kbd>Enter</kbd> reveals, <kbd>F</kbd> flags',
  scoreLabel: 'Wins',

  mount: function (api) {
    var U = GameHub.util;

    var LEVELS = {
      easy:   { rows: 9,  cols: 9,  mines: 10, size: 34 },
      medium: { rows: 12, cols: 12, mines: 24, size: 30 },
      hard:   { rows: 14, cols: 16, mines: 48, size: 26 }
    };
    var NUM_COLORS = ['', '#60a5fa', '#4ade80', '#f87171', '#a78bfa',
                      '#fb923c', '#22d3ee', '#e8ecff', '#94a3b8'];

    var level = GameHub.store.get('mines:level', 'easy');
    var cfg, grid, els, started, dead, cleared, flags, elapsed, revealed;

    var bar = api.el('div', 'btn-bar');
    var levelBtns = {};
    ['easy', 'medium', 'hard'].forEach(function (name) {
      var b = api.el('button', 'gbtn', name[0].toUpperCase() + name.slice(1));
      b.type = 'button';
      api.on(b, 'click', function () {
        level = name;
        GameHub.store.set('mines:level', name);
        syncLevelBtns();
        reset();
      });
      levelBtns[name] = b;
      bar.appendChild(b);
    });
    api.mount(bar);

    function syncLevelBtns() {
      Object.keys(levelBtns).forEach(function (k) {
        levelBtns[k].classList.toggle('on', k === level);
      });
    }

    var board = api.el('div', 'board');
    board.style.gap = '3px';
    api.mount(board);
    api.on(board, 'contextmenu', function (e) { e.preventDefault(); });

    var msg = api.el('div', 'msg');
    msg.setAttribute('aria-live', 'polite');
    api.mount(msg);

    function bestKey() { return 'mines:best:' + level; }

    function reset() {
      cfg = LEVELS[level];
      grid = U.grid(cfg.rows, cfg.cols, function () {
        return { mine: false, near: 0, open: false, flag: false };
      });
      started = false;
      dead = false;
      cleared = false;
      flags = 0;
      elapsed = 0;
      revealed = 0;

      board.style.gridTemplateColumns = 'repeat(' + cfg.cols + ', minmax(0, ' + cfg.size + 'px))';
      board.innerHTML = '';
      els = [];

      for (var r = 0; r < cfg.rows; r++) {
        els.push([]);
        for (var c = 0; c < cfg.cols; c++) {
          els[r].push(makeCell(r, c));
        }
      }

      var best = GameHub.store.get(bestKey(), null);
      msg.innerHTML = best === null
        ? 'Find all ' + cfg.mines + ' mines.'
        : 'Best ' + level + ' time: <strong>' + best + 's</strong>';
      /* Hard still fits a phone, but its cells shrink below a comfortable tap. */
      if (level === 'hard' && window.matchMedia('(max-width: 560px)').matches) {
        msg.innerHTML += '<br>Cells are tiny on a phone; Easy or Medium play better here.';
      }

      api.hud('Mines', cfg.mines);
      api.hud('Time', 0);
      api.hud('Wins', api.best());
      api.closeOverlay();
    }

    function makeCell(r, c) {
      var el = api.el('div', 'cell');
      el.style.fontSize = Math.round(cfg.size * 0.52) + 'px';
      el.style.borderRadius = '5px';
      /* One Tab stop for the whole board; arrow keys move between cells. */
      el.tabIndex = r === 0 && c === 0 ? 0 : -1;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1) + ', hidden');
      api.on(el, 'keydown', function (e) {
        var step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        if (step) {
          e.preventDefault();
          var nr = U.clamp(r + step[0], 0, cfg.rows - 1), nc = U.clamp(c + step[1], 0, cfg.cols - 1);
          el.tabIndex = -1;
          els[nr][nc].tabIndex = 0;
          els[nr][nc].focus();
        }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(r, c); }
        else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFlag(r, c); }
      });

      var pressTimer = null;
      api.on(el, 'pointerdown', function (e) {
        if (e.button === 2) return;
        /* Long-press flags on touch without blocking a normal tap. */
        pressTimer = setTimeout(function () {
          pressTimer = null;
          toggleFlag(r, c);
          if (navigator.vibrate) navigator.vibrate(18);
        }, 380);
      });
      api.on(el, 'pointerup', function (e) {
        if (e.button === 2) return;
        if (pressTimer === null) return;
        clearTimeout(pressTimer);
        pressTimer = null;
        click(r, c);
      });
      api.on(el, 'pointerleave', function () {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      });
      api.on(el, 'contextmenu', function (e) {
        e.preventDefault();
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        toggleFlag(r, c);
      });

      board.appendChild(el);
      return el;
    }

    /* Mines are placed after the first click so it can never lose instantly. */
    function layMines(sr, sc) {
      var spots = [];
      for (var r = 0; r < cfg.rows; r++) {
        for (var c = 0; c < cfg.cols; c++) {
          if (Math.abs(r - sr) <= 1 && Math.abs(c - sc) <= 1) continue;
          spots.push([r, c]);
        }
      }
      U.shuffle(spots).slice(0, cfg.mines).forEach(function (p) {
        grid[p[0]][p[1]].mine = true;
      });
      for (r = 0; r < cfg.rows; r++) {
        for (c = 0; c < cfg.cols; c++) {
          grid[r][c].near = neighbors(r, c).filter(function (n) {
            return grid[n[0]][n[1]].mine;
          }).length;
        }
      }
      started = true;
    }

    function neighbors(r, c) {
      var out = [];
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          var nr = r + dr, nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < cfg.rows && nc < cfg.cols) out.push([nr, nc]);
        }
      }
      return out;
    }

    function toggleFlag(r, c) {
      if (dead || cleared) return;
      var cell = grid[r][c];
      if (cell.open) return;
      cell.flag = !cell.flag;
      flags += cell.flag ? 1 : -1;
      api.hud('Mines', cfg.mines - flags);
      paint(r, c);
      GameHub.sound.tone(cell.flag ? 700 : 420, 0.04, 'triangle', 0.025);
    }

    function click(r, c) {
      if (dead || cleared) return;
      if (!started) layMines(r, c);

      var cell = grid[r][c];
      if (cell.flag) return;

      /* Clicking a satisfied number opens its remaining neighbours. */
      if (cell.open) {
        if (!cell.near) return;
        var flagged = neighbors(r, c).filter(function (n) { return grid[n[0]][n[1]].flag; });
        if (flagged.length !== cell.near) return;
        neighbors(r, c).forEach(function (n) {
          if (!grid[n[0]][n[1]].flag && !grid[n[0]][n[1]].open) open(n[0], n[1]);
        });
        checkWin();
        return;
      }

      open(r, c);
      checkWin();
    }

    /* Iterative flood fill — a recursive one blows the stack on big boards. */
    function open(r, c) {
      var stack = [[r, c]];
      while (stack.length) {
        var p = stack.pop();
        var cell = grid[p[0]][p[1]];
        if (cell.open || cell.flag) continue;

        cell.open = true;
        revealed++;
        paint(p[0], p[1]);

        if (cell.mine) return boom(p[0], p[1]);
        if (cell.near === 0) {
          neighbors(p[0], p[1]).forEach(function (n) {
            if (!grid[n[0]][n[1]].open) stack.push(n);
          });
        }
      }
      GameHub.sound.tone(520, 0.03, 'triangle', 0.02);
    }

    function boom(br, bc) {
      dead = true;
      GameHub.sound.bad();
      for (var r = 0; r < cfg.rows; r++) {
        for (var c = 0; c < cfg.cols; c++) {
          if (grid[r][c].mine) { grid[r][c].open = true; paint(r, c); }
        }
      }
      els[br][bc].style.background = '#7f1d3a';
      api.timeout(function () {
        api.overlay({
          emoji: '💥', title: 'Boom',
          lines: ['You hit a mine after ' + Math.floor(elapsed) + 's.'],
          buttons: [
            { label: 'New board', primary: true, onClick: reset },
            { label: 'Hub', onClick: api.exit }
          ]
        });
      }, 550);
    }

    function checkWin() {
      if (dead || cleared) return;
      var safe = cfg.rows * cfg.cols - cfg.mines;
      var opened = 0;
      for (var r = 0; r < cfg.rows; r++) {
        for (var c = 0; c < cfg.cols; c++) if (grid[r][c].open) opened++;
      }
      if (opened < safe) return;

      cleared = true;
      var time = Math.floor(elapsed);
      var prev = GameHub.store.get(bestKey(), null);
      var record = prev === null || time < prev;
      if (record) GameHub.store.set(bestKey(), time);

      api.submit(api.best() + 1);
      api.hud('Wins', api.best());
      GameHub.sound.win();

      var lines = ['Time: ' + time + 's', 'Difficulty: ' + level];
      lines.push(record ? '★ New best time!' : 'Best: ' + prev + 's');

      api.overlay({
        emoji: '🚩', title: 'Field cleared!',
        lines: lines,
        buttons: [
          { label: 'New board', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    function paint(r, c) {
      var cell = grid[r][c], el = els[r][c];
      el.classList.toggle('filled', cell.open);
      el.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1) + ', ' +
        (!cell.open ? (cell.flag ? 'flagged' : 'hidden')
          : cell.mine ? 'mine' : cell.near ? cell.near + ' adjacent' : 'empty'));

      if (!cell.open) {
        el.textContent = cell.flag ? '🚩' : '';
        el.style.background = '';
        el.style.color = '';
        return;
      }
      if (cell.mine) {
        el.textContent = '💣';
        el.style.background = '#3a1e2c';
        return;
      }
      el.style.background = 'rgba(255,255,255,.045)';
      el.textContent = cell.near ? String(cell.near) : '';
      el.style.color = NUM_COLORS[cell.near];
    }

    api.hudInit(['Mines', 'Time', 'Wins']);
    syncLevelBtns();
    reset();

    api.loop(function (dt) {
      if (started && !dead && !cleared) {
        elapsed += dt;
        api.hud('Time', Math.floor(elapsed));
      }
    });
  }
});

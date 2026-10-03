/* Tic Tac Toe — two players, or a minimax CPU that cannot be beaten. */
GameHub.register({
  id: 'tictactoe',
  name: 'Tic Tac Toe',
  emoji: '⭕',
  category: 'Strategy',
  desc: 'Three in a row. The hard CPU plays perfectly — try to draw.',
  controls: 'Click a square · <kbd>1</kbd>–<kbd>9</kbd> map to the grid',
  scoreLabel: 'Wins',

  mount: function (api) {
    var U = GameHub.util;
    var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

    var mode = GameHub.store.get('ttt:mode', 'hard');
    var board, turn, over, els, wins, losses, draws;

    var bar = api.el('div', 'btn-bar');
    var modeBtns = {};
    [['easy', 'CPU: easy'], ['hard', 'CPU: perfect'], ['2p', '2 players']]
      .forEach(function (m) {
        var b = api.el('button', 'gbtn', m[1]);
        b.type = 'button';
        api.on(b, 'click', function () {
          mode = m[0];
          GameHub.store.set('ttt:mode', mode);
          syncBtns();
          reset();
        });
        modeBtns[m[0]] = b;
        bar.appendChild(b);
      });
    api.mount(bar);

    function syncBtns() {
      Object.keys(modeBtns).forEach(function (k) {
        modeBtns[k].classList.toggle('on', k === mode);
      });
    }

    var boardEl = api.el('div', 'board');
    boardEl.style.gridTemplateColumns = 'repeat(3, minmax(0, 94px))';
    api.mount(boardEl);

    var msg = api.el('div', 'msg');
    msg.setAttribute('aria-live', 'polite');
    api.mount(msg);

    els = U.range(9).map(function (i) {
      var el = api.el('div', 'cell');
      el.style.fontSize = '46px';
      api.on(el, 'pointerdown', function () { play(i); });
      boardEl.appendChild(el);
      return el;
    });

    wins = GameHub.store.get('ttt:record', { w: 0, l: 0, d: 0 });

    function reset() {
      board = U.range(9).map(function () { return null; });
      turn = 'X';
      over = false;
      els.forEach(function (el) {
        el.textContent = '';
        el.style.color = '';
        el.style.background = '';
        el.classList.remove('filled');
      });
      updateMsg();
      api.hud('W / L / D', wins.w + ' / ' + wins.l + ' / ' + wins.d);
      api.hud('Wins', api.best());
      api.closeOverlay();
    }

    function updateMsg() {
      if (over) return;
      if (mode === '2p') msg.innerHTML = '<strong>' + turn + '</strong> to move';
      else msg.innerHTML = turn === 'X'
        ? 'Your move (<strong>X</strong>)'
        : 'CPU thinking…';
    }

    function winner(b) {
      for (var i = 0; i < LINES.length; i++) {
        var L = LINES[i];
        if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[1]] === b[L[2]]) {
          return { player: b[L[0]], line: L };
        }
      }
      return b.every(function (c) { return c; }) ? { player: 'draw' } : null;
    }

    function play(i) {
      if (over || board[i]) return;
      if (mode !== '2p' && turn !== 'X') return;

      set(i, turn);
      var w = winner(board);
      if (w) return finish(w);

      turn = turn === 'X' ? 'O' : 'X';
      updateMsg();

      if (mode !== '2p' && turn === 'O') {
        api.timeout(cpuMove, 320);
      }
    }

    function set(i, p) {
      board[i] = p;
      els[i].textContent = p;
      els[i].style.color = p === 'X' ? '#6ee7ff' : '#ff5c8a';
      els[i].classList.add('filled');
      GameHub.sound.tone(p === 'X' ? 520 : 400, 0.05, 'triangle', 0.03);
    }

    function cpuMove() {
      if (over) return;
      var free = board.map(function (c, i) { return c ? null : i; })
                      .filter(function (i) { return i !== null; });
      if (!free.length) return;

      /* Easy mixes in random play so it's actually losable. */
      var i = (mode === 'easy' && Math.random() < 0.55)
        ? U.pick(free)
        : bestMove(board, 'O').index;

      set(i, 'O');
      var w = winner(board);
      if (w) return finish(w);
      turn = 'X';
      updateMsg();
    }

    /* Full minimax — the tree is 9! at worst, trivial for a browser. */
    function bestMove(b, player) {
      var w = winner(b);
      if (w) {
        if (w.player === 'O') return { score: 1 };
        if (w.player === 'X') return { score: -1 };
        return { score: 0 };
      }

      var best = null;
      for (var i = 0; i < 9; i++) {
        if (b[i]) continue;
        b[i] = player;
        var res = bestMove(b, player === 'O' ? 'X' : 'O');
        b[i] = null;

        var cand = { index: i, score: res.score };
        if (!best ||
            (player === 'O' ? cand.score > best.score : cand.score < best.score)) {
          best = cand;
        }
        /* Early exit on a guaranteed win — keeps the first move snappy. */
        if (player === 'O' && best.score === 1) break;
        if (player === 'X' && best.score === -1) break;
      }
      return best;
    }

    function finish(w) {
      over = true;

      if (w.line) {
        w.line.forEach(function (i) {
          els[i].style.background = 'rgba(110,231,255,.18)';
        });
      }

      var title, emoji, won = false;
      if (w.player === 'draw') {
        title = 'Draw'; emoji = '🤝';
        wins.d++;
        msg.textContent = 'Nobody wins.';
        GameHub.sound.tone(300, 0.2, 'triangle', 0.03);
      } else if (mode === '2p') {
        title = w.player + ' wins'; emoji = '🏆';
        msg.innerHTML = '<strong>' + w.player + '</strong> takes it.';
        GameHub.sound.win();
      } else if (w.player === 'X') {
        title = 'You win!'; emoji = '🏆'; won = true;
        wins.w++;
        api.submit(api.best() + 1);
        GameHub.sound.win();
      } else {
        title = 'CPU wins'; emoji = '🤖';
        wins.l++;
        GameHub.sound.bad();
      }

      GameHub.store.set('ttt:record', wins);
      api.hud('W / L / D', wins.w + ' / ' + wins.l + ' / ' + wins.d);
      api.hud('Wins', api.best());

      api.timeout(function () {
        api.overlay({
          emoji: emoji, title: title,
          lines: mode === 'hard' && w.player === 'draw'
            ? ['A draw is the best result against a perfect player.']
            : ['Record: ' + wins.w + 'W · ' + wins.l + 'L · ' + wins.d + 'D'],
          buttons: [
            { label: 'Play again', primary: true, onClick: reset },
            { label: 'Hub', onClick: api.exit }
          ]
        });
      }, 480);
    }

    api.hudInit(['W / L / D', 'Wins']);
    syncBtns();
    reset();

    api.onKey(function (e) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) play(n - 1);
    });
  }
});

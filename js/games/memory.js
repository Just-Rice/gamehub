/* Memory Match — find every pair in as few moves as possible. */
GameHub.register({
  id: 'memory',
  name: 'Memory Match',
  emoji: '🧠',
  category: 'Memory',
  desc: 'Flip cards, find the pairs, keep your move count down.',
  controls: 'Click or tap a card to flip it',
  scoreLabel: 'Fewest moves',
  lowerIsBetter: true,

  mount: function (api) {
    var U = GameHub.util;

    var FACES = ['🍎', '🚀', '🐙', '🎸', '🌵', '🍕', '🦊', '⚡',
                 '🎲', '🐳', '🍄', '🔮', '🏀', '🦋', '🌙', '🎯', '🐝', '🍩'];

    var SIZES = {
      '4×4': { cols: 4, pairs: 8 },
      '6×4': { cols: 6, pairs: 12 },
      '6×6': { cols: 6, pairs: 18 }
    };

    var sizeName = GameHub.store.get('memory:size', '4×4');
    var cards, els, first, second, busy, moves, found, elapsed, running;

    var bar = api.el('div', 'btn-bar');
    var sizeBtns = {};
    Object.keys(SIZES).forEach(function (name) {
      var b = api.el('button', 'gbtn', name);
      b.type = 'button';
      api.on(b, 'click', function () {
        sizeName = name;
        GameHub.store.set('memory:size', name);
        syncBtns();
        reset();
      });
      sizeBtns[name] = b;
      bar.appendChild(b);
    });
    api.mount(bar);

    function syncBtns() {
      Object.keys(sizeBtns).forEach(function (k) {
        sizeBtns[k].classList.toggle('on', k === sizeName);
      });
    }

    var board = api.el('div', 'board');
    api.mount(board);
    var msg = api.el('div', 'msg');
    api.mount(msg);

    function bestKey() { return 'memory:best:' + sizeName; }

    function reset() {
      var cfg = SIZES[sizeName];
      var faces = U.shuffle(FACES).slice(0, cfg.pairs);
      cards = U.shuffle(faces.concat(faces)).map(function (f) {
        return { face: f, open: false, matched: false };
      });

      first = null; second = null; busy = false;
      moves = 0; found = 0; elapsed = 0; running = false;

      var size = cfg.cols > 4 ? 72 : 82;
      board.style.gridTemplateColumns = 'repeat(' + cfg.cols + ', ' + size + 'px)';
      board.style.gridAutoRows = size + 'px';
      board.innerHTML = '';
      els = cards.map(function (card, i) {
        var el = api.el('div', 'cell');
        el.style.fontSize = Math.round(size * 0.46) + 'px';
        el.textContent = '';
        api.on(el, 'pointerdown', function () { flip(i); });
        board.appendChild(el);
        return el;
      });

      var best = GameHub.store.get(bestKey(), null);
      msg.innerHTML = best === null
        ? cfg.pairs + ' pairs. Good luck.'
        : 'Best for ' + sizeName + ': <strong>' + best + ' moves</strong>';

      api.hud('Moves', 0);
      api.hud('Pairs', '0/' + cfg.pairs);
      api.hud('Time', 0);
      api.closeOverlay();
    }

    function paint(i) {
      var card = cards[i], el = els[i];
      var shown = card.open || card.matched;
      el.textContent = shown ? card.face : '';
      el.style.background = card.matched ? 'rgba(74,222,128,.16)'
        : shown ? 'rgba(110,231,255,.14)' : '';
      el.style.borderColor = card.matched ? '#4ade80' : '';
      el.style.transform = shown ? 'rotateY(0deg)' : '';
      el.classList.toggle('filled', card.matched);
    }

    function flip(i) {
      if (busy) return;
      var card = cards[i];
      if (card.open || card.matched) return;

      if (!running) running = true;

      card.open = true;
      paint(i);
      GameHub.sound.tone(520, 0.04, 'triangle', 0.025);

      if (first === null) { first = i; return; }

      second = i;
      moves++;
      api.hud('Moves', moves);

      if (cards[first].face === cards[second].face) {
        cards[first].matched = cards[second].matched = true;
        paint(first); paint(second);
        found++;
        api.hud('Pairs', found + '/' + SIZES[sizeName].pairs);
        GameHub.sound.ok();
        first = second = null;
        if (found === SIZES[sizeName].pairs) win();
        return;
      }

      /* Mismatch: leave both visible briefly so the player can memorise them. */
      busy = true;
      var a = first, b = second;
      first = second = null;
      GameHub.sound.tone(220, 0.06, 'sawtooth', 0.025);
      api.timeout(function () {
        cards[a].open = cards[b].open = false;
        paint(a); paint(b);
        busy = false;
      }, 700);
    }

    function win() {
      running = false;
      var prev = GameHub.store.get(bestKey(), null);
      var record = prev === null || moves < prev;
      if (record) GameHub.store.set(bestKey(), moves);

      /* The hub tracks the 4×4 board so the headline number means one thing. */
      if (sizeName === '4×4') api.submit(moves);

      GameHub.sound.win();
      api.overlay({
        emoji: '🧠', title: 'All pairs found!',
        lines: [
          'Moves: ' + moves,
          'Time: ' + U.fmtTime(elapsed),
          record ? '★ New best for ' + sizeName + '!' : 'Best: ' + prev + ' moves'
        ],
        buttons: [
          { label: 'Play again', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    api.hudInit(['Moves', 'Pairs', 'Time']);
    syncBtns();
    reset();

    api.loop(function (dt) {
      if (!running) return;
      elapsed += dt;
      api.hud('Time', Math.floor(elapsed));
    });
  }
});

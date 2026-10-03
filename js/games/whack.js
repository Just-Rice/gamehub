/* Whack-a-Mole — 30 seconds of reaction time. */
GameHub.register({
  id: 'whack',
  name: 'Whack-a-Mole',
  emoji: '🔨',
  category: 'Arcade',
  desc: 'Thirty seconds. Hit the moles, spare the bombs.',
  controls: 'Click or tap a mole · <kbd>1</kbd>–<kbd>9</kbd> hits that hole',

  mount: function (api) {
    var SIZE = 3, TOTAL = SIZE * SIZE, DURATION = 30;
    var U = GameHub.util;

    var cells = [], occupants = [];
    var score, misses, streak, timeLeft, running, spawnTimer, upTime;

    var board = api.el('div', 'board');
    board.style.gridTemplateColumns = 'repeat(' + SIZE + ', minmax(0, 92px))';

    for (var i = 0; i < TOTAL; i++) {
      (function (idx) {
        var c = api.el('div', 'cell');
        c.style.fontSize = '42px';
        c.style.borderRadius = '50%';
        c.style.background = 'radial-gradient(circle at 50% 78%, #2a2038 0%, #171c33 70%)';
        api.on(c, 'pointerdown', function () { whack(idx); });
        cells.push(c);
        occupants.push(null);
        board.appendChild(c);
      })(i);
    }

    var msg = api.el('div', 'msg');
    api.mount(board);
    api.mount(msg);

    function reset() {
      score = 0; misses = 0; streak = 0;
      timeLeft = DURATION;
      spawnTimer = 0;
      upTime = 1.05;
      running = true;
      occupants = occupants.map(function () { return null; });
      cells.forEach(function (c) { c.textContent = ''; });
      msg.innerHTML = '<strong>Go!</strong> Hit 🐹, avoid 💣';
      api.hud('Score', 0);
      api.hud('Streak', 0);
      api.hud('Time', DURATION);
      api.hud('Best', api.best());
    }

    function popUp() {
      var free = [];
      for (var i = 0; i < TOTAL; i++) if (!occupants[i]) free.push(i);
      if (!free.length) return;

      var idx = U.pick(free);
      /* Bombs get more common as the round goes on. */
      var bombChance = 0.12 + (1 - timeLeft / DURATION) * 0.16;
      var kind = Math.random() < bombChance ? 'bomb' : 'mole';

      occupants[idx] = { kind: kind, t: upTime };
      cells[idx].textContent = kind === 'bomb' ? '💣' : '🐹';
      cells[idx].style.transform = 'scale(1)';
      GameHub.sound.tone(kind === 'bomb' ? 200 : 500, 0.04, 'triangle', 0.02);
    }

    function clear(idx) {
      occupants[idx] = null;
      cells[idx].textContent = '';
    }

    function whack(idx) {
      if (!running) return;
      var o = occupants[idx];

      if (!o) {
        streak = 0;
        api.hud('Streak', 0);
        msg.textContent = 'Swing and a miss.';
        GameHub.sound.tone(150, 0.05, 'sawtooth', 0.025);
        return;
      }

      if (o.kind === 'bomb') {
        score = Math.max(0, score - 5);
        streak = 0;
        misses++;
        msg.innerHTML = '💥 <strong>Bomb!</strong> −5';
        GameHub.sound.bad();
      } else {
        streak++;
        /* Every 3 in a row adds a point of bonus. */
        var pts = 1 + Math.floor(streak / 3);
        score += pts;
        msg.innerHTML = streak >= 3
          ? '🔥 <strong>' + streak + ' in a row</strong> +' + pts
          : 'Whack! +' + pts;
        GameHub.sound.tone(620 + Math.min(streak, 10) * 30, 0.05, 'square', 0.03);
      }

      cells[idx].textContent = o.kind === 'bomb' ? '💥' : '💫';
      var kept = idx;
      api.timeout(function () { if (occupants[kept] === o) clear(kept); }, 110);
      occupants[idx] = null;

      api.hud('Score', score);
      api.hud('Streak', streak);
    }

    function finish() {
      running = false;
      occupants.forEach(function (o, i) { if (o) clear(i); });
      api.gameOver({
        emoji: '🔨',
        title: "Time's up",
        won: score >= 25,
        score: score,
        lines: ['Best streak this round: ' + streak, 'Bombs hit: ' + misses],
        buttons: [
          { label: 'Play again', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    api.hudInit(['Score', 'Streak', 'Time', 'Best']);
    reset();

    api.onKey(function (e) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) whack(n - 1);
    });

    api.loop(function (dt) {
      if (!running) return;

      timeLeft -= dt;
      api.hud('Time', Math.max(0, Math.ceil(timeLeft)));
      if (timeLeft <= 0) return finish();

      /* Moles appear faster and stay up for less time as the clock runs. */
      var progress = 1 - timeLeft / DURATION;
      upTime = 1.15 - progress * 0.6;

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        popUp();
        spawnTimer = 0.72 - progress * 0.42;
      }

      for (var i = 0; i < TOTAL; i++) {
        var o = occupants[i];
        if (!o) continue;
        o.t -= dt;
        if (o.t <= 0) {
          if (o.kind === 'mole') { streak = 0; api.hud('Streak', 0); }
          clear(i);
        }
      }
    });
  }
});

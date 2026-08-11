/* Snake — grid crawler that speeds up as it grows. */
GameHub.register({
  id: 'snake',
  name: 'Snake',
  emoji: '🐍',
  category: 'Arcade',
  desc: 'Eat, grow, and try not to eat yourself.',
  controls: '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>WASD</kbd> · swipe on touch',

  mount: function (api) {
    var COLS = 24, ROWS = 24, CELL = 20;
    var W = COLS * CELL, H = ROWS * CELL;
    var cv = api.canvas(W, H);
    var ctx = cv.ctx;
    var U = GameHub.util;

    var snake, dir, queue, food, score, dead, grow, ticker, pulse;

    var DIRS = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
      left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
    };

    function reset() {
      snake = [{ x: 10, y: 12 }, { x: 9, y: 12 }, { x: 8, y: 12 }];
      dir = DIRS.right;
      queue = [];
      score = 0;
      dead = false;
      grow = 0;
      pulse = 0;
      placeFood();
      if (ticker) ticker.setRate(140);
      api.hud('Score', 0);
      api.hud('Best', api.best());
    }

    function placeFood() {
      /* Pick among free cells only, so a nearly-full board still terminates. */
      var free = [];
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          if (!occupied(x, y)) free.push({ x: x, y: y });
        }
      }
      food = free.length ? U.pick(free) : null;
    }

    function occupied(x, y) {
      return snake.some(function (s) { return s.x === x && s.y === y; });
    }

    function turn(name) {
      var d = DIRS[name];
      if (!d) return;
      /* Compare against the last queued turn so fast double-taps still work. */
      var ref = queue.length ? queue[queue.length - 1] : dir;
      if (d.x === -ref.x && d.y === -ref.y) return;
      if (d.x === ref.x && d.y === ref.y) return;
      if (queue.length < 2) queue.push(d);
    }

    function step() {
      if (dead) return;
      if (queue.length) dir = queue.shift();

      var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS ||
          occupied(head.x, head.y)) {
        return die();
      }

      snake.unshift(head);

      if (food && head.x === food.x && head.y === food.y) {
        score++;
        grow += 1;
        pulse = 1;
        api.hud('Score', score);
        GameHub.sound.tone(520 + score * 12, 0.06, 'square', 0.035);
        placeFood();
        if (!food) return win();
        ticker.setRate(Math.max(58, 140 - score * 3.2));
      }

      if (grow > 0) grow--;
      else snake.pop();
    }

    function die() {
      dead = true;
      api.gameOver({
        score: score,
        lines: ['Length: ' + snake.length],
        buttons: [
          { label: 'Play again', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    function win() {
      dead = true;
      api.gameOver({
        won: true,
        score: score,
        emoji: '🐍',
        title: 'Board cleared!',
        lines: ['You filled the entire grid.'],
        buttons: [
          { label: 'Play again', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    function draw() {
      ctx.fillStyle = '#080b16';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(110,231,255,.05)';
      ctx.lineWidth = 1;
      for (var i = 1; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL + .5, 0); ctx.lineTo(i * CELL + .5, H);
        ctx.moveTo(0, i * CELL + .5); ctx.lineTo(W, i * CELL + .5);
        ctx.stroke();
      }

      if (food) {
        pulse = Math.max(0, pulse - 0.04);
        var r = CELL / 2 - 3 + pulse * 3;
        ctx.fillStyle = '#ff5c8a';
        ctx.shadowColor = '#ff5c8a';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      snake.forEach(function (s, i) {
        var t = i / Math.max(snake.length - 1, 1);
        ctx.fillStyle = dead
          ? 'rgb(' + Math.round(120 - t * 50) + ',60,80)'
          : 'rgb(' + Math.round(74 + t * 30) + ',' + Math.round(222 - t * 70) + ',' + Math.round(128 + t * 60) + ')';
        var pad = i === 0 ? 1 : 2;
        U.roundRect(ctx, s.x * CELL + pad, s.y * CELL + pad,
          CELL - pad * 2, CELL - pad * 2, i === 0 ? 6 : 4);
        ctx.fill();
      });

      /* Eyes on the head, oriented to travel. */
      if (snake.length) {
        var h = snake[0];
        var cx = h.x * CELL + CELL / 2, cy = h.y * CELL + CELL / 2;
        ctx.fillStyle = '#08130c';
        var ox = dir.y !== 0 ? 3.5 : 0, oy = dir.x !== 0 ? 3.5 : 0;
        var fx = dir.x * 3, fy = dir.y * 3;
        ctx.beginPath();
        ctx.arc(cx + fx + ox, cy + fy + oy, 2, 0, Math.PI * 2);
        ctx.arc(cx + fx - ox, cy + fy - oy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    api.hudInit(['Score', 'Best']);
    reset();

    var KEYMAP = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right'
    };

    api.onKey(function (e) {
      var name = KEYMAP[e.key];
      if (name) { e.preventDefault(); turn(name); }
    });

    api.onSwipe(cv.el, turn);
    api.dpad(turn);

    ticker = api.tick(140, step);
    api.loop(draw);
  }
});

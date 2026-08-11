/* 2048 — sliding tile merge, with animated movement. */
GameHub.register({
  id: '2048',
  name: '2048',
  emoji: '🔢',
  category: 'Puzzle',
  desc: 'Slide, merge, and chase the 2048 tile.',
  controls: '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>WASD</kbd> · swipe on touch',

  mount: function (api) {
    var N = 4, CELL = 92, GAP = 10, PAD = 10;
    var W = PAD * 2 + N * CELL + (N - 1) * GAP;
    var cv = api.canvas(W, W, { maxWidth: 420 });
    var ctx = cv.ctx;
    var U = GameHub.util;

    var COLORS = {
      2: ['#2b3157', '#e8ecff'], 4: ['#35407a', '#e8ecff'],
      8: ['#4c5bb5', '#ffffff'], 16: ['#5f4bd6', '#ffffff'],
      32: ['#7c3aed', '#ffffff'], 64: ['#a855f7', '#ffffff'],
      128: ['#d946ef', '#ffffff'], 256: ['#f43f5e', '#ffffff'],
      512: ['#f97316', '#2a1000'], 1024: ['#facc15', '#3a2a03'],
      2048: ['#6ee7ff', '#052029']
    };

    var tiles, score, over, won, keepGoing, anim, nextId, undoState;

    function pos(i) { return PAD + i * (CELL + GAP); }

    function reset() {
      tiles = [];
      nextId = 1;
      score = 0;
      over = false; won = false; keepGoing = false;
      anim = 0;
      undoState = null;
      addTile(); addTile();
      api.hud('Score', 0);
      api.hud('Best', api.best());
    }

    function occupied() {
      var g = U.grid(N, N, null);
      tiles.forEach(function (t) { g[t.r][t.c] = t; });
      return g;
    }

    function addTile() {
      var g = occupied(), free = [];
      for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) if (!g[r][c]) free.push([r, c]);
      }
      if (!free.length) return null;
      var p = U.pick(free);
      var t = {
        id: nextId++, r: p[0], c: p[1],
        v: Math.random() < 0.9 ? 2 : 4,
        pr: p[0], pc: p[1], isNew: true, merged: false
      };
      tiles.push(t);
      return t;
    }

    /* Returns the ordered indices to walk for a given direction, so one
     * routine handles all four moves. */
    function lineFor(dir, i) {
      var line = [];
      for (var k = 0; k < N; k++) {
        if (dir === 'left') line.push([i, k]);
        else if (dir === 'right') line.push([i, N - 1 - k]);
        else if (dir === 'up') line.push([k, i]);
        else line.push([N - 1 - k, i]);
      }
      return line;
    }

    function move(dir) {
      if (over || anim > 0) return;

      var snapshot = {
        tiles: tiles.map(function (t) { return { id: t.id, r: t.r, c: t.c, v: t.v }; }),
        score: score
      };

      var g = occupied();
      var moved = false;
      var survivors = [];

      for (var i = 0; i < N; i++) {
        var line = lineFor(dir, i);
        var stack = [];

        line.forEach(function (p) {
          var t = g[p[0]][p[1]];
          if (!t) return;
          t.pr = t.r; t.pc = t.c; t.isNew = false; t.merged = false;

          var top = stack[stack.length - 1];
          if (top && top.v === t.v && !top.justMerged) {
            top.v *= 2;
            top.justMerged = true;
            top.absorbed = t;
            score += top.v;
            if (top.v === 2048 && !won) won = true;
          } else {
            stack.push(t);
          }
        });

        stack.forEach(function (t, k) {
          var dest = line[k];
          if (t.r !== dest[0] || t.c !== dest[1]) moved = true;
          t.r = dest[0]; t.c = dest[1];
          if (t.absorbed) {
            moved = true;
            t.absorbed.r = dest[0];
            t.absorbed.c = dest[1];
            t.absorbed.dying = true;
            survivors.push(t.absorbed);
            t.merged = true;
            t.absorbed = null;
          }
          t.justMerged = false;
          survivors.push(t);
        });
      }

      if (!moved) {
        GameHub.sound.tone(160, 0.05, 'sawtooth', 0.02);
        return;
      }

      undoState = snapshot;
      tiles = survivors;
      anim = 1;
      api.hud('Score', score);
      GameHub.sound.tone(380, 0.04, 'triangle', 0.025);

      /* Settle: drop the absorbed tiles, spawn a new one, then test for a loss. */
      api.timeout(function () {
        tiles = tiles.filter(function (t) { return !t.dying; });
        addTile();
        anim = 0;
        if (won && !keepGoing) return celebrate();
        if (!canMove()) endGame();
      }, 110);
    }

    function canMove() {
      var g = occupied();
      for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
          if (!g[r][c]) return true;
          if (c + 1 < N && g[r][c + 1] && g[r][c + 1].v === g[r][c].v) return true;
          if (r + 1 < N && g[r + 1][c] && g[r + 1][c].v === g[r][c].v) return true;
        }
      }
      return false;
    }

    function celebrate() {
      keepGoing = true;
      GameHub.sound.win();
      api.submit(score);
      api.hud('Best', api.best());
      api.overlay({
        emoji: '🎉',
        title: 'You made 2048!',
        lines: ['Score: ' + score],
        buttons: [
          { label: 'Keep going', primary: true, onClick: function () {} },
          { label: 'New game', onClick: reset }
        ]
      });
    }

    function endGame() {
      over = true;
      api.gameOver({
        emoji: '🔢',
        title: 'No moves left',
        score: score,
        lines: ['Highest tile: ' + Math.max.apply(null, tiles.map(function (t) { return t.v; }))],
        buttons: [
          { label: 'New game', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    function undo() {
      if (!undoState || anim > 0) return;
      tiles = undoState.tiles.map(function (t) {
        return { id: t.id, r: t.r, c: t.c, v: t.v, pr: t.r, pc: t.c };
      });
      score = undoState.score;
      undoState = null;
      over = false;
      api.hud('Score', score);
      api.closeOverlay();
      GameHub.sound.click();
    }

    function draw() {
      ctx.fillStyle = '#12162a';
      U.roundRect(ctx, 0, 0, W, W, 14);
      ctx.fill();

      for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
          ctx.fillStyle = 'rgba(255,255,255,.04)';
          U.roundRect(ctx, pos(c), pos(r), CELL, CELL, 8);
          ctx.fill();
        }
      }

      if (anim > 0) anim = Math.max(0, anim - 0.14);
      var t01 = 1 - anim;
      var ease = 1 - Math.pow(1 - t01, 3);

      tiles.forEach(function (t) {
        var pr = t.pr == null ? t.r : t.pr;
        var pc = t.pc == null ? t.c : t.pc;
        var x = pos(pc + (t.c - pc) * ease);
        var y = pos(pr + (t.r - pr) * ease);

        /* New and merged tiles pop rather than simply appearing. */
        var scale = 1;
        if (t.isNew) scale = 0.55 + 0.45 * ease;
        else if (t.merged) scale = 1 + 0.14 * Math.sin(ease * Math.PI);

        var s = CELL * scale;
        var off = (CELL - s) / 2;

        var pal = COLORS[t.v] || ['#6ee7ff', '#052029'];
        ctx.fillStyle = pal[0];
        U.roundRect(ctx, x + off, y + off, s, s, 8);
        ctx.fill();

        ctx.fillStyle = pal[1];
        var digits = String(t.v).length;
        ctx.font = '800 ' + (digits > 3 ? 27 : digits > 2 ? 33 : 39) * scale +
          'px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(t.v), x + CELL / 2, y + CELL / 2 + 1);
      });
      ctx.textBaseline = 'alphabetic';
    }

    api.hudInit(['Score', 'Best']);
    reset();

    var KEYMAP = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
      A: 'left', D: 'right', W: 'up', S: 'down'
    };

    api.onKey(function (e) {
      var dir = KEYMAP[e.key];
      if (dir) { e.preventDefault(); move(dir); }
      else if (e.key === 'u' || e.key === 'U') undo();
    });

    api.onSwipe(cv.el, move);

    api.buttons([
      { label: '↩ Undo', onClick: undo },
      { label: 'New game', onClick: reset }
    ]);

    api.loop(draw);
  }
});

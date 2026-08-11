/* Space Invaders — marching grid, destructible shields, escalating waves. */
GameHub.register({
  id: 'invaders',
  name: 'Space Invaders',
  emoji: '👾',
  category: 'Arcade',
  desc: 'Hold the line against the descending swarm.',
  controls: '<kbd>←</kbd><kbd>→</kbd> move · <kbd>Space</kbd> fire',

  mount: function (api) {
    var W = 600, H = 470;
    var cv = api.canvas(W, H);
    var ctx = cv.ctx;
    var U = GameHub.util;

    var AC = 11, AR = 5, AW = 28, AH = 20, AGX = 16, AGY = 14;
    var ROW_KIND = [2, 1, 1, 0, 0];      /* top rows are worth more */
    var KINDS = [
      { color: '#4ade80', points: 10 },
      { color: '#22d3ee', points: 20 },
      { color: '#f43f5e', points: 40 }
    ];

    var ship, aliens, shots, bombs, shields, score, lives, wave, over;
    var dirX, stepAcc, stepRate, cooldown, animFrame, ufo, ufoTimer;

    function reset(full) {
      if (full) { score = 0; lives = 3; wave = 1; }
      ship = { x: W / 2 - 18, y: H - 42, w: 36, h: 16, cool: 0 };
      shots = []; bombs = [];
      buildAliens();
      buildShields();
      dirX = 1;
      stepAcc = 0;
      animFrame = 0;
      ufo = null;
      ufoTimer = 12 + Math.random() * 10;
      over = false;
      api.hud('Score', score);
      api.hud('Lives', lives);
      api.hud('Wave', wave);
      api.hud('Best', api.best());
    }

    function buildAliens() {
      aliens = [];
      var startY = 54 + Math.min((wave - 1) * 10, 60);
      for (var r = 0; r < AR; r++) {
        for (var c = 0; c < AC; c++) {
          aliens.push({
            x: 52 + c * (AW + AGX),
            y: startY + r * (AH + AGY),
            kind: ROW_KIND[r],
            alive: true
          });
        }
      }
      stepRate = 0.62;
    }

    function buildShields() {
      /* Each shield is a small block grid that erodes hit by hit. */
      shields = [];
      for (var s = 0; s < 4; s++) {
        var bx = 74 + s * 132, by = H - 118;
        var blocks = [];
        for (var r = 0; r < 4; r++) {
          for (var c = 0; c < 7; c++) {
            /* Notch out the bottom middle to get the classic arch. */
            if (r >= 2 && c >= 2 && c <= 4) continue;
            blocks.push({ x: bx + c * 9, y: by + r * 9, hp: 3 });
          }
        }
        shields.push(blocks);
      }
    }

    function livingAliens() {
      return aliens.filter(function (a) { return a.alive; });
    }

    function stepAliens() {
      var live = livingAliens();
      if (!live.length) return;

      var minX = Math.min.apply(null, live.map(function (a) { return a.x; }));
      var maxX = Math.max.apply(null, live.map(function (a) { return a.x + AW; }));

      if ((dirX > 0 && maxX + 12 >= W) || (dirX < 0 && minX - 12 <= 0)) {
        dirX *= -1;
        live.forEach(function (a) { a.y += 16; });
      } else {
        live.forEach(function (a) { a.x += dirX * 12; });
      }

      animFrame ^= 1;
      GameHub.sound.tone(animFrame ? 110 : 92, 0.05, 'square', 0.022);

      /* Tempo rises as the swarm thins — the pressure that defines the game. */
      stepRate = 0.62 * (live.length / (AC * AR)) + 0.07;

      live.forEach(function (a) {
        if (a.y + AH >= ship.y) endGame();
      });
    }

    function alienFire(dt) {
      var live = livingAliens();
      if (!live.length) return;
      /* Only the front alien of each column may fire. */
      var frontByCol = {};
      live.forEach(function (a) {
        var col = Math.round((a.x - 52) / (AW + AGX));
        if (!frontByCol[col] || a.y > frontByCol[col].y) frontByCol[col] = a;
      });
      var shooters = Object.keys(frontByCol).map(function (k) { return frontByCol[k]; });
      var chance = (0.5 + wave * 0.18) * dt;
      if (Math.random() < chance && bombs.length < 4 + wave) {
        var a = U.pick(shooters);
        bombs.push({ x: a.x + AW / 2, y: a.y + AH, vy: 190 + wave * 14 });
      }
    }

    function fire() {
      if (over || ship.cool > 0) return;
      if (shots.length >= 3) return;
      shots.push({ x: ship.x + ship.w / 2, y: ship.y - 4, vy: -520 });
      ship.cool = 0.24;
      GameHub.sound.tone(880, 0.05, 'square', 0.03);
    }

    function hitShield(x, y) {
      for (var s = 0; s < shields.length; s++) {
        var blocks = shields[s];
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i];
          if (x >= b.x && x <= b.x + 9 && y >= b.y && y <= b.y + 9) {
            b.hp--;
            if (b.hp <= 0) blocks.splice(i, 1);
            GameHub.sound.tone(240, 0.03, 'sawtooth', 0.02);
            return true;
          }
        }
      }
      return false;
    }

    function endGame() {
      if (over) return;
      over = true;
      api.gameOver({
        score: score,
        lines: ['Wave ' + wave],
        buttons: [
          { label: 'Play again', primary: true, onClick: function () { reset(true); } },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    function loseLife() {
      lives--;
      api.hud('Lives', lives);
      GameHub.sound.bad();
      bombs = [];
      if (lives <= 0) return endGame();
      ship.x = W / 2 - 18;
    }

    function update(dt) {
      if (over) return;

      if (api.keys.ArrowLeft || api.keys.a) ship.x -= 330 * dt;
      if (api.keys.ArrowRight || api.keys.d) ship.x += 330 * dt;
      ship.x = U.clamp(ship.x, 6, W - ship.w - 6);
      if (ship.cool > 0) ship.cool -= dt;
      if (api.keys[' '] || api.keys.Space) fire();

      stepAcc += dt;
      if (stepAcc >= stepRate) { stepAcc = 0; stepAliens(); }
      alienFire(dt);

      /* Mystery ship. */
      ufoTimer -= dt;
      if (!ufo && ufoTimer <= 0) {
        ufo = { x: -40, vx: 105, y: 30 };
        ufoTimer = 18 + Math.random() * 14;
      }
      if (ufo) {
        ufo.x += ufo.vx * dt;
        if (ufo.x > W + 40) ufo = null;
      }

      for (var i = shots.length - 1; i >= 0; i--) {
        var s = shots[i];
        s.y += s.vy * dt;
        if (s.y < 0) { shots.splice(i, 1); continue; }
        if (hitShield(s.x, s.y)) { shots.splice(i, 1); continue; }

        if (ufo && s.y < 44 && s.x > ufo.x - 20 && s.x < ufo.x + 20) {
          score += 150;
          api.hud('Score', score);
          ufo = null;
          shots.splice(i, 1);
          GameHub.sound.seq([[880, 0], [1200, .06], [1500, .12]], 'triangle');
          continue;
        }

        var hit = false;
        for (var j = 0; j < aliens.length && !hit; j++) {
          var a = aliens[j];
          if (!a.alive) continue;
          if (s.x >= a.x && s.x <= a.x + AW && s.y >= a.y && s.y <= a.y + AH) {
            a.alive = false;
            score += KINDS[a.kind].points;
            api.hud('Score', score);
            shots.splice(i, 1);
            hit = true;
            GameHub.sound.tone(300, 0.07, 'sawtooth', 0.035);
          }
        }
        if (hit && !livingAliens().length) return nextWave();
      }

      for (var b = bombs.length - 1; b >= 0; b--) {
        var bo = bombs[b];
        bo.y += bo.vy * dt;
        if (bo.y > H) { bombs.splice(b, 1); continue; }
        if (hitShield(bo.x, bo.y)) { bombs.splice(b, 1); continue; }
        if (bo.y >= ship.y && bo.y <= ship.y + ship.h &&
            bo.x >= ship.x && bo.x <= ship.x + ship.w) {
          bombs.splice(b, 1);
          loseLife();
        }
      }
    }

    function nextWave() {
      wave++;
      api.hud('Wave', wave);
      GameHub.sound.win();
      api.overlay({
        emoji: '🛸',
        title: 'Wave ' + (wave - 1) + ' cleared',
        lines: ['Score: ' + score, 'They come back faster.'],
        buttons: [{
          label: 'Next wave', primary: true,
          onClick: function () { reset(false); }
        }]
      });
    }

    /* Two-frame invader sprite, drawn from a small bitmap. */
    var SPRITES = [
      ['0010000100', '0011111100', '0110110110', '1111111111', '1011111101', '1010000101'],
      ['0010000100', '1011111101', '1111111111', '0110110110', '0011111100', '0100000010']
    ];

    function drawAlien(a) {
      var rows = SPRITES[animFrame];
      var px = AW / 10;
      ctx.fillStyle = KINDS[a.kind].color;
      for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < 10; c++) {
          if (rows[r][c] === '1') {
            ctx.fillRect(a.x + c * px, a.y + r * (AH / 6), px + 0.5, AH / 6 + 0.5);
          }
        }
      }
    }

    function draw() {
      ctx.fillStyle = '#04060f';
      ctx.fillRect(0, 0, W, H);

      /* Static starfield derived from index, so it never flickers. */
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      for (var i = 0; i < 60; i++) {
        var sx = (i * 137.5) % W, sy = (i * 61.8) % (H - 60);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      aliens.forEach(function (a) { if (a.alive) drawAlien(a); });

      if (ufo) {
        ctx.fillStyle = '#facc15';
        U.roundRect(ctx, ufo.x - 18, ufo.y - 7, 36, 14, 7);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        U.roundRect(ctx, ufo.x - 9, ufo.y - 12, 18, 9, 5);
        ctx.fill();
      }

      shields.forEach(function (blocks) {
        blocks.forEach(function (b) {
          ctx.fillStyle = b.hp === 3 ? '#4ade80' : b.hp === 2 ? '#3aa864' : '#276b41';
          ctx.fillRect(b.x, b.y, 9, 9);
        });
      });

      ctx.fillStyle = '#6ee7ff';
      ctx.fillRect(ship.x, ship.y + 6, ship.w, ship.h - 6);
      ctx.fillRect(ship.x + 12, ship.y + 2, 12, 6);
      ctx.fillRect(ship.x + 16, ship.y - 3, 4, 6);

      ctx.fillStyle = '#fff';
      shots.forEach(function (s) { ctx.fillRect(s.x - 1.5, s.y, 3, 11); });
      ctx.fillStyle = '#ff5c8a';
      bombs.forEach(function (b) { ctx.fillRect(b.x - 1.5, b.y, 3, 10); });

      ctx.fillStyle = 'rgba(110,231,255,.35)';
      ctx.fillRect(0, H - 12, W, 2);
    }

    api.hudInit(['Score', 'Lives', 'Wave', 'Best']);
    reset(true);

    api.onKey(function (e) {
      if (['ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
      if (e.key === ' ') fire();
    });

    api.on(cv.el, 'touchstart', function (e) {
      e.preventDefault();
      var p = api.canvasPoint(cv, e);
      ship.x = U.clamp(p.x - ship.w / 2, 6, W - ship.w - 6);
      fire();
    }, { passive: false });
    api.on(cv.el, 'touchmove', function (e) {
      e.preventDefault();
      var p = api.canvasPoint(cv, e);
      ship.x = U.clamp(p.x - ship.w / 2, 6, W - ship.w - 6);
    }, { passive: false });

    api.buttons([{ label: '🔫 Fire', wide: true, onClick: fire }], 'touch-only');

    api.loop(function (dt) { update(dt); draw(); });
  }
});

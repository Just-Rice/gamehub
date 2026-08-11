/* Breakout — bricks, power-ups, escalating levels. */
GameHub.register({
  id: 'breakout',
  name: 'Breakout',
  emoji: '🧱',
  category: 'Arcade',
  desc: 'Smash every brick. Catch power-ups, keep the ball alive.',
  controls: '<kbd>←</kbd><kbd>→</kbd> or move the mouse · <kbd>Space</kbd> launches',

  mount: function (api) {
    var W = 600, H = 440;
    var cv = api.canvas(W, H);
    var ctx = cv.ctx;
    var U = GameHub.util;

    var COLS = 10, ROWS = 6, BW = 52, BH = 20, GAP = 5, TOP = 56, LEFT = 22;
    var COLORS = ['#f43f5e', '#f97316', '#facc15', '#4ade80', '#22d3ee', '#a78bfa'];

    var paddle, balls, bricks, drops, score, lives, level, over, launched;

    var POWERS = [
      { key: 'wide',  label: 'W', color: '#4ade80' },
      { key: 'multi', label: 'M', color: '#22d3ee' },
      { key: 'slow',  label: 'S', color: '#a78bfa' },
      { key: 'life',  label: '♥', color: '#f43f5e' }
    ];

    function reset(full) {
      if (full) { score = 0; lives = 3; level = 1; }
      paddle = { x: W / 2 - 52, y: H - 30, w: 104, h: 13, wideT: 0 };
      buildBricks();
      drops = [];
      resetBall();
      over = false;
      api.hud('Score', score);
      api.hud('Lives', lives);
      api.hud('Level', level);
      api.hud('Best', api.best());
    }

    function resetBall() {
      launched = false;
      balls = [{
        x: paddle.x + paddle.w / 2, y: paddle.y - 9,
        vx: 0, vy: 0, r: 7
      }];
    }

    function buildBricks() {
      bricks = [];
      /* Higher levels add tougher (multi-hit) bricks toward the top. */
      var toughRows = Math.min(level - 1, 3);
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          /* Carve a small gap pattern so later levels aren't just a slab. */
          if (level > 2 && (r + c) % 7 === 0) continue;
          bricks.push({
            x: LEFT + c * (BW + GAP),
            y: TOP + r * (BH + GAP),
            hp: r < toughRows ? 2 : 1,
            color: COLORS[r % COLORS.length]
          });
        }
      }
    }

    function launch() {
      if (launched || over) return;
      launched = true;
      var b = balls[0];
      b.vx = (Math.random() * 2 - 1) * 140;
      b.vy = -300 - level * 12;
      GameHub.sound.tone(660, 0.06, 'square', 0.03);
    }

    function loseBall() {
      lives--;
      api.hud('Lives', lives);
      GameHub.sound.bad();
      if (lives <= 0) {
        over = true;
        api.gameOver({
          score: score,
          lines: ['Reached level ' + level],
          buttons: [
            { label: 'Play again', primary: true, onClick: function () { reset(true); } },
            { label: 'Hub', onClick: api.exit }
          ]
        });
        return;
      }
      paddle.w = 104;
      paddle.wideT = 0;
      drops = [];
      resetBall();
    }

    function nextLevel() {
      level++;
      api.hud('Level', level);
      GameHub.sound.win();
      api.overlay({
        emoji: '🎉',
        title: 'Level ' + (level - 1) + ' cleared',
        lines: ['Score: ' + score, 'Bricks get tougher from here.'],
        buttons: [{
          label: 'Level ' + level + ' →', primary: true,
          onClick: function () { reset(false); }
        }]
      });
    }

    function spawnDrop(x, y) {
      if (Math.random() > 0.16) return;
      var p = U.pick(POWERS);
      drops.push({ x: x, y: y, vy: 105, p: p });
    }

    function applyPower(key) {
      if (key === 'wide') {
        paddle.w = 160;
        paddle.wideT = 12;
      } else if (key === 'multi') {
        var src = balls.slice();
        src.forEach(function (b) {
          if (balls.length >= 6) return;
          balls.push({ x: b.x, y: b.y, vx: -b.vx * 0.9 + 40, vy: b.vy, r: b.r });
        });
      } else if (key === 'slow') {
        balls.forEach(function (b) { b.vx *= 0.72; b.vy *= 0.72; });
      } else if (key === 'life') {
        lives++;
        api.hud('Lives', lives);
      }
      GameHub.sound.ok();
    }

    function update(dt) {
      if (over) return;

      /* Paddle */
      if (api.keys.ArrowLeft || api.keys.a) paddle.x -= 520 * dt;
      if (api.keys.ArrowRight || api.keys.d) paddle.x += 520 * dt;
      paddle.x = U.clamp(paddle.x, 0, W - paddle.w);

      if (paddle.wideT > 0) {
        paddle.wideT -= dt;
        if (paddle.wideT <= 0) paddle.w = 104;
      }

      if (!launched) {
        balls[0].x = paddle.x + paddle.w / 2;
        balls[0].y = paddle.y - 9;
        return;
      }

      for (var i = balls.length - 1; i >= 0; i--) {
        var b = balls[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); tick(); }
        if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); tick(); }
        if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); tick(); }

        if (b.y - b.r > H) {
          balls.splice(i, 1);
          if (!balls.length) loseBall();
          continue;
        }

        /* Paddle bounce, angle by contact point. */
        if (b.vy > 0 && b.y + b.r >= paddle.y && b.y - b.r <= paddle.y + paddle.h &&
            b.x >= paddle.x - b.r && b.x <= paddle.x + paddle.w + b.r) {
          var rel = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
          var speed = Math.min(Math.hypot(b.vx, b.vy) * 1.02, 640);
          var ang = U.clamp(rel, -1, 1) * 1.05;
          b.vx = speed * Math.sin(ang);
          b.vy = -Math.abs(speed * Math.cos(ang));
          b.y = paddle.y - b.r;
          GameHub.sound.tone(340, 0.04, 'square', 0.03);
        }

        hitBricks(b);
      }

      /* Falling power-ups. */
      for (var d = drops.length - 1; d >= 0; d--) {
        var dr = drops[d];
        dr.y += dr.vy * dt;
        if (dr.y > H) { drops.splice(d, 1); continue; }
        if (dr.y > paddle.y - 8 && dr.y < paddle.y + paddle.h &&
            dr.x > paddle.x - 10 && dr.x < paddle.x + paddle.w + 10) {
          applyPower(dr.p.key);
          drops.splice(d, 1);
        }
      }

      if (!bricks.length) nextLevel();
    }

    function tick() { GameHub.sound.tone(500, 0.025, 'square', 0.02); }

    /* Resolve on the shallower penetration axis so corner hits look right. */
    function hitBricks(b) {
      for (var i = 0; i < bricks.length; i++) {
        var k = bricks[i];
        if (b.x + b.r < k.x || b.x - b.r > k.x + BW) continue;
        if (b.y + b.r < k.y || b.y - b.r > k.y + BH) continue;

        var overlapX = Math.min(b.x + b.r - k.x, k.x + BW - (b.x - b.r));
        var overlapY = Math.min(b.y + b.r - k.y, k.y + BH - (b.y - b.r));
        if (overlapX < overlapY) b.vx *= -1; else b.vy *= -1;

        k.hp--;
        if (k.hp <= 0) {
          score += 10 * level;
          spawnDrop(k.x + BW / 2, k.y + BH / 2);
          bricks.splice(i, 1);
        } else {
          score += 4 * level;
        }
        api.hud('Score', score);
        GameHub.sound.tone(720, 0.035, 'square', 0.03);
        return;
      }
    }

    function draw() {
      ctx.fillStyle = '#070a15';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(110,231,255,.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      bricks.forEach(function (k) {
        ctx.fillStyle = k.hp > 1 ? '#8b93b8' : k.color;
        U.roundRect(ctx, k.x, k.y, BW, BH, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(k.x + 4, k.y + 3, BW - 8, 3);
        if (k.hp > 1) {
          ctx.fillStyle = 'rgba(0,0,0,.3)';
          ctx.fillRect(k.x + 6, k.y + BH / 2 - 1, BW - 12, 2);
        }
      });

      drops.forEach(function (d) {
        ctx.fillStyle = d.p.color;
        U.roundRect(ctx, d.x - 11, d.y - 8, 22, 16, 5);
        ctx.fill();
        ctx.fillStyle = '#0a0d1b';
        ctx.font = '800 11px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.p.label, d.x, d.y + 4);
      });

      var pg = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.w, 0);
      pg.addColorStop(0, '#6ee7ff');
      pg.addColorStop(1, '#a78bfa');
      ctx.fillStyle = pg;
      U.roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6);
      ctx.fill();

      balls.forEach(function (b) {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#6ee7ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      if (!launched && !over) {
        ctx.fillStyle = 'rgba(232,236,255,.75)';
        ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Press Space or tap to launch', W / 2, H / 2 + 40);
      }
    }

    api.hudInit(['Score', 'Lives', 'Level', 'Best']);
    reset(true);

    api.onKey(function (e) {
      if (['ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
      if (e.key === ' ') launch();
    });

    function follow(e) {
      var p = api.canvasPoint(cv, e);
      paddle.x = U.clamp(p.x - paddle.w / 2, 0, W - paddle.w);
    }
    api.on(cv.el, 'mousemove', follow);
    api.on(cv.el, 'mousedown', launch);
    api.on(cv.el, 'touchmove', function (e) { e.preventDefault(); follow(e); }, { passive: false });
    api.on(cv.el, 'touchstart', function (e) {
      e.preventDefault(); follow(e); launch();
    }, { passive: false });

    api.loop(function (dt) { update(dt); draw(); });
  }
});

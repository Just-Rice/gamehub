/* Flappy Bird — one input, brutal difficulty curve. */
GameHub.register({
  id: 'flappy',
  name: 'Flappy Bird',
  emoji: '🐤',
  category: 'Arcade',
  desc: 'Tap through the pipes. One button, no mercy.',
  controls: 'Press <kbd>Space</kbd> / click / tap to flap',

  mount: function (api) {
    var W = 380, H = 560, GROUND = 76;
    var cv = api.canvas(W, H);
    var ctx = cv.ctx;
    var U = GameHub.util;

    var GRAVITY = 1500, FLAP = -430, PIPE_W = 64, SPEED0 = 158;

    var bird, pipes, score, dead, started, spawnX, speed, groundX, hillX, flash;

    function reset() {
      bird = { x: 108, y: H / 2 - 40, vy: 0, r: 13, rot: 0 };
      pipes = [];
      score = 0;
      dead = false;
      started = false;
      speed = SPEED0;
      spawnX = W + 60;
      groundX = 0;
      hillX = 0;
      flash = 0;
      api.hud('Score', 0);
      api.hud('Best', api.best());
    }

    function gapFor(n) {
      /* Opens generous, tightens for the first ~20 pipes, then holds. */
      return Math.max(112, 168 - n * 2.6);
    }

    function addPipe() {
      var gap = gapFor(pipes.length + score);
      var margin = 58;
      var top = margin + Math.random() * (H - GROUND - gap - margin * 2);
      pipes.push({ x: spawnX, top: top, gap: gap, passed: false });
    }

    function flap() {
      if (dead) return;
      if (!started) { started = true; addPipe(); }
      bird.vy = FLAP;
      GameHub.sound.tone(720, 0.05, 'square', 0.03);
    }

    function die() {
      if (dead) return;
      dead = true;
      flash = 1;
      api.timeout(function () {
        api.gameOver({
          score: score,
          emoji: score >= 10 ? '🏅' : '🐤',
          title: score >= 10 ? 'Nice flying' : 'Splat',
          buttons: [
            { label: 'Play again', primary: true, onClick: function () { reset(); } },
            { label: 'Hub', onClick: api.exit }
          ]
        });
      }, 620);
    }

    function update(dt) {
      if (flash > 0) flash = Math.max(0, flash - dt * 3);
      groundX = (groundX + speed * dt) % 24;

      if (!started) {
        /* Idle bob before the first flap. */
        bird.y = H / 2 - 40 + Math.sin(performance.now() / 260) * 9;
        bird.rot = 0;
        return;
      }

      bird.vy += GRAVITY * dt;
      bird.y += bird.vy * dt;
      bird.rot = U.clamp(bird.vy / 620, -0.5, 1.35);

      if (dead) {
        /* Fall to the ground, then stop. */
        if (bird.y > H - GROUND - bird.r) {
          bird.y = H - GROUND - bird.r;
          bird.vy = 0;
        }
        return;
      }

      hillX = (hillX + speed * 0.22 * dt) % 220;
      speed = SPEED0 + Math.min(score * 2.6, 70);

      for (var i = pipes.length - 1; i >= 0; i--) {
        var p = pipes[i];
        p.x -= speed * dt;

        if (!p.passed && p.x + PIPE_W < bird.x - bird.r) {
          p.passed = true;
          score++;
          api.hud('Score', score);
          GameHub.sound.tone(880, 0.06, 'triangle', 0.035);
        }
        if (p.x + PIPE_W < -10) pipes.splice(i, 1);
      }

      var lastPipe = pipes[pipes.length - 1];
      if (!lastPipe || lastPipe.x < W - 168) addPipe();

      /* Collisions: circle vs. the two rectangles of each pipe. */
      if (bird.y + bird.r >= H - GROUND || bird.y - bird.r <= 0) return die();
      for (var j = 0; j < pipes.length; j++) {
        var q = pipes[j];
        if (bird.x + bird.r > q.x && bird.x - bird.r < q.x + PIPE_W) {
          if (bird.y - bird.r < q.top || bird.y + bird.r > q.top + q.gap) return die();
        }
      }
    }

    function drawPipe(p) {
      var botY = p.top + p.gap;
      var body = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      body.addColorStop(0, '#3fae54');
      body.addColorStop(0.35, '#6ee08a');
      body.addColorStop(1, '#2c7f3d');

      ctx.fillStyle = body;
      ctx.fillRect(p.x, 0, PIPE_W, p.top);
      ctx.fillRect(p.x, botY, PIPE_W, H - GROUND - botY);

      /* Lips. */
      ctx.fillStyle = '#2e8c42';
      ctx.fillRect(p.x - 5, p.top - 20, PIPE_W + 10, 20);
      ctx.fillRect(p.x - 5, botY, PIPE_W + 10, 20);
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(p.x - 5, p.top - 20, PIPE_W + 10, 4);
      ctx.fillRect(p.x - 5, botY, PIPE_W + 10, 4);
    }

    function drawBird() {
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.rot);

      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      /* Wing flaps with vertical speed. */
      var wing = started && !dead ? Math.sin(performance.now() / 70) * 4 : 0;
      ctx.fillStyle = '#f0a91c';
      ctx.beginPath();
      ctx.ellipse(-3, 1 + wing, 8, 5.5, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(6, -4, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16233d';
      ctx.beginPath();
      ctx.arc(7.6, -4, 2.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff8b3d';
      ctx.beginPath();
      ctx.moveTo(13, -1);
      ctx.lineTo(22, 2);
      ctx.lineTo(13, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2b6fb5');
      sky.addColorStop(0.62, '#63b8e0');
      sky.addColorStop(1, '#a8dcef');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      /* Parallax hills. */
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      for (var h = -1; h < 3; h++) {
        var hx = h * 220 - hillX;
        ctx.beginPath();
        ctx.arc(hx + 80, H - GROUND + 18, 84, Math.PI, 0);
        ctx.fill();
      }

      pipes.forEach(drawPipe);

      ctx.fillStyle = '#c9a05a';
      ctx.fillRect(0, H - GROUND, W, GROUND);
      ctx.fillStyle = '#7fbe4f';
      ctx.fillRect(0, H - GROUND, W, 14);
      ctx.fillStyle = '#69a63f';
      for (var g = -1; g * 24 - groundX < W; g++) {
        ctx.fillRect(g * 24 - groundX, H - GROUND + 10, 12, 4);
      }

      drawBird();

      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.font = '700 46px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(score), W / 2 + 2, 76);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(score), W / 2, 74);

      if (!started) {
        ctx.fillStyle = 'rgba(6,12,26,.55)';
        U.roundRect(ctx, W / 2 - 128, H / 2 + 40, 256, 62, 12);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 17px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('Tap or press Space', W / 2, H / 2 + 68);
        ctx.font = '400 13px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillText('to start flying', W / 2, H / 2 + 88);
      }

      if (flash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.75) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }

    api.hudInit(['Score', 'Best']);
    reset();

    api.onKey(function (e) {
      if (e.key === ' ' || e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        flap();
      }
    });
    api.on(cv.el, 'mousedown', function (e) { e.preventDefault(); flap(); });
    api.on(cv.el, 'touchstart', function (e) { e.preventDefault(); flap(); }, { passive: false });

    api.buttons([{ label: '🐤 Flap', wide: true, onClick: flap }], 'touch-only');

    api.loop(function (dt) { update(dt); draw(); });
  }
});

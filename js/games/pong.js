/* Ping Pong — player vs. CPU, first to 7. */
GameHub.register({
  id: 'pong',
  name: 'Ping Pong',
  emoji: '🏓',
  category: 'Arcade',
  desc: 'Classic paddle duel against the CPU. First to 7 wins.',
  controls: '<kbd>↑</kbd><kbd>↓</kbd> / <kbd>W</kbd><kbd>S</kbd> or move the mouse',
  scoreLabel: 'Wins',

  mount: function (api) {
    var W = 620, H = 380, PW = 12, PH = 74, TARGET = 7;
    var cv = api.canvas(W, H);
    var ctx = cv.ctx;
    var U = GameHub.util;

    var player, cpu, ball, scoreP, scoreC, over, serveIn, trail;

    /* The CPU tracks the ball with a capped speed and a small aim error, so it
     * is beatable but not obviously dumb. Both scale with the rally length. */
    var cpuSpeed = 300, cpuError = 26;

    function reset() {
      player = { y: H / 2 - PH / 2, vy: 0 };
      cpu = { y: H / 2 - PH / 2 };
      scoreP = 0; scoreC = 0;
      over = false;
      trail = [];
      cpuSpeed = 300; cpuError = 26;
      serve(Math.random() < 0.5 ? 1 : -1);
      api.hud('You', 0);
      api.hud('CPU', 0);
      api.hud('Wins', api.best());
    }

    function serve(dir) {
      ball = {
        x: W / 2, y: H / 2,
        vx: dir * 300,
        vy: (Math.random() * 2 - 1) * 150,
        r: 7
      };
      serveIn = 0.8;
      trail = [];
    }

    function point(who) {
      if (who === 'p') { scoreP++; GameHub.sound.ok(); }
      else { scoreC++; GameHub.sound.tone(200, 0.14, 'sawtooth'); }
      api.hud('You', scoreP);
      api.hud('CPU', scoreC);

      if (scoreP >= TARGET || scoreC >= TARGET) {
        over = true;
        var won = scoreP >= TARGET;
        if (won) api.submit(api.best() + 1);
        api.overlay({
          emoji: won ? '🏆' : '😵',
          title: won ? 'You win!' : 'CPU wins',
          lines: [scoreP + ' — ' + scoreC, 'Match wins: ' + api.best()],
          buttons: [
            { label: 'Rematch', primary: true, onClick: reset },
            { label: 'Hub', onClick: api.exit }
          ]
        });
        if (won) GameHub.sound.win();
        return;
      }
      serve(who === 'p' ? -1 : 1);
    }

    function update(dt) {
      if (over) return;

      /* Player: keyboard velocity, or the mouse handler writes y directly. */
      var up = api.keys.ArrowUp || api.keys.w || api.keys.W;
      var dn = api.keys.ArrowDown || api.keys.s || api.keys.S;
      if (up) player.y -= 430 * dt;
      if (dn) player.y += 430 * dt;
      player.y = U.clamp(player.y, 0, H - PH);

      if (serveIn > 0) { serveIn -= dt; return; }

      /* CPU chases the ball's y, only committing once it's incoming. */
      var targetY = ball.vx > 0
        ? ball.y - PH / 2 + Math.sin(ball.x / 40) * cpuError
        : H / 2 - PH / 2;
      var diff = targetY - cpu.y;
      cpu.y += U.clamp(diff, -cpuSpeed * dt, cpuSpeed * dt);
      cpu.y = U.clamp(cpu.y, 0, H - PH);

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      trail.unshift({ x: ball.x, y: ball.y });
      if (trail.length > 9) trail.pop();

      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; blip(); }
      if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy *= -1; blip(); }

      hitPaddle(20, player.y, 1);
      hitPaddle(W - 20 - PW, cpu.y, -1);

      if (ball.x < -30) point('c');
      else if (ball.x > W + 30) point('p');
    }

    function blip() { GameHub.sound.tone(420, 0.03, 'square', 0.025); }

    /* Deflection angle depends on where the ball meets the paddle — the
     * detail that makes Pong a game of aim rather than reflex alone. */
    function hitPaddle(px, py, dir) {
      if (dir > 0 ? ball.vx > 0 : ball.vx < 0) return;
      if (ball.x + ball.r < px || ball.x - ball.r > px + PW) return;
      if (ball.y + ball.r < py || ball.y - ball.r > py + PH) return;

      var rel = (ball.y - (py + PH / 2)) / (PH / 2);
      var speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.06, 760);
      var angle = rel * 0.9;

      ball.vx = dir * speed * Math.cos(angle);
      ball.vy = speed * Math.sin(angle);
      ball.x = dir > 0 ? px + PW + ball.r : px - ball.r;

      /* Every exchange nudges the CPU up a notch. */
      cpuSpeed = Math.min(cpuSpeed + 9, 470);
      cpuError = Math.max(cpuError - 0.8, 6);
      GameHub.sound.tone(dir > 0 ? 560 : 470, 0.04, 'square', 0.03);
    }

    function draw() {
      ctx.fillStyle = '#070a15';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(110,231,255,.18)';
      ctx.lineWidth = 3;
      ctx.setLineDash([11, 15]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(232,236,255,.07)';
      ctx.font = '800 92px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(scoreP), W / 2 - 74, 96);
      ctx.fillText(String(scoreC), W / 2 + 74, 96);

      trail.forEach(function (t, i) {
        ctx.fillStyle = 'rgba(110,231,255,' + (0.16 * (1 - i / trail.length)) + ')';
        ctx.beginPath();
        ctx.arc(t.x, t.y, ball.r * (1 - i / (trail.length * 1.7)), 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#6ee7ff';
      U.roundRect(ctx, 20, player.y, PW, PH, 6);
      ctx.fill();
      ctx.fillStyle = '#ff5c8a';
      U.roundRect(ctx, W - 20 - PW, cpu.y, PW, PH, 6);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();

      if (serveIn > 0 && !over) {
        ctx.fillStyle = 'rgba(232,236,255,.7)';
        ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('First to ' + TARGET, W / 2, H - 26);
      }
    }

    api.hudInit(['You', 'CPU', 'Wins']);
    reset();

    api.onKey(function (e) {
      if (['ArrowUp', 'ArrowDown'].indexOf(e.key) >= 0) e.preventDefault();
    });

    /* Mouse and touch both drive the paddle directly. */
    function follow(e) {
      var p = api.canvasPoint(cv, e);
      player.y = U.clamp(p.y - PH / 2, 0, H - PH);
    }
    api.on(cv.el, 'mousemove', follow);
    api.on(cv.el, 'touchmove', function (e) { e.preventDefault(); follow(e); }, { passive: false });
    api.on(cv.el, 'touchstart', function (e) { e.preventDefault(); follow(e); }, { passive: false });

    api.loop(function (dt) { update(dt); draw(); });
  }
});

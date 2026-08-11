/* Simon — colour/tone sequence memory. */
GameHub.register({
  id: 'simon',
  name: 'Simon',
  emoji: '🎵',
  category: 'Memory',
  desc: 'Repeat the colour sequence. It gets one longer every round.',
  controls: 'Click the pads · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> also work',

  mount: function (api) {
    var U = GameHub.util;

    var PADS = [
      { color: '#4ade80', lit: '#bbf7d0', freq: 329.6, key: '1' },
      { color: '#f43f5e', lit: '#fda4af', freq: 415.3, key: '2' },
      { color: '#facc15', lit: '#fef08a', freq: 493.9, key: '3' },
      { color: '#22d3ee', lit: '#a5f3fc', freq: 261.6, key: '4' }
    ];

    var seq, inputIdx, accepting, strict, round;

    var board = api.el('div', 'board');
    board.style.gridTemplateColumns = 'repeat(2, 116px)';
    board.style.gridAutoRows = '116px';
    board.style.gap = '10px';

    var els = PADS.map(function (p, i) {
      var el = api.el('div', 'cell');
      el.style.background = p.color;
      el.style.opacity = '.55';
      el.style.border = 'none';
      el.style.transition = 'opacity .1s, transform .1s';
      el.style.borderRadius = i === 0 ? '90px 14px 14px 14px'
        : i === 1 ? '14px 90px 14px 14px'
        : i === 2 ? '14px 14px 14px 90px'
        : '14px 14px 90px 14px';
      api.on(el, 'pointerdown', function () { press(i); });
      board.appendChild(el);
      return el;
    });

    var msg = api.el('div', 'msg');
    api.mount(board);
    api.mount(msg);

    var strictBtn = api.el('button', 'gbtn', 'Strict: off');
    strictBtn.type = 'button';
    api.on(strictBtn, 'click', function () {
      strict = !strict;
      strictBtn.textContent = 'Strict: ' + (strict ? 'on' : 'off');
      strictBtn.classList.toggle('on', strict);
    });
    var bar = api.el('div', 'btn-bar');
    bar.appendChild(strictBtn);
    api.mount(bar);

    function flash(i, dur) {
      els[i].style.opacity = '1';
      els[i].style.transform = 'scale(1.04)';
      els[i].style.boxShadow = '0 0 26px ' + PADS[i].color;
      GameHub.sound.tone(PADS[i].freq, dur / 1000 * 0.9, 'sine', 0.07);
      api.timeout(function () {
        els[i].style.opacity = '.55';
        els[i].style.transform = 'scale(1)';
        els[i].style.boxShadow = 'none';
      }, dur);
    }

    function reset() {
      seq = [];
      round = 0;
      strict = strict || false;
      api.hud('Round', 0);
      api.hud('Best', api.best());
      nextRound();
    }

    function nextRound() {
      accepting = false;
      inputIdx = 0;
      seq.push(U.rand(4));
      round = seq.length;
      api.hud('Round', round);
      msg.innerHTML = 'Watch — <strong>' + round + '</strong> step' + (round > 1 ? 's' : '');

      /* Playback speeds up as the sequence grows, but never below 240ms. */
      var step = Math.max(240, 620 - seq.length * 22);
      seq.forEach(function (p, k) {
        api.timeout(function () { flash(p, step * 0.6); }, 550 + k * step);
      });
      api.timeout(function () {
        accepting = true;
        msg.innerHTML = '<strong>Your turn</strong>';
      }, 550 + seq.length * step);
    }

    function press(i) {
      if (!accepting) return;
      flash(i, 200);

      if (seq[inputIdx] === i) {
        inputIdx++;
        if (inputIdx === seq.length) {
          accepting = false;
          msg.innerHTML = '✅ <strong>Correct</strong>';
          api.submit(round);
          api.hud('Best', api.best());
          api.timeout(nextRound, 800);
        }
        return;
      }

      /* Wrong pad. */
      accepting = false;
      GameHub.sound.bad();
      if (strict || seq.length === 1) {
        api.gameOver({
          emoji: '🎵',
          title: 'Wrong pad',
          score: round,
          scoreLabel: 'Rounds',
          buttons: [
            { label: 'Play again', primary: true, onClick: reset },
            { label: 'Hub', onClick: api.exit }
          ]
        });
        return;
      }

      /* Forgiving mode: replay the same sequence instead of ending the run. */
      msg.innerHTML = '❌ <strong>Not quite</strong> — replaying';
      seq.pop();
      api.timeout(nextRound, 1000);
    }

    api.hudInit(['Round', 'Best']);
    reset();

    api.onKey(function (e) {
      var idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0) press(idx);
    });
  }
});

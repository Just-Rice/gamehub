/* Hangman — word guessing with a drawn gallows and a hint per word. */
GameHub.register({
  id: 'hangman',
  name: 'Hangman',
  emoji: '🪢',
  category: 'Word',
  desc: 'Guess the word before the drawing finishes. Six misses allowed.',
  controls: 'Type a letter, or click the on-screen keyboard',
  scoreLabel: 'Wins',

  mount: function (api) {
    var U = GameHub.util;
    var MAX_MISSES = 6;

    var WORDS = [
      ['GUITAR', 'Six strings'], ['VOLCANO', 'It erupts'], ['PENGUIN', 'Flightless bird'],
      ['LIBRARY', 'Full of books'], ['DIAMOND', 'Hardest gem'], ['COMPILER', 'Turns code into a program'],
      ['GRAVITY', 'Keeps you down'], ['OCTOPUS', 'Eight arms'], ['MARATHON', '42 kilometres'],
      ['PYRAMID', 'Ancient tomb'], ['TORNADO', 'Spinning storm'], ['KEYBOARD', 'You type on it'],
      ['SANDWICH', 'Lunch between bread'], ['ELEPHANT', 'Largest land animal'],
      ['TELESCOPE', 'Looks at stars'], ['CHOCOLATE', 'From cacao'], ['UMBRELLA', 'For rainy days'],
      ['DINOSAUR', 'Extinct giant'], ['HARMONICA', 'Pocket instrument'], ['SATELLITE', 'Orbits a planet'],
      ['GLACIER', 'Slow river of ice'], ['JUNGLE', 'Dense forest'], ['CACTUS', 'Desert plant'],
      ['ANCHOR', 'Holds a ship'], ['BICYCLE', 'Two wheels'], ['CASTLE', 'Fortified home'],
      ['DOLPHIN', 'Clever sea mammal'], ['FALCON', 'Fast hunting bird'], ['MAGNET', 'Attracts iron'],
      ['NEBULA', 'Cloud of space dust'], ['ORCHID', 'Elegant flower'], ['PIANO', '88 keys'],
      ['QUARTZ', 'Common crystal'], ['RAINBOW', 'After the rain'], ['SUBMARINE', 'Travels underwater'],
      ['TRUMPET', 'Brass instrument'], ['VIOLIN', 'Played with a bow'], ['WALRUS', 'Tusked sea mammal'],
      ['ZEPPELIN', 'Rigid airship'], ['ALGORITHM', 'Step-by-step recipe'],
      ['BROWSER', 'Renders web pages'], ['CIPHER', 'Hides a message'],
      ['DATABASE', 'Stores records'], ['FIREWALL', 'Blocks traffic'],
      ['NETWORK', 'Connected machines'], ['PIXEL', 'Smallest picture element'],
      ['ROBOTICS', 'Machines that move'], ['VARIABLE', 'Holds a value'],
      ['AVALANCHE', 'Snow rushing down'], ['BLIZZARD', 'Fierce snowstorm'],
      ['COMPASS', 'Points north'], ['DESERT', 'Very dry place'],
      ['EQUATOR', 'Zero degrees latitude'], ['FOSSIL', 'Preserved remains'],
      ['HORIZON', 'Where sky meets land'], ['ISLAND', 'Land ringed by water'],
      ['LANTERN', 'Portable light'], ['METEOR', 'Shooting star'],
      ['PLANKTON', 'Drifting sea life'], ['SAFFRON', 'Costly spice']
    ];

    var word, hint, guessed, misses, over, keyEls;

    var cv = api.canvas(230, 250, { maxWidth: 230 });
    var ctx = cv.ctx;

    var wordEl = api.el('div', 'mono');
    wordEl.style.cssText =
      'font-size:min(30px, 5.6vw);letter-spacing:.24em;font-weight:800;text-align:center;min-height:40px';
    api.mount(wordEl);

    var hintEl = api.el('div', 'msg');
    api.mount(hintEl);

    var kb = api.el('div', 'keyboard');
    api.mount(kb);
    keyEls = {};
    ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].forEach(function (row) {
      var rowEl = api.el('div', 'krow');
      row.split('').forEach(function (ch) {
        var b = api.el('button', 'key', ch);
        b.type = 'button';
        api.on(b, 'click', function () { guess(ch); });
        keyEls[ch] = b;
        rowEl.appendChild(b);
      });
      kb.appendChild(rowEl);
    });

    function reset() {
      var entry = U.pick(WORDS);
      word = entry[0];
      hint = entry[1];
      guessed = {};
      misses = 0;
      over = false;

      Object.keys(keyEls).forEach(function (k) {
        keyEls[k].disabled = false;
        keyEls[k].className = 'key';
      });

      hintEl.innerHTML = 'Hint: <strong>' + hint + '</strong>';
      api.hud('Misses', '0/' + MAX_MISSES);
      api.hud('Wins', api.best());
      api.closeOverlay();
      render();
    }

    function display() {
      return word.split('').map(function (ch) {
        if (ch === ' ') return ' ';
        return guessed[ch] ? ch : '_';
      }).join(' ');
    }

    function guess(ch) {
      if (over || guessed[ch]) return;
      guessed[ch] = true;
      keyEls[ch].disabled = true;

      if (word.indexOf(ch) >= 0) {
        keyEls[ch].classList.add('hit');
        GameHub.sound.tone(620, 0.06, 'triangle', 0.03);
        if (word.split('').every(function (c) { return guessed[c]; })) return win();
      } else {
        keyEls[ch].classList.add('miss');
        misses++;
        api.hud('Misses', misses + '/' + MAX_MISSES);
        GameHub.sound.tone(200 - misses * 12, 0.1, 'sawtooth', 0.03);
        if (misses >= MAX_MISSES) return lose();
      }
      render();
    }

    function win() {
      over = true;
      api.submit(api.best() + 1);
      api.hud('Wins', api.best());
      GameHub.sound.win();
      render();
      api.overlay({
        emoji: '🎉', title: 'You got it!',
        lines: [word, 'Misses: ' + misses + '/' + MAX_MISSES],
        buttons: [
          { label: 'Next word', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    function lose() {
      over = true;
      GameHub.sound.bad();
      render();
      /* Reveal the answer — the whole point of the reveal is seeing the word. */
      Object.keys(keyEls).forEach(function (k) {
        if (word.indexOf(k) >= 0 && !keyEls[k].classList.contains('hit')) {
          keyEls[k].classList.add('near');
        }
      });
      wordEl.textContent = word.split('').join(' ');
      api.overlay({
        emoji: '💀', title: 'Out of guesses',
        lines: ['The word was ' + word + '.'],
        buttons: [
          { label: 'New word', primary: true, onClick: reset },
          { label: 'Hub', onClick: api.exit }
        ]
      });
    }

    /* One body part per miss, drawn in order. */
    function render() {
      wordEl.textContent = display();

      ctx.clearRect(0, 0, 230, 250);
      ctx.strokeStyle = '#8b93b8';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';

      /* Gallows is always visible. */
      line(24, 234, 150, 234);
      line(58, 234, 58, 26);
      line(58, 26, 152, 26);
      line(152, 26, 152, 52);
      line(58, 60, 92, 26);

      ctx.strokeStyle = '#ff5c8a';
      ctx.lineWidth = 5;

      if (misses > 0) {
        ctx.beginPath();
        ctx.arc(152, 74, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (misses > 1) line(152, 96, 152, 158);         /* body */
      if (misses > 2) line(152, 110, 122, 138);        /* left arm */
      if (misses > 3) line(152, 110, 182, 138);        /* right arm */
      if (misses > 4) line(152, 158, 126, 200);        /* left leg */
      if (misses > 5) line(152, 158, 178, 200);        /* right leg */

      if (misses >= MAX_MISSES) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#e8ecff';
        line(145, 69, 151, 75); line(151, 69, 145, 75);
        line(153, 69, 159, 75); line(159, 69, 153, 75);
      }
    }

    function line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    api.hudInit(['Misses', 'Wins']);
    reset();

    api.onKey(function (e) {
      var ch = (e.key || '').toUpperCase();
      if (ch.length === 1 && ch >= 'A' && ch <= 'Z') guess(ch);
    });
  }
});

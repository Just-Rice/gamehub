/* Wordle — five letters, six guesses, keyboard heatmap. */
GameHub.register({
  id: 'wordle',
  name: 'Wordle',
  emoji: '🟩',
  category: 'Word',
  desc: 'Six tries to find the five-letter word. Green, yellow, grey.',
  controls: 'Type letters · <kbd>Enter</kbd> submits · <kbd>Backspace</kbd> deletes',
  scoreLabel: 'Wins',

  mount: function (api) {
    var U = GameHub.util;
    var LEN = 5, TRIES = 6;

    var WORDS = ('about above actor acute admit adopt adult after again agent agree ahead ' +
      'alarm album alert alike alive allow alone along alter among anger angle angry ankle ' +
      'apart apple apply april arena argue arise armor array arrow aside asset audio audit ' +
      'avoid awake award aware badly baker basic basin batch beach beard beast begin being ' +
      'below bench birth black blade blame blank blast blaze bleak blend bless blind block ' +
      'blood bloom board boast bonus boost booth bound brain brand brass brave bread break ' +
      'breed brick bride brief bring broad broke brook brown brush build built bunch burnt ' +
      'burst cabin cable canal candy canoe cargo carry carve catch cause chain chair chalk ' +
      'charm chart chase cheap check cheek cheer chess chest chief child chill china choir ' +
      'chose cider civic civil claim clash class clean clear clerk click cliff climb cling ' +
      'clock close cloth cloud clown coach coast cobra colon color comet comic coral corner ' +
      'couch cough could count court cover crack craft crane crash crawl crazy cream creek ' +
      'crest crime crisp cross crowd crown crude cruel crush curve cycle daily dairy dance ' +
      'dated dealt death debut decay decor delay delta dense depth diary digit dirty disco ' +
      'ditch diver dizzy dodge doing donor doubt dough dozen draft drain drama drank drawn ' +
      'dream dress dried drift drill drink drive drone drove drown eager eagle early earth ' +
      'eight elbow elder elect elite email empty enemy enjoy enter entry equal equip error ' +
      'essay event every exact exams exist extra fable faced faint fairy faith false fancy ' +
      'fatal fault favor feast fence ferry fetch fever fiber field fiery fifth fifty fight ' +
      'final first flame flash fleet flesh float flock flood floor flour fluid flush focus ' +
      'force forge forth forty forum found frame fraud fresh fried front frost fruit fully ' +
      'funny giant given glass glide globe glory glove going grace grade grain grand grant ' +
      'grape graph grasp grass grave great greed green greet grief grill grind groan gross ' +
      'group grove grown guard guess guest guide guilt habit hairy handy happy harsh haste ' +
      'hatch haunt heard heart heavy hedge hello hence hobby holly honey honor horse hotel ' +
      'house human humid humor hurry ideal image imply index inner input irony issue ivory ' +
      'jelly jewel joint jolly judge juice jumbo knife knock known label labor lance large ' +
      'laser later laugh layer learn lease least leave legal lemon level lever light limit ' +
      'linen liver lobby local lodge logic loose lorry lower loyal lucky lunar lunch lying ' +
      'magic major maker maple march marsh match maybe mayor meant medal media mercy merge ' +
      'merit metal meter midst might mimic minor minus mixed model moist money month moral ' +
      'motor mount mourn mouse mouth movie music nasty naval nerve never newly night noble ' +
      'noise north notch noted novel nurse ocean offer often olive onion opera orbit order ' +
      'organ other ought ounce outer owner oxide paint panel panic paper party pasta patch ' +
      'pause peace peach pearl pedal penny perch phase phone photo piano piece pilot pinch ' +
      'pitch pivot pixel pizza place plain plane plant plate plaza plead plumb point polar ' +
      'porch pound power press price pride prime print prior prize probe prone proof proud ' +
      'prove pulse punch pupil puppy purse queen query quest queue quick quiet quilt quite ' +
      'quote radar radio raise rally ranch range rapid ratio reach react ready realm rebel ' +
      'refer reign relax relay renew reply rider ridge rifle right rigid rinse risky rival ' +
      'river roast robin robot rocky roman rough round route royal rugby ruler rumor rural ' +
      'saint salad salon sandy sauce scale scarf scene scent scope score scout scrap screw ' +
      'sense serve seven shade shaft shake shall shame shape share shark sharp sheep sheer ' +
      'sheet shelf shell shift shine shiny shirt shock shoot shore short shout shown shrug ' +
      'sight silly since siren sixth skill skirt slate sleep slice slide slope small smart ' +
      'smash smell smile smoke snack snake sneak solar solid solve sorry sound south space ' +
      'spare spark speak speed spell spend spent spice spike spine spite split spoke spoon ' +
      'sport spray squad squat stack staff stage stain stair stake stale stamp stand stare ' +
      'start state steal steam steel steep steer stern stick stiff still sting stock stole ' +
      'stone stood stool store storm story stove strap straw strip stuck study stuff style ' +
      'sugar suite sunny super surge sweat sweep sweet swift swing sword table taken talent ' +
      'tally taste teach tempo tenth thank theft their theme there these thick thief thing ' +
      'think third thorn those three threw throw thumb tiger tight timer tired title toast ' +
      'today token tooth topic torch total touch tough tower toxic trace track trade trail ' +
      'train trait tramp trash treat trend trial tribe trick tried tries troop truck truly ' +
      'trunk trust truth tulip tumor tutor twice twist ultra uncle under union unite unity ' +
      'until upper upset urban urged usage usual vague valid value valve vapor vault venue ' +
      'verse video vigor villa vinyl viral virus visit vital vivid vocal voice voter wagon ' +
      'waist waste watch water weary weave wedge weigh weird whale wheat wheel where which ' +
      'while white whole whose widen width windy witch woman world worry worse worst worth ' +
      'would wound woven wrist write wrong yacht yield young youth zebra').toUpperCase()
      .split(/\s+/).filter(function (w) { return w.length === LEN; });

    var SET = {};
    WORDS.forEach(function (w) { SET[w] = true; });

    var answer, guesses, current, over, stats, keyEls;

    var gridEl = api.el('div', 'board');
    gridEl.style.gridTemplateColumns = 'repeat(' + LEN + ', 56px)';
    gridEl.style.gridAutoRows = '56px';
    gridEl.style.gap = '6px';
    api.mount(gridEl);

    var tiles = [];
    for (var i = 0; i < TRIES * LEN; i++) {
      var t = api.el('div', 'cell');
      t.style.fontSize = '26px';
      t.style.cursor = 'default';
      tiles.push(t);
      gridEl.appendChild(t);
    }

    var msg = api.el('div', 'msg');
    api.mount(msg);

    var kb = api.el('div', 'keyboard');
    api.mount(kb);
    keyEls = {};
    [['QWERTYUIOP'], ['ASDFGHJKL'], ['↵ZXCVBNM⌫']].forEach(function (spec) {
      var rowEl = api.el('div', 'krow');
      spec[0].split('').forEach(function (ch) {
        var label = ch === '↵' ? 'ENTER' : ch === '⌫' ? 'DEL' : ch;
        var b = api.el('button', 'key' + (ch === '↵' || ch === '⌫' ? ' wide' : ''), label);
        b.type = 'button';
        api.on(b, 'click', function () {
          if (ch === '↵') submit();
          else if (ch === '⌫') backspace();
          else type(ch);
        });
        if (ch !== '↵' && ch !== '⌫') keyEls[ch] = b;
        rowEl.appendChild(b);
      });
      kb.appendChild(rowEl);
    });

    stats = GameHub.store.get('wordle:stats', { played: 0, won: 0, streak: 0, best: 0 });

    function reset() {
      answer = U.pick(WORDS);
      guesses = [];
      current = '';
      over = false;
      tiles.forEach(function (t) {
        t.textContent = '';
        t.style.background = '';
        t.style.borderColor = '';
        t.style.color = '';
      });
      Object.keys(keyEls).forEach(function (k) { keyEls[k].className = 'key'; });
      msg.textContent = 'Guess the five-letter word.';
      api.hud('Guess', '1/' + TRIES);
      api.hud('Streak', stats.streak);
      api.hud('Wins', api.best());
      api.closeOverlay();
      paintCurrent();
    }

    function paintCurrent() {
      var row = guesses.length;
      if (row >= TRIES) return;
      for (var c = 0; c < LEN; c++) {
        var t = tiles[row * LEN + c];
        t.textContent = current[c] || '';
        t.style.borderColor = current[c] ? '#4a5487' : '';
      }
    }

    function type(ch) {
      if (over || current.length >= LEN) return;
      current += ch;
      GameHub.sound.tone(400, 0.025, 'triangle', 0.02);
      paintCurrent();
    }

    function backspace() {
      if (over || !current.length) return;
      current = current.slice(0, -1);
      paintCurrent();
    }

    function shakeRow() {
      var row = guesses.length;
      for (var c = 0; c < LEN; c++) {
        (function (t) {
          t.style.transform = 'translateX(-5px)';
          api.timeout(function () { t.style.transform = 'translateX(5px)'; }, 70);
          api.timeout(function () { t.style.transform = ''; }, 140);
        })(tiles[row * LEN + c]);
      }
      GameHub.sound.tone(160, 0.08, 'sawtooth', 0.025);
    }

    /* Two passes so repeated letters score the way players expect: exact
     * matches claim their letter first, then the leftovers can go yellow. */
    function score(guess) {
      var result = new Array(LEN).fill('absent');
      var pool = {};
      for (var i = 0; i < LEN; i++) {
        if (guess[i] === answer[i]) result[i] = 'hit';
        else pool[answer[i]] = (pool[answer[i]] || 0) + 1;
      }
      for (i = 0; i < LEN; i++) {
        if (result[i] === 'hit') continue;
        if (pool[guess[i]] > 0) { result[i] = 'near'; pool[guess[i]]--; }
      }
      return result;
    }

    function submit() {
      if (over) return;
      if (current.length < LEN) { msg.textContent = 'Needs ' + LEN + ' letters.'; return shakeRow(); }
      if (!SET[current]) { msg.textContent = '“' + current + '” is not in the word list.'; return shakeRow(); }

      var guess = current;
      var res = score(guess);
      var row = guesses.length;
      guesses.push({ word: guess, res: res });
      current = '';
      msg.textContent = '';

      /* Reveal tile by tile. */
      res.forEach(function (r, c) {
        api.timeout(function () {
          var t = tiles[row * LEN + c];
          t.textContent = guess[c];
          t.style.background = r === 'hit' ? '#4ade80' : r === 'near' ? '#facc15' : '#222842';
          t.style.borderColor = 'transparent';
          t.style.color = r === 'absent' ? '#8a93bd' : '#08131f';
          GameHub.sound.tone(r === 'hit' ? 660 : r === 'near' ? 520 : 300, 0.05, 'triangle', 0.025);

          var kEl = keyEls[guess[c]];
          if (kEl) {
            /* Never downgrade a key that already showed a better result. */
            var rank = { absent: 1, near: 2, hit: 3 };
            var cur = kEl.classList.contains('hit') ? 'hit'
              : kEl.classList.contains('near') ? 'near'
              : kEl.classList.contains('absent') ? 'absent' : null;
            if (!cur || rank[r] > rank[cur]) {
              kEl.className = 'key ' + r;
            }
          }
        }, c * 180);
      });

      api.timeout(function () {
        api.hud('Guess', Math.min(guesses.length + 1, TRIES) + '/' + TRIES);
        if (guess === answer) return finish(true);
        if (guesses.length >= TRIES) return finish(false);
      }, LEN * 180 + 120);
    }

    function shareGrid() {
      return guesses.map(function (g) {
        return g.res.map(function (r) {
          return r === 'hit' ? '🟩' : r === 'near' ? '🟨' : '⬛';
        }).join('');
      }).join('\n');
    }

    function finish(won) {
      over = true;
      stats.played++;
      if (won) {
        stats.won++;
        stats.streak++;
        stats.best = Math.max(stats.best, stats.streak);
        api.submit(api.best() + 1);
        GameHub.sound.win();
      } else {
        stats.streak = 0;
        GameHub.sound.bad();
      }
      GameHub.store.set('wordle:stats', stats);
      api.hud('Streak', stats.streak);
      api.hud('Wins', api.best());

      var lines = won
        ? ['Solved in ' + guesses.length + '/' + TRIES, 'Streak: ' + stats.streak +
           ' (best ' + stats.best + ')']
        : ['The word was ' + answer + '.'];
      lines.push(shareGrid());

      api.overlay({
        emoji: won ? '🟩' : '⬛',
        title: won ? ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'][guesses.length - 1]
                   : 'Out of guesses',
        lines: lines,
        buttons: [
          { label: 'New word', primary: true, onClick: reset },
          {
            label: 'Copy result',
            onClick: function () {
              var text = 'GameHub Wordle ' + (won ? guesses.length : 'X') + '/' + TRIES +
                '\n' + shareGrid();
              if (navigator.clipboard) navigator.clipboard.writeText(text);
              msg.textContent = 'Result copied.';
            }
          }
        ]
      });
    }

    api.hudInit(['Guess', 'Streak', 'Wins']);
    reset();

    api.onKey(function (e) {
      if (e.key === 'Enter') return submit();
      if (e.key === 'Backspace') { e.preventDefault(); return backspace(); }
      var ch = (e.key || '').toUpperCase();
      if (ch.length === 1 && ch >= 'A' && ch <= 'Z') type(ch);
    });
  }
});

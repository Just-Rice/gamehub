/* Hub shell: grid, filtering, launching and teardown. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var grid = $('grid'), stage = $('stage'), hudEl = $('hud');
  var playTitle = $('playTitle'), hint = $('hint');
  var searchEl = $('search'), chipsEl = $('chips');

  var session = null;
  var filter = { text: '', cat: 'All' };

  /* ----------------------------------------------------------- rendering */

  function categories() {
    var seen = ['All'];
    GameHub.games.forEach(function (g) {
      if (seen.indexOf(g.category) < 0) seen.push(g.category);
    });
    return seen;
  }

  function renderChips() {
    chipsEl.innerHTML = '';
    categories().forEach(function (cat) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (cat === filter.cat ? ' active' : '');
      b.textContent = cat;
      b.onclick = function () { filter.cat = cat; renderChips(); renderGrid(); };
      chipsEl.appendChild(b);
    });
  }

  function renderGrid() {
    var q = filter.text.trim().toLowerCase();
    var list = GameHub.games.filter(function (g) {
      if (filter.cat !== 'All' && g.category !== filter.cat) return false;
      if (!q) return true;
      return (g.name + ' ' + g.desc + ' ' + g.category).toLowerCase().indexOf(q) >= 0;
    });

    grid.innerHTML = '';
    if (!list.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'No games match “' + filter.text + '”.';
      grid.appendChild(e);
      return;
    }

    list.forEach(function (g) {
      var best = GameHub.store.get('best:' + g.id, null);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.innerHTML =
        '<span class="card-emoji">' + g.emoji + '</span>' +
        '<div class="card-name"></div>' +
        '<div class="card-desc"></div>' +
        '<div class="card-foot"><span class="tag"></span>' +
        '<span class="best"></span></div>';
      card.querySelector('.card-name').textContent = g.name;
      card.querySelector('.card-desc').textContent = g.desc;
      card.querySelector('.tag').textContent = g.category;
      if (best !== null) {
        card.querySelector('.best').textContent =
          (g.scoreLabel || 'Best') + ' ' + best;
      }
      card.onclick = function () { GameHub.sound.click(); launch(g.id); };
      grid.appendChild(card);
    });
  }

  /* ------------------------------------------------------------ launcher */

  function launch(id) {
    var def = GameHub.get(id);
    if (!def) return home();

    teardown();

    document.body.classList.add('playing');
    playTitle.textContent = def.emoji + ' ' + def.name;
    hudEl.innerHTML = '';
    stage.innerHTML = '';
    hint.innerHTML = def.controls || '';
    window.scrollTo(0, 0);
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);

    session = GameHub._createSession(def, stage, hudEl);
    try {
      def.mount(session);
    } catch (err) {
      console.error('[' + id + ']', err);
      stage.innerHTML = '<p class="msg">This game hit an error: ' +
        String(err && err.message || err) + '</p>';
    }
  }

  function teardown() {
    if (session) {
      try { session.destroy(); } catch (e) {}
      session = null;
    }
  }

  function home() {
    teardown();
    document.body.classList.remove('playing');
    stage.innerHTML = '';
    hudEl.innerHTML = '';
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    renderGrid();
  }

  GameHub.launch = launch;
  GameHub.home = home;

  /* --------------------------------------------------------------- chrome */

  $('backBtn').onclick = home;

  var soundBtn = $('soundBtn');
  function syncSound() {
    var on = GameHub.sound.enabled;
    soundBtn.textContent = on ? '🔊 Sound' : '🔇 Muted';
    soundBtn.classList.toggle('on', on);
  }
  soundBtn.onclick = function () {
    GameHub.sound.enabled = !GameHub.sound.enabled;
    syncSound();
    if (GameHub.sound.enabled) GameHub.sound.ok();
  };
  syncSound();

  $('resetBtn').onclick = function () {
    if (!confirm('Clear every saved high score?')) return;
    GameHub.games.forEach(function (g) {
      try { localStorage.removeItem('gh:best:' + g.id); } catch (e) {}
    });
    renderGrid();
  };

  searchEl.oninput = function () { filter.text = searchEl.value; renderGrid(); };

  /* Esc leaves a game; games themselves never bind Esc. */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('playing')) {
      e.preventDefault();
      home();
    }
    /* "/" focuses search from the hub. */
    if (e.key === '/' && !document.body.classList.contains('playing') &&
        document.activeElement !== searchEl) {
      e.preventDefault();
      searchEl.focus();
    }
  });

  /* Leaving the tab freezes the game instead of letting it run on unseen. */
  document.addEventListener('visibilitychange', function () {
    if (session) session.setPaused(document.hidden);
  });

  $('gameCount').textContent = GameHub.games.length + ' games';
  renderChips();
  renderGrid();

  /* Deep link: #snake opens straight into Snake. */
  var initial = location.hash.slice(1);
  if (initial && GameHub.get(initial)) launch(initial);
})();

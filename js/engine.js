/* GameHub mini-engine.
 *
 * Deliberately a classic script rather than an ES module: the whole project
 * then runs by double-clicking index.html, no dev server required.
 *
 * A game registers itself with GameHub.register({ id, name, ..., mount }).
 * mount(api) is called with a fresh session api and should return nothing;
 * everything it creates through the api is torn down automatically.
 */
(function () {
  'use strict';

  var games = [];

  /* ---------------------------------------------------------------- store */

  var store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem('gh:' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('gh:' + k, JSON.stringify(v)); } catch (e) {}
    }
  };

  /* ---------------------------------------------------------------- sound */

  var actx = null;
  var sound = {
    get enabled() { return store.get('sound', true); },
    set enabled(v) { store.set('sound', !!v); },

    tone: function (freq, dur, type, gain) {
      if (!sound.enabled) return;
      dur = dur || 0.08; type = type || 'square'; gain = gain || 0.04;
      try {
        if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        var t = actx.currentTime;
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) {}
    },

    /* Play [freq, startOffsetSeconds, duration] triples. */
    seq: function (notes, type) {
      notes.forEach(function (n) {
        setTimeout(function () { sound.tone(n[0], n[2] || 0.09, type); }, n[1] * 1000);
      });
    },

    blip: function () { sound.tone(660, 0.05, 'square'); },
    click: function () { sound.tone(420, 0.04, 'triangle'); },
    ok: function () { sound.seq([[523, 0], [784, 0.07]], 'triangle'); },
    win: function () { sound.seq([[523, 0], [659, 0.08], [784, 0.16], [1046, 0.24, 0.2]], 'triangle'); },
    bad: function () { sound.seq([[220, 0, 0.14], [165, 0.1, 0.2]], 'sawtooth'); }
  };

  /* -------------------------------------------------------------- session */

  /* One api per launch. Everything registered here is reversible so that
   * returning to the hub leaves no timers, listeners or audio behind. */
  function createSession(def, stage, hudEl) {
    var disposers = [];
    var rafId = null;
    var alive = true;
    var paused = false;
    var keys = Object.create(null);
    var hudFields = Object.create(null);

    function own(fn) { disposers.push(fn); }

    var api = {
      id: def.id,
      def: def,
      stage: stage,
      keys: keys,
      sound: sound,
      store: store,

      /* -- dom ---------------------------------------------------------- */

      el: function (tag, className, text) {
        var n = document.createElement(tag);
        if (className) n.className = className;
        if (text != null) n.textContent = text;
        return n;
      },

      mount: function (node) { stage.appendChild(node); return node; },

      /* Logical-resolution canvas, crisply scaled for the display. */
      canvas: function (w, h, opts) {
        opts = opts || {};
        var wrap = api.el('div', 'canvas-wrap');
        var cv = api.el('canvas');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.aspectRatio = w + ' / ' + h;
        if (opts.maxWidth) wrap.style.maxWidth = opts.maxWidth + 'px';
        else wrap.style.maxWidth = w + 'px';
        var ctx = cv.getContext('2d');
        ctx.scale(dpr, dpr);
        if (opts.pixelated) {
          ctx.imageSmoothingEnabled = false;
          cv.style.imageRendering = 'pixelated';
        }
        wrap.appendChild(cv);
        stage.appendChild(wrap);
        return { el: cv, wrap: wrap, ctx: ctx, w: w, h: h };
      },

      /* Map a pointer/touch event to logical canvas coordinates. */
      canvasPoint: function (cv, ev) {
        var r = cv.el.getBoundingClientRect();
        var p = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
        return {
          x: (p.clientX - r.left) / r.width * cv.w,
          y: (p.clientY - r.top) / r.height * cv.h
        };
      },

      /* -- loop --------------------------------------------------------- */

      /* fn(dt, now) with dt in seconds, clamped so a backgrounded tab does
       * not resume with one enormous step. Pausing freezes dt, not wall time. */
      loop: function (fn) {
        var last = performance.now();
        function frame(now) {
          if (!alive) return;
          var dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          if (!paused) fn(dt, now);
          rafId = requestAnimationFrame(frame);
        }
        rafId = requestAnimationFrame(frame);
        own(function () { if (rafId) cancelAnimationFrame(rafId); });
      },

      /* Fixed-interval logic tick (grid games). Returns a handle with .setRate */
      tick: function (ms, fn) {
        var acc = 0, rate = ms, last = performance.now(), id = null;
        function frame(now) {
          if (!alive) return;
          var dt = Math.min(now - last, 250);
          last = now;
          if (!paused) {
            acc += dt;
            while (acc >= rate) { acc -= rate; fn(); }
          }
          id = requestAnimationFrame(frame);
        }
        id = requestAnimationFrame(frame);
        own(function () { if (id) cancelAnimationFrame(id); });
        return {
          setRate: function (v) { rate = Math.max(16, v); },
          get rate() { return rate; }
        };
      },

      timeout: function (fn, ms) {
        var id = setTimeout(function () { if (alive) fn(); }, ms);
        own(function () { clearTimeout(id); });
        return id;
      },

      interval: function (fn, ms) {
        var id = setInterval(function () { if (alive) fn(); }, ms);
        own(function () { clearInterval(id); });
        return id;
      },

      get paused() { return paused; },
      setPaused: function (v) { paused = !!v; },

      /* -- input -------------------------------------------------------- */

      /* keys[] stays populated for polling; down/up fire for edge events.
       * Arrow keys and space are swallowed so the page never scrolls. */
      onKey: function (down, up) {
        function kd(e) {
          if (!alive) return;
          keys[e.key] = true;
          keys[e.code] = true;
          if (down) down(e);
        }
        function ku(e) {
          delete keys[e.key];
          delete keys[e.code];
          if (up) up(e);
        }
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        own(function () {
          window.removeEventListener('keydown', kd);
          window.removeEventListener('keyup', ku);
        });
      },

      on: function (target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        own(function () { target.removeEventListener(type, fn, opts); });
      },

      /* Tap + 4-way swipe, so every game is playable on a phone. */
      onSwipe: function (target, fn, tapFn) {
        var sx = 0, sy = 0, moved = false;
        api.on(target, 'touchstart', function (e) {
          var t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false;
        }, { passive: true });
        api.on(target, 'touchmove', function () { moved = true; }, { passive: true });
        api.on(target, 'touchend', function (e) {
          var t = e.changedTouches[0];
          var dx = t.clientX - sx, dy = t.clientY - sy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
            if (tapFn) tapFn(e);
            return;
          }
          if (!moved) return;
          fn(Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up'));
        }, { passive: true });
      },

      /* On-screen D-pad / button row for touch devices. */
      buttons: function (specs, className) {
        var bar = api.el('div', 'btn-bar ' + (className || ''));
        specs.forEach(function (s) {
          var b = api.el('button', 'gbtn', s.label);
          if (s.wide) b.classList.add('wide');
          b.type = 'button';
          api.on(b, 'click', function () { sound.click(); s.onClick(); });
          bar.appendChild(b);
        });
        stage.appendChild(bar);
        return bar;
      },

      dpad: function (fn) {
        var pad = api.el('div', 'dpad');
        [['↑', 'up', 'u'], ['←', 'left', 'l'], ['↓', 'down', 'd'], ['→', 'right', 'r']]
          .forEach(function (d) {
            var b = api.el('button', 'gbtn pad-' + d[2], d[0]);
            b.type = 'button';
            api.on(b, 'click', function () { fn(d[1]); });
            pad.appendChild(b);
          });
        stage.appendChild(pad);
        return pad;
      },

      /* -- hud ---------------------------------------------------------- */

      /* Declare the readouts once, then update by label. */
      hudInit: function (labels) {
        hudEl.innerHTML = '';
        labels.forEach(function (label) {
          var box = api.el('div', 'hud-item');
          box.appendChild(api.el('span', 'hud-label', label));
          var v = api.el('span', 'hud-value', '0');
          box.appendChild(v);
          hudEl.appendChild(box);
          hudFields[label] = v;
        });
      },

      hud: function (label, value) {
        if (hudFields[label]) hudFields[label].textContent = value;
      },

      /* -- scores ------------------------------------------------------- */

      best: function () { return store.get('best:' + def.id, 0); },

      /* Records a new personal best; returns true when the record moved.
       * `lowerIsBetter` games (times, move counts) invert the comparison. */
      submit: function (score) {
        var cur = store.get('best:' + def.id, null);
        var better = cur === null ||
          (def.lowerIsBetter ? score < cur : score > cur);
        if (better) { store.set('best:' + def.id, score); return true; }
        return false;
      },

      /* -- overlay ------------------------------------------------------ */

      /* Full-stage message with buttons. buttons: [{label, onClick, primary}] */
      overlay: function (opts) {
        api.closeOverlay();
        var ov = api.el('div', 'overlay');
        var card = api.el('div', 'overlay-card');
        if (opts.emoji) card.appendChild(api.el('div', 'overlay-emoji', opts.emoji));
        card.appendChild(api.el('h2', null, opts.title || ''));
        (opts.lines || []).forEach(function (l) {
          card.appendChild(api.el('p', null, l));
        });
        var row = api.el('div', 'overlay-actions');
        (opts.buttons || [{ label: 'Play again', onClick: function () { api.restart(); }, primary: true }])
          .forEach(function (b) {
            var btn = api.el('button', 'gbtn' + (b.primary ? ' primary' : ''), b.label);
            btn.type = 'button';
            api.on(btn, 'click', function () { sound.click(); api.closeOverlay(); b.onClick(); });
            row.appendChild(btn);
          });
        card.appendChild(row);
        ov.appendChild(card);
        stage.appendChild(ov);
        api._overlay = ov;
        return ov;
      },

      closeOverlay: function () {
        if (api._overlay && api._overlay.parentNode) {
          api._overlay.parentNode.removeChild(api._overlay);
        }
        api._overlay = null;
      },

      /* Convenience end-of-game overlay that handles the best-score line. */
      gameOver: function (opts) {
        opts = opts || {};
        var lines = (opts.lines || []).slice();
        if (opts.score != null) {
          var record = api.submit(opts.score);
          lines.unshift((opts.scoreLabel || 'Score') + ': ' + opts.score);
          if (record) lines.push('★ New best!');
          else lines.push('Best: ' + api.best());
          api.hud('Best', api.best());
        }
        if (opts.won) sound.win(); else sound.bad();
        api.overlay({
          emoji: opts.emoji || (opts.won ? '🏆' : '💀'),
          title: opts.title || (opts.won ? 'You win!' : 'Game over'),
          lines: lines,
          buttons: opts.buttons
        });
      },

      restart: function () { GameHub.launch(def.id); },
      exit: function () { GameHub.home(); },

      /* -- teardown ----------------------------------------------------- */

      destroy: function () {
        alive = false;
        api.closeOverlay();
        while (disposers.length) {
          try { disposers.pop()(); } catch (e) {}
        }
      }
    };

    return api;
  }

  /* ------------------------------------------------------------- helpers */

  var util = {
    clamp: function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    rand: function (n) { return Math.floor(Math.random() * n); },
    pick: function (arr) { return arr[util.rand(arr.length)]; },
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = util.rand(i + 1);
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    range: function (n) {
      var a = [];
      for (var i = 0; i < n; i++) a.push(i);
      return a;
    },
    grid: function (rows, cols, fill) {
      var g = [];
      for (var r = 0; r < rows; r++) {
        var row = [];
        for (var c = 0; c < cols; c++) {
          row.push(typeof fill === 'function' ? fill(r, c) : fill);
        }
        g.push(row);
      }
      return g;
    },
    /* Rounded rect path — used by nearly every canvas game. */
    roundRect: function (ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    fmtTime: function (sec) {
      var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
  };

  /* ----------------------------------------------------------------- api */

  var GameHub = {
    games: games,
    store: store,
    sound: sound,
    util: util,

    register: function (def) {
      games.push(def);
      return def;
    },

    get: function (id) {
      return games.filter(function (g) { return g.id === id; })[0];
    },

    /* Wired up by main.js once the DOM exists. */
    launch: function () {},
    home: function () {},

    _createSession: createSession
  };

  window.GameHub = GameHub;
})();

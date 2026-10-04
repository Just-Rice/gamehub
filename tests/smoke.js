#!/usr/bin/env node
/* Smoke test: the hub and every game load with no console errors and no
 * horizontal scroll, at a phone viewport and a desktop one.
 *
 * Needs Playwright with Chromium installed (`npm i -g playwright` or a local
 * install). Run from the repo root:  node tests/smoke.js
 * Point it at a deployed copy instead of the checkout with BASE=https://… */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var chromium = require('playwright').chromium;

var ROOT = path.join(__dirname, '..');
var TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

var VIEWPORTS = [
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1280, height: 800 } }
];

/* Games with a board-size picker are checked at every size, since the
 * biggest boards are the ones that used to spill off a phone screen. */
var SIZES = { minesweeper: ['Easy', 'Medium', 'Hard'], memory: ['4×4', '6×4', '6×6'] };

function serve() {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var rel = decodeURIComponent(req.url.split('?')[0]);
      var file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (file.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end(); }
      fs.readFile(file, function (err, data) {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', function () { resolve(server); });
  });
}

async function main() {
  var server = process.env.BASE ? null : await serve();
  var base = process.env.BASE || 'http://127.0.0.1:' + server.address().port + '/';
  var browser = await chromium.launch();
  var failures = [];

  for (var vp of VIEWPORTS) {
    var ctx = await browser.newContext(vp);
    var page = await ctx.newPage();
    var errors = [];
    page.on('console', function (m) { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', function (e) { errors.push(String(e)); });

    await page.goto(base);
    var ids = await page.evaluate(function () {
      return GameHub.games.map(function (g) { return g.id; });
    });

    async function check(label) {
      await page.waitForTimeout(250);
      /* Compare against the configured width, not innerWidth: mobile
       * emulation zooms out to fit wide content, which hides the overflow. */
      var overflow = await page.evaluate(function () {
        return document.documentElement.scrollWidth;
      }) - vp.viewport.width;
      var line = vp.name + ' ' + label;
      if (overflow > 0) failures.push(line + ': scrolls sideways by ' + overflow + 'px');
      if (errors.length) failures.push(line + ': ' + errors.join(' | '));
      errors.length = 0;
      console.log((overflow > 0 || failures.some(function (f) { return f.indexOf(line + ':') === 0; }) ? '✗ ' : '✓ ') + line);
    }

    await check('hub');
    for (var id of ids) {
      /* The hub only reads the hash on load, so open each game fresh. */
      await page.goto(base + '#' + id);
      await page.reload();
      var title = await page.textContent('#playTitle');
      if (!title) failures.push(vp.name + ' ' + id + ': did not launch');
      await check(id);
      for (var size of SIZES[id] || []) {
        await page.getByRole('button', { name: size, exact: true }).click();
        await check(id + ' ' + size);
      }
    }
    await ctx.close();
  }

  await browser.close();
  if (server) server.close();

  if (failures.length) {
    console.error('\n' + failures.length + ' failure(s):\n  ' + failures.join('\n  '));
    process.exit(1);
  }
  console.log('\nAll pages loaded cleanly.');
}

main().catch(function (e) { console.error(e); process.exit(1); });

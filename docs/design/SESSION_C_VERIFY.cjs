// Local design QA only. Uses the existing bundled Playwright; installs nothing.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/thanm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = __dirname;
const url = pathToFileURL(path.join(output, 'SESSION_C.html')).href;
const representative = [
  'Watch/Lobby/default', 'Watch/Verification/mismatch', 'Watch/Player portrait/playing',
  'Games/Hub/default', 'Chess/Board/check', 'Chess/Promotion/default',
  'Scribble/Word pick/default', 'Scribble/Draw/default', 'Scribble/Guess/default',
  'Calls/Incoming/video', 'Calls/Audio/default', 'Calls/Video/default',
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1460, height: 1200 }, deviceScaleFactor: 1 });
  const scriptErrors = [], requests = [];
  page.on('pageerror', error => scriptErrors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(url + '?all');
  await page.evaluate(() => document.fonts.ready);
  const catalog = await page.evaluate(() => window.reviewCatalog);
  const fonts = await page.evaluate(() => ({
    display: document.fonts.check('600 38px Fraunces'),
    body: document.fonts.check('400 14px Jakarta'),
    label: document.fonts.check('600 14px Jakarta'),
  }));
  const themes = [];
  for (const theme of ['Midnight', 'Rose', 'Noir']) {
    await page.selectOption('#theme', theme);
    themes.push(await page.evaluate(() => {
      const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const luminance = color => rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const contrastFailures = [];
      for (const node of document.querySelectorAll('.phone *')) {
        if (!node.childNodes.length || ![...node.childNodes].some(c => c.nodeType === Node.TEXT_NODE && c.textContent.trim()) || node.closest('svg,.piece,.float-reaction')) continue;
        const style = getComputedStyle(node);
        if (style.display === 'none') continue;
        let parent = node, bg = getComputedStyle(node.closest('.phone')).backgroundColor;
        while (parent && !parent.classList.contains('phone')) {
          const s = getComputedStyle(parent);
          if (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') { bg = s.backgroundColor; break; }
          parent = parent.parentElement;
        }
        let colors = [bg];
        const hero = node.closest('.hero');
        if (hero && !node.closest('.btn')) {
          const rootStyle = getComputedStyle(document.documentElement);
          const resolve = name => { const temp = document.createElement('span'); temp.style.color = rootStyle.getPropertyValue(name); document.body.append(temp); const c = getComputedStyle(temp).color; temp.remove(); return c; };
          colors = [resolve('--bubbleMineStart'), resolve('--bubbleMineEnd')];
        }
        const minimum = Math.min(...colors.map(c => ratio(style.color, c)));
        if (minimum < 4.49) contrastFailures.push({ frame: node.closest('.tile').dataset.frame, text: node.textContent.trim().slice(0, 65), ratio: Number(minimum.toFixed(2)) });
      }
      return {
        theme: document.documentElement.dataset.theme,
        frameCount: document.querySelectorAll('.phone').length,
        incorrectDimensions: [...document.querySelectorAll('.phone')].filter(n => n.offsetWidth !== 412 || n.offsetHeight !== 915).length,
        horizontalOverflow: [...document.querySelectorAll('.content')].filter(n => n.scrollWidth > n.clientWidth + 2).map(n => ({ frame: n.closest('.tile').dataset.frame, width: n.clientWidth, contentWidth: n.scrollWidth })),
        contrastFailures,
      };
    }));
    await page.evaluate(ids => {
      document.body.classList.add('overview');
      for (const tile of document.querySelectorAll('.tile')) tile.hidden = !ids.includes(tile.dataset.frame);
      document.getElementById('frame-count').textContent = ids.length;
    }, representative);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(output, `SESSION_C_${theme.toUpperCase()}.png`), fullPage: true });
    await page.evaluate(() => { document.body.classList.remove('overview'); for (const tile of document.querySelectorAll('.tile')) tile.hidden = false; });
  }
  await page.selectOption('#theme', 'Midnight');
  // Inspect all states at doubled type size. Content scroll is intentional; horizontal clipping is not.
  await page.addStyleTag({ content: '.phone{--text-scale:2}.phone p,.phone h2,.phone h3,.phone strong,.phone button,.phone .small,.phone .chip,.phone .name{font-size:calc(var(--qa-size,14px) * 2)}.phone .heading{--qa-size:30px}.phone .small{--qa-size:12px}.phone .eyebrow{--qa-size:11px}.phone .btn{min-height:50px;overflow-wrap:anywhere}.phone .call-identity{padding-top:12px}.phone .call-identity .heading{font-size:40px}.phone .score-head{flex-wrap:wrap}.phone .word-mask{font-size:32px}' });
  const largeText = await page.evaluate(() => [...document.querySelectorAll('.content')].filter(n => n.scrollWidth > n.clientWidth + 2).map(n => n.closest('.tile').dataset.frame));
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-flow="watch"]').click();
  await page.locator('[data-frame="Watch/Lobby/default"] button[data-go="Watch/File picker/default"]').click();
  const watch = await page.locator('.flow-active').getAttribute('data-frame');
  await page.evaluate(() => window.reviewGo('Scribble/Guess/default'));
  await page.locator('.flow-active .composer input').fill('watermelon');
  await page.locator('.flow-active .composer button').click();
  const guess = await page.locator('.flow-active').getAttribute('data-frame');
  await page.evaluate(() => window.reviewGo('Calls/Incoming/video'));
  await page.locator('.flow-active [data-go="Calls/Video/default"]').click();
  const accept = await page.locator('.flow-active').getAttribute('data-frame');
  const preview = page.locator('.flow-active .self-view');
  await preview.focus();
  const before = await preview.boundingBox();
  await page.keyboard.press('ArrowLeft');
  const after = await preview.boundingBox();
  const offline = await page.evaluate(() => {
    const checks = [];
    for (const id of ['Watch/Player portrait/offline', 'Chess/Board/offline', 'Scribble/Draw/offline', 'Scribble/Guess/offline']) {
      const tile = document.querySelector(`[data-frame="${id}"]`);
      const selector = id.startsWith('Watch') ? '.transport button:not([aria-label="Landscape player"]),.transport input' : id.startsWith('Chess') ? '.square' : id.includes('/Draw/') ? '.drawing-tools button' : '.composer input,.composer button';
      const controls = [...tile.querySelectorAll(selector)];
      checks.push({ frame: id, controls: controls.length, disabled: controls.every(c => c.disabled) });
    }
    return checks;
  });
  await page.evaluate(() => window.reviewGo('Watch/Player landscape/playing'));
  // Render the full landscape element for export, outside the review phone's clipping viewport.
  await page.evaluate(() => {
    const tile = document.querySelector('.flow-active');
    tile.style.width = '963px';
    tile.querySelector('.phone').style.width = '963px';
    tile.querySelector('.phone').style.overflow = 'visible';
    tile.querySelector('.landscape-review').style.width = '963px';
    tile.querySelector('.landscape-rail').style.width = '915px';
    document.getElementById('board').style.gridTemplateColumns = '963px';
  });
  await page.locator('.flow-active .landscape-surface').screenshot({ path: path.join(output, 'SESSION_C_LANDSCAPE.png') });
  await page.evaluate(() => window.reviewGo('Chess/Board/check'));
  await page.locator('.flow-active .phone').screenshot({ path: path.join(output, 'qa-C-Chess-Board.png') });
  const report = { generatedAt: new Date().toISOString(), frameCount: catalog.length, uniqueNames: new Set(catalog.map(f => f.id)).size, fonts, scriptErrors, externalRequests: requests, themes, largeTextHorizontalOverflow: largeText, interactions: { watch, guess, accept, selfViewKeyboardMoved: after.x < before.x, offline }, limitations: ['This is an editable HTML review artifact, not Figma nodes or app implementation.', 'Large-type QA is a browser reflow stress test, not Android font-scale/device validation.', 'Video/avatar assets were not supplied; labeled placeholders remain.', 'No actual session, chess move, drawing sync, call or device behavior was exercised.'] };
  fs.writeFileSync(path.join(output, 'SESSION_C_QA.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(output, 'SESSION_C_CATALOG.json'), JSON.stringify(catalog, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });

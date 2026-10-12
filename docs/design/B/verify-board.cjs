const { chromium } = require('C:/Users/thanm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('file:///' + path.join(dir, 'design-board.html').replaceAll('\\', '/'));
  await page.evaluate(() => document.fonts.ready);
  const results = [];
  const tokens = JSON.parse(fs.readFileSync(path.join(dir, '..', 'tokens.json'), 'utf8')).themes;
  function luminance(hex) {
    const rgb = hex.slice(1, 7).match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  for (const theme of ['Midnight', 'Rose', 'Noir']) {
    await page.selectOption('#theme', theme);
    await page.selectOption('#motion', 'Off');
    const result = await page.evaluate(() => {
      const frames = [...document.querySelectorAll('.phone')].map(phone => {
        const r = phone.getBoundingClientRect();
        const overflow = [...phone.querySelectorAll('*')].filter(e => {
          if (e.children.length || !e.textContent.trim() || e.tagName === 'STYLE') return false;
          const s = getComputedStyle(e);
          return s.display !== 'none' && s.visibility !== 'hidden' && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2;
        }).map(e => ({ tag: e.tagName, text: e.textContent.slice(0, 70) }));
        const history = phone.querySelector('.chat-history');
        return { name: phone.dataset.frame, width: r.width, height: r.height, overflow, historyScroll: history ? history.scrollHeight - history.clientHeight : null };
      });
      return { theme: document.documentElement.dataset.theme, frames, fonts: ['Fraunces', 'Plus Jakarta Sans'].map(f => ({ name: f, loaded: document.fonts.check('16px "' + f + '"') })) };
    });
    results.push(result);
    const t = tokens[theme];
    const contrasts = [];
    for (const bg of ['bg', 'bgElevated', 'surface', 'surfaceAlt']) for (const fg of ['textPrimary', 'textSecondary', 'textMuted', 'danger', 'primary']) contrasts.push({ fg, bg, ratio: contrast(t[fg], t[bg]) });
    for (const bg of ['bubbleMineStart', 'bubbleMineEnd']) for (const fg of ['bubbleMineText', 'tickSent', 'tickSeen']) contrasts.push({ fg, bg, ratio: contrast(t[fg], t[bg]) });
    contrasts.push({ fg: 'bubbleTheirsText', bg: 'bubbleTheirs', ratio: contrast(t.bubbleTheirsText, t.bubbleTheirs) });
    result.contrast = { pairs: contrasts.length, minimum: Math.min(...contrasts.map(x => x.ratio)), failures: contrasts.filter(x => x.ratio < 4.5) };
    await page.locator('[data-frame="Chat/Conversation/default"]').screenshot({ path: path.join(dir, `chat-${theme.toLowerCase()}.png`) });
    await page.locator('[data-frame="Memories/Timeline/default"]').screenshot({ path: path.join(dir, `memories-${theme.toLowerCase()}.png`) });
    await page.addStyleTag({ content: '.notes{display:none!important}.board{grid-template-columns:repeat(4,1fr)!important;gap:28px!important;max-width:none!important}.spec{zoom:.54}.spec-title{min-height:40px}.board-header,.toolbar{display:none!important}' });
    await page.screenshot({ path: path.join(dir, `contact-${theme.toLowerCase()}.png`), fullPage: true });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
  }
  await page.locator('[data-go="chat-conversation-default"]').first().click();
  const draft = page.locator('.spec.selected .draft');
  await draft.fill('A little hello, just for you.');
  const sendEnabled = await page.locator('.spec.selected .send').isEnabled();
  await page.locator('.spec.selected [data-action]').first().click();
  const actionsOpened = await page.locator('.spec.selected').getAttribute('id');
  await page.locator('.spec.selected [data-go="chat-message-info-sheet-seen"]').click();
  const infoOpened = await page.locator('.spec.selected').getAttribute('id');
  await page.selectOption('#screen', 'memories-timeline-default');
  await page.locator('.spec.selected .fab').click();
  const uploadOpened = await page.locator('.spec.selected').getAttribute('id');
  const report = { results, errors, interactions: { sendEnabled, actionsOpened, infoOpened, uploadOpened } };
  fs.writeFileSync(path.join(dir, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ frames: results.map(r => ({ theme: r.theme, count: r.frames.length, badSize: r.frames.filter(f => f.width !== 412 || f.height !== 915), overflow: r.frames.filter(f => f.overflow.length), conversationScroll: r.frames[0].historyScroll, fonts: r.fonts, contrast: r.contrast })), errors, interactions: report.interactions }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });

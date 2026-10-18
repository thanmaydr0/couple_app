const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'catalog.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod.exports);
const { buildCatalog, searchCatalog, sections } = mod.exports;
const source = fs.readFileSync(path.join(__dirname, '../registry.ts'), 'utf8');
const entries = [...source.matchAll(/id: '([^']+)', title: '([^']+)', subtitle: '([^']+)', icon: '([^']+)', route: '([^']+)'/g)].map(([, id, title, subtitle, icon, route]) => ({ id, title, subtitle, icon, route, enabled: true }));
assert.equal(entries.length, 20);
const menu = buildCatalog(entries);
assert.equal(menu.length, 30); assert.equal(new Set(menu.map(item => item.id)).size, menu.length);
for (const item of menu) {
  assert(sections.includes(item.section));
  const route = typeof item.route === 'string' ? item.route : item.route.pathname;
  assert(fs.existsSync(path.join(__dirname, '../../../app', `${route.slice(1)}.tsx`)), `Missing route ${route}`);
}
assert.equal(searchCatalog(menu, '  TOUCH together ')[0].id, 'touch');
assert.equal(searchCatalog(menu, 'no-match-xyz').length, 0);
assert.equal(searchCatalog(menu, '').length, 30);
assert.equal(buildCatalog(entries.map(feature => ({ ...feature, enabled: false }))).length, 10);
console.log('PASS: 30 unique menu entries, every existing route, categories, search, disabled-feature filtering.');

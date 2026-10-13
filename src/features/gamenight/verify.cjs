const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
function load(name) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}
const { KNOW, RATHER, ROULETTE, BUNDLED } = load('prompts');
const { promptSchema, roundSchema } = load('types');
const { fuzzyMatch, winLine, pickPrompt } = load('rules');
assert.equal(KNOW.length, 200); assert.equal(RATHER.length, 150); assert.equal(ROULETTE.length, 104);
assert.equal(new Set(BUNDLED.map(p => p.id)).size, 454);
for (const prompt of BUNDLED) {
  promptSchema.parse(prompt);
  assert.equal(prompt.options.length, prompt.game === 'know' ? 4 : prompt.game === 'rather' ? 2 : 0);
  assert.equal(new Set(prompt.options).size, prompt.options.length);
}
for (const category of ['favorites', 'memories', 'habits', 'dreams']) assert.equal(KNOW.filter(p => p.category === category).length, 50);
for (const category of ['sweet', 'funny', 'adventurous', 'deep']) assert.equal(ROULETTE.filter(p => p.category === category).length, 26);
assert(fuzzyMatch('Strawberry', 'strawbery')); assert(fuzzyMatch('  Hot   Chocolate ', 'hot chocolate'));
assert(!fuzzyMatch('tea', 'sea')); assert(!fuzzyMatch('mountains', 'beach'));
assert.equal(pickPrompt([KNOW[0], KNOW[1]], KNOW[0].id).id, KNOW[1].id);
assert.throws(() => pickPrompt([], 'missing'));
for (const cells of [[35,36,37,38], [0,7,14,21], [0,8,16,24], [6,12,18,24]]) {
  const board = Array(42).fill(0); cells.forEach(cell => board[cell] = 1);
  assert.deepEqual(winLine(board), cells);
}
const wrapped = Array(42).fill(0); [5,6,7,8].forEach(cell => wrapped[cell] = 1); assert.deepEqual(winLine(wrapped), []);
assert.deepEqual(winLine(Array(42).fill(0)), []);
assert(!roundSchema.safeParse({ state: { board: Array(41).fill(0) } }).success);
// Check real legal games for valid reported lines and gravity at every move.
let seed = 160;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let game = 0; game < 500; game++) {
  const board = Array(42).fill(0);
  for (let move = 0; move < 42; move++) {
    const available = Array.from({ length: 7 }, (_, c) => c).filter(c => board[c] === 0);
    if (!available.length) break;
    const c = available[Math.floor(random() * available.length)];
    let r = 5; while (board[r * 7 + c] !== 0) r--;
    board[r * 7 + c] = 1 + move % 2;
    const line = winLine(board);
    if (line.length) { assert.equal(new Set(line.map(i => board[i])).size, 1); assert(board[line[0]]); break; }
  }
}
console.log('PASS: 454 valid original prompts; categories; Fuse matching; four win axes; no row wrap; 500 legal board simulations.');

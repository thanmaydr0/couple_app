// Run with node src/features/chess/verify.cjs; no extra dependencies or build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { Chess } = require('chess.js');
const filename = path.join(__dirname, 'rules.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const { restore, outcome, drawReason, material, captures } = loaded.exports;
const saved = chess => ({ fen: chess.fen(), pgn: chess.pgn() });
const play = moves => { const chess = new Chess(); for (const move of moves) chess.move(move); return chess; };
assert.throws(() => new Chess().move('e5'));
const mate = play(['f3', 'e5', 'g4', 'Qh4#']);
assert.equal(outcome(restore(saved(mate))), 'checkmate');
const repetition = play(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']);
assert.equal(drawReason(restore(saved(repetition))), 'Threefold repetition');
assert.equal(outcome(restore(saved(repetition))), 'draw');
assert.equal(outcome(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'stalemate');
assert.equal(drawReason(new Chess('7k/8/6K1/8/8/8/8/8 w - - 0 1')), 'Insufficient material');
assert.equal(drawReason(new Chess('7k/8/6K1/8/8/8/8/R7 w - - 100 51')), '50-move rule');
const castle = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'O-O']);
assert.equal(restore(saved(castle)).get('g1').type, 'k');
assert.equal(castle.get('f1').type, 'r');
const ep = play(['e4', 'a6', 'e5', 'd5', 'exd6']);
assert.equal(ep.get('d5'), undefined);
assert.deepEqual(captures(restore(saved(ep)), 'w'), ['p']);
assert.equal(material(ep, 'w'), 1);
for (const promotion of ['q', 'r', 'b', 'n']) {
  const chess = new Chess('7k/P7/6K1/8/8/8/8/8 w - - 0 1');
  chess.move({ from: 'a7', to: 'a8', promotion });
  assert.equal(restore(saved(chess)).get('a8').type, promotion);
}
assert.throws(() => restore({ fen: new Chess().fen(), pgn: mate.pgn() }));
console.log('PASS: legality, checkmate, stalemate, repetition after restart, insufficient material, 50-move draw, castling, en passant, captures, material, four promotions, corrupt history.');

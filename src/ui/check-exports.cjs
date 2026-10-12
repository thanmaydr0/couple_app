/* Run: node src/ui/check-exports.cjs [baseline ref]. Read-only: does not emit or stage files. */
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const baseline = process.argv[2] || 'HEAD';
const root = path.resolve(__dirname, '../..');
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, '--', 'src/ui'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(f => /\.tsx?$/.test(f));
let exportsChecked = 0;
for (const file of files) {
  const oldText = execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' });
  const oldSource = ts.createSourceFile(file, oldText, ts.ScriptTarget.Latest, true);
  const names = new Set();
  for (const statement of oldSource.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const e of statement.exportClause.elements) names.add(e.name.text);
    if (statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (statement.name) names.add(statement.name.text);
      if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name)) names.add(d.name.text);
    }
  }
  const current = program.getSourceFile(path.join(root, file));
  assert(current, `Missing legacy import path: ${file}`);
  const symbol = checker.getSymbolAtLocation(current);
  const currentNames = new Set(symbol ? checker.getExportsOfModule(symbol).map(e => e.name) : []);
  for (const name of names) { assert(currentNames.has(name), `Missing ${file}: ${name}`); exportsChecked++; }
}
const errors = ts.getPreEmitDiagnostics(program);
assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => root, getCanonicalFileName: f => f, getNewLine: () => '\n' }));
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'src/theme/tokens.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(root, 'docs/design/tokens.json'), 'utf8')), 'Theme source drifted from design fallback');
const source = fs.readFileSync(path.join(root, 'src/theme/contrast.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleExports = {};
new Function('exports', compiled)(moduleExports);
const { themes } = JSON.parse(fs.readFileSync(path.join(root, 'src/theme/tokens.json'), 'utf8'));
let pairs = 0;
for (const theme of Object.values(themes)) {
  for (const swatch of Object.values(themes)) {
    const accent = moduleExports.accessibleAccent(theme, swatch);
    for (const surface of ['bg', 'bgElevated', 'surface', 'surfaceAlt']) assert(moduleExports.contrast(accent.primary, theme[surface]) >= 4.5, `Accent fails AA on ${surface}`);
    assert(moduleExports.contrast(accent.primary, accent.primaryContrast) >= 4.5, 'Accent foreground fails AA');
    pairs++;
  }
}
console.log(`PASS: ${exportsChecked} original exports across ${files.length} import paths; legacy prop contracts; exact fallback tokens; ${pairs} accent/theme combinations meet AA.`);

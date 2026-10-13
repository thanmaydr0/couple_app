const { mkdtempSync, readdirSync, unlinkSync, rmdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const output = mkdtempSync(path.join(tmpdir(), 'us-wallet-tests-'));
try {
 const compile = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), 'src/features/wallet/math.ts', 'src/features/wallet/math.test.ts', 'src/features/wallet/types.ts', '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'node', '--ignoreConfig', '--ignoreDeprecations', '6.0', '--strict', '--noUncheckedIndexedAccess', '--skipLibCheck', '--outDir', output], { cwd:root, stdio:'inherit' });
 if (compile.status !== 0) process.exitCode = compile.status || 1;
 else {
  const run = spawnSync(process.execPath, [path.join(output, 'math.test.js')], { stdio:'inherit' }); process.exitCode = run.status || 0;
  if (!process.exitCode) { const handler = spawnSync(process.execPath, [path.join(__dirname,'verify-handler.cjs')], {stdio:'inherit'}); process.exitCode = handler.status || 0; }
 }
} finally { for (const file of readdirSync(output)) unlinkSync(path.join(output, file)); rmdirSync(output); }

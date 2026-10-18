import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { mediaAssets } from './media-assets.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const esbuild = require('esbuild');
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '..');
const output = resolve(root, 'dist');
async function emit(path, content) { await mkdir(dirname(resolve(output, path)), { recursive: true }); await writeFile(resolve(output, path), content); }
function compile(source) { return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText; }
export async function build() {
  let values = {};
  // Only these two PUBLIC variables are ever emitted. Never expose an env file.
  for (const file of [resolve(repo, '.env'), resolve(root, '.env')]) {
    try { for (const line of (await readFile(file, 'utf8')).split(/\r?\n/)) {
      const match = line.match(/^(EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY)\s*=\s*(.*)$/);
      if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    } } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) if (process.env[name]) values[name] = process.env[name];
  const key = values.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role; } catch {}
  if (key.startsWith('sb_secret_') || (role && role !== 'anon')) throw new Error('Only a public Supabase anon/publishable key may be built into the web client.');
  await emit('config.js', `globalThis.US_CONFIG = ${JSON.stringify({ url: values.EXPO_PUBLIC_SUPABASE_URL || '', anonKey: key }).replace(/</g, '\\u003c')};`);
  for (const name of ['index.html', 'styles.css']) { await mkdir(output, { recursive: true }); await copyFile(resolve(root, name), resolve(output, name)); }
  for (const name of await readdir(resolve(root, 'src'))) if (name.endsWith('.ts')) {
    const source = compile(await readFile(resolve(root, 'src', name), 'utf8'))
      .replaceAll("'../../src/features/movie/sync'", "'../shared/sync.js'")
      .replaceAll("'../../src/features/movie/model'", "'../shared/model.js'")
      .replaceAll("'../../src/features/e2ee/crypto'", "'../shared/crypto.js'");
    await emit(`src/${name.replace(/\.ts$/, '.js')}`, source);
  }
  await esbuild.build({
    entryPoints: [resolve(root, 'src/watch-lobby-view.tsx')],
    outfile: resolve(output, 'src/watch-lobby-view.js'),
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', minify: true, legalComments: 'none',
  });
  for (const name of ['model', 'sync']) await emit(`shared/${name}.js`, compile(await readFile(resolve(repo, `src/features/movie/${name}.ts`), 'utf8')).replaceAll("'./model'", "'./model.js'"));
  let crypto = compile(await readFile(resolve(repo, 'src/features/e2ee/crypto.ts'), 'utf8'));
  crypto = crypto.replace(/import nacl from 'tweetnacl';/, 'const nacl = globalThis.nacl;')
    .replace(/import \{([^}]+)\} from 'tweetnacl-util';/, 'const {$1} = globalThis.nacl.util;')
    .replace(/import \{ scrypt \} from 'scrypt-js';/, 'const { scrypt } = globalThis.scrypt;');
  await emit('shared/crypto.js', crypto);
  for (const [name, path] of Object.entries({ supabase: '@supabase/supabase-js/dist/umd/supabase.js', nacl: 'tweetnacl/nacl-fast.min.js', 'nacl-util': 'tweetnacl-util/nacl-util.min.js', scrypt: 'scrypt-js/scrypt.js' })) {
    await mkdir(resolve(output, 'vendor'), { recursive: true }); await copyFile(require.resolve(path), resolve(output, `vendor/${name}.js`));
  }
  const tokens = JSON.parse(await readFile(resolve(repo, 'src/theme/tokens.json'), 'utf8'));
  let css = '';
  for (const [name, colors] of Object.entries(tokens.themes)) css += `${name === 'Auto' ? ':root,' : ''}[data-theme="${name}"]{${Object.entries(colors).map(([key, value]) => `--${key}:${value}`).join(';')}}\n`;
  css += ':root{--xs:4px;--sm:8px;--s12:12px;--md:16px;--s20:20px;--lg:24px;--xl:32px;--s40:40px;--s56:56px;--touch:48px;--radius-sm:8px;--radius:20px;--pill:999px;--sidebar:240px;--content:1120px;--login:460px;--player:960px;--line:1px;--weight:600;--display-font:Georgia,serif;--body-font:system-ui,sans-serif;--press-scale:' + tokens.motion.pressScale + ';--fast:' + tokens.motion.fast + 'ms;--base:' + tokens.motion.base + 'ms;';
  for (const type of tokens.typeScale) css += `--${type.name.replace('/', '-')}:${type.size}px;--${type.name.replace('/', '-')}-line:${type.lineHeight}px;`;
  css += `--player-controls-idle:${tokens.motion.hero * 5}ms;--fullscreenInk:${tokens.themes.Midnight.textPrimary};}`;
  await emit('tokens.css', css);
  await mediaAssets(output);
  console.log('Built web/dist using installed packages.');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await build();

// Run: node src/features/applock/verify.cjs. No native build or test dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, Date, Promise, Set });
  return module.exports;
}
const policy = load('types.ts');
for (const [delay, limit] of [['immediately', 0], ['30s', 30000], ['1m', 60000], ['5m', 300000]]) {
  assert.equal(policy.requiresUnlock(delay, null, 100), true, `${delay}: cold start`);
  assert.equal(policy.requiresUnlock(delay, 100, 100 + limit), true, `${delay}: exact expiry`);
  if (limit) assert.equal(policy.requiresUnlock(delay, 100, 99 + limit), false, `${delay}: grace period`);
}
assert.equal(policy.requiresUnlock('off', null, 999999), false);
assert.equal(policy.parseDelay(null), 'off');
assert.throws(() => policy.parseDelay('corrupt'));

// A small hook driver executes the actual gate's render and AppState handlers.
const slots = []; let cursor = 0; let effects = []; let rendered;
const react = {
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
  useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
  useId() { const i = cursor++; return `test:${i}`; },
  useMemo(factory, deps) { const i = cursor++; const previous = slots[i]; if (!previous || deps.some((value, index) => value !== previous.deps[index])) slots[i] = { deps, value: factory() }; return slots[i].value; },
  useEffect(effect, deps) { const i = cursor++; const previous = slots[i]; if (!previous || deps.some((value, index) => value !== previous.deps[index])) { effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; }); } },
};
const listeners = new Map(); const appState = { currentState: 'active', addEventListener(name, handler) { listeners.set(name, handler); return { remove() { listeners.delete(name); } }; } };
let authBusy = false; let authFails = false;
const lockState = { ready: false, delay: 'off', error: '', hydrate: async () => {} };
const theme = { colors: { bg: 'bg', primary: 'primary' }, spacing: { lg: 24 }, geometry: { touch: 48, icon: 24 } };
const jsx = (type, props) => ({ type, props });
const native = {
  AppState: appState, View: 'View', Modal: 'Modal', Image: 'Image', BackHandler: { addEventListener: () => ({ remove() {} }) },
  Animated: { View: 'Animated.View', Value: class { stopAnimation() {} setValue() {} }, timing: () => ({ start: callback => callback({ finished: true }) }) },
};
const gate = load('AppLockGate.tsx', {
  react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
  '@expo/vector-icons/Ionicons': 'Ionicons', '@/ui': { Button: 'Button', Header: 'Header', Screen: 'Screen', Text: 'Text' },
  '@/theme': { useTheme: () => theme }, '@/motion': { FadeInView: 'FadeInView', PulseRing: 'PulseRing', useMotion: () => ({ duration: () => 0 }) },
  './authenticate': { authenticationInProgress: () => authBusy, authenticate: async () => { if (authFails) throw new Error('Denied'); } },
  './capture': { setCaptureProtection: async () => {} }, './store': { useLockStore: () => lockState }, './types': policy,
  '../../../assets/splash-mark.png': 'logo',
});
const content = { protected: true };
function render() { cursor = 0; rendered = gate.AppLockGate({ children: content }); const pending = effects; effects = []; pending.forEach(effect => effect()); return rendered; }
async function settle() { for (let i = 0; i < 4; i++) { await Promise.resolve(); render(); } }
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === type) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) { const result = find(child, type); if (result) return result; }
}
function covered() { return find(rendered, 'Modal').props.visible; }
async function main() {
  render(); assert.equal(covered(), true, 'cover before policy hydration');
  assert.equal(find(rendered, 'FadeInView'), undefined, 'children never mount during bootstrap');
  lockState.ready = true; lockState.delay = '30s'; await settle();
  assert.equal(covered(), true, 'cold start locks even with delayed policy');
  listeners.get('blur')(); render();
  assert.equal(find(rendered, 'Button').props.disabled, false, 'native modal focus changes do not disable Unlock');
  authFails = true; find(rendered, 'Button').props.onPress(); await settle();
  assert.equal(covered(), true, 'failed authentication never reveals content');
  authFails = false; find(rendered, 'Button').props.onPress(); await settle();
  assert.equal(covered(), false, 'successful authentication reveals content');
  assert.ok(find(rendered, 'FadeInView'), 'content mounts after authentication');
  listeners.get('focus')(); render(); assert.equal(covered(), false, 'duplicate focus does not relock');
  appState.currentState = 'background'; listeners.get('change')('background'); render();
  assert.equal(covered(), true, 'background immediately covers even during grace period');
  appState.currentState = 'active'; listeners.get('change')('active'); render();
  assert.equal(covered(), false, 'return within grace period reveals content');
  lockState.delay = 'immediately'; await settle();
  appState.currentState = 'background'; listeners.get('change')('background'); render();
  appState.currentState = 'active'; listeners.get('change')('active'); render();
  assert.equal(covered(), true, 'immediate resume requires authentication');
  find(rendered, 'Button').props.onPress(); await settle();
  authBusy = true; listeners.get('blur')(); render(); assert.equal(covered(), true);
  listeners.get('focus')(); authBusy = false; render();
  assert.equal(covered(), false, 'system credential prompt cannot cause a relock loop');
  authBusy = true; appState.currentState = 'background'; listeners.get('change')('background'); render();
  appState.currentState = 'active'; listeners.get('change')('active'); authBusy = false; render();
  assert.equal(covered(), true, 'actual background still expires policy while a prompt is outstanding');
  lockState.delay = 'off'; await settle();
  assert.equal(covered(), false, 'off releases the gate');

  const calls = []; let release;
  const capture = load('capture.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-screen-capture': { preventScreenCaptureAsync: async key => { calls.push(`acquire:${key}`); if (key === 'first') await new Promise(resolve => { release = resolve; }); }, allowScreenCaptureAsync: async key => { calls.push(`release:${key}`); } },
  });
  const first = capture.setCaptureProtection('first', true);
  const second = capture.setCaptureProtection('first', false);
  const third = capture.setCaptureProtection('second', true);
  await Promise.resolve(); assert.deepEqual(calls, ['acquire:first']);
  release(); await Promise.all([first, second, third]);
  assert.deepEqual(calls, ['acquire:first', 'release:first', 'acquire:second']);
  slots.forEach(slot => slot?.cleanup?.()); slots.length = 0; effects = [];
  const privacy = { data: undefined };
  let secure;
  const hook = load('useSecureScreen.ts', {
    react, './usePrivacy': { usePrivacy: () => privacy },
    './capture': { setCaptureProtection: async () => {} },
  });
  function renderHook() { cursor = 0; secure = hook.useSecureScreen(true); const pending = effects; effects = []; pending.forEach(effect => effect()); }
  renderHook(); assert.equal(secure.ready, false, 'private content waits for native protection');
  await Promise.resolve(); renderHook(); assert.equal(secure.ready, true);
  privacy.data = { privacy: { block_screenshots: false } }; renderHook(); assert.equal(secure.ready, true, 'confirmed opt-out does not block content');
  privacy.data = { privacy: { block_screenshots: true } }; renderHook(); assert.equal(secure.ready, false, 're-enabling cannot reuse an old ready state');
  await Promise.resolve(); renderHook(); assert.equal(secure.ready, true);
  console.log('PASS: delay boundaries, hydration, failed/successful unlock, background cover, resume, credential focus, Off, serialized capture calls.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

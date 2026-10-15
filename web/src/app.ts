import type { Session } from '@supabase/supabase-js';
import { configured, db, identity, messageError, type Identity, type WatchSessionRow } from './backend.js';
import { chatScreen } from './chat.js';
import { watchLobby, watchRoom } from './watch.js';
import { card, el, field, notice, PressableScale, Screen, show, useTheme, useMotion } from './ui.js';

const root = document.querySelector<HTMLDivElement>('#app')!;
let cleanup = () => {}; let activeUser = ''; let generation = 0; let context: Identity | null = null;
useTheme(); document.documentElement.dataset.motion = useMotion() ? 'full' : 'reduced';
function replace(node: HTMLElement) { cleanup(); cleanup = () => {}; root.replaceChildren(node); }
function login() {
  context = null;
  const page = el('main', 'login-page'); const story = el('section', 'login-story');
  story.append(el('a', 'wordmark', 'us.'), el('p', 'eyebrow', 'A LITTLE SPACE. JUST FOR US.'), el('h1', '', 'Distance changes.\nConnection stays.'), el('p', 'intro', 'The everyday stories. The late-night conversations. The movies that feel better together.'), el('div', 'orbit', '♡'), el('p', 'fine', 'Your private corner of the world.'));
  const panel = el('section', 'login-panel'); const content = Screen('A little closer.', 'WELCOME BACK');
  content.append(el('p', 'muted', 'Sign in with the same account you use in the Android app.'));
  const form = el('form', 'stack'); const email = field('Email address', 'email'); email.input.autocomplete = 'username'; email.input.required = true;
  const password = field('Password', 'password'); password.input.autocomplete = 'current-password'; password.input.required = true;
  const error = notice(); error.setAttribute('role', 'alert');
  let busy = false;
  const submit = PressableScale('Sign in →', async () => { if (!form.reportValidity() || busy) return; await signIn(); }, 'primary');
  async function signIn() {
    if (busy) return; if (!configured) { show(error, 'Supabase is not configured. Add the public settings to web/.env, then rebuild.'); return; }
    busy = true; submit.disabled = true; email.input.disabled = true; password.input.disabled = true; submit.textContent = 'Signing in…'; show(error, '');
    try { const result = await db.auth.signInWithPassword({ email: email.input.value.trim(), password: password.input.value }); if (result.error) throw result.error; password.input.value = ''; }
    catch (failure) { show(error, messageError(failure)); }
    finally { busy = false; submit.disabled = false; email.input.disabled = false; password.input.disabled = false; submit.textContent = 'Sign in →'; }
  }
  form.onsubmit = event => { event.preventDefault(); if (form.reportValidity()) void signIn(); };
  form.append(email.wrapper, password.wrapper, error, submit); content.append(form, el('p', 'fine muted', 'Accounts are created and paired by your admin.'));
  if (!configured) show(error, 'Add your public Supabase configuration to web/.env, then rebuild to sign in.');
  panel.append(content); page.append(story, panel); replace(page);
}
function dashboard(value: Identity, navigate: (route: string) => void) {
  const screen = Screen('Our space.', 'GOOD TO HAVE YOU HERE');
  const hero = card(`A little closer to ${value.partner.display_name || 'your partner'}.`, 'Make room for the little things. A message, a movie, a moment together.'); hero.classList.add('hero');
  const monogram = el('div', 'avatar', (value.partner.display_name || '♡').slice(0, 1).toUpperCase()); hero.prepend(monogram);
  const actions = el('div', 'dashboard-grid');
  for (const [title, body, label, route] of [['Your conversation', 'Share what’s on your mind, from the big news to the tiny details.', 'Open chat ↗', 'chat'], ['A movie for two', 'Same movie. Same moment. Pick a local copy and watch in sync.', 'Plan a movie night ↗', 'watch']]) {
    const item = card(title!, body!); item.append(PressableScale(label!, () => navigate(route!))); actions.append(item);
  }
  screen.append(hero, actions);
  if (value.anniversary) {
    const start = Date.parse(value.anniversary + 'T00:00:00'); const days = Math.max(0, Math.floor((Date.now() - start) / 86400000));
    screen.append(card(`${days.toLocaleString()} days of us`, `Since ${new Date(start).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}`));
  }
  return { screen, cleanup: () => {} };
}
function shell(value: Identity) {
  const wrapper = el('div', 'app-shell'); const sidebar = el('aside', 'sidebar');
  const wordmark = el('p', 'wordmark', 'us.'); const nav = el('nav', 'nav'); nav.setAttribute('aria-label', 'Main navigation');
  const outlet = el('div', 'outlet'); const offline = notice(); offline.classList.add('offline');
  const updateOnline = () => { show(offline, navigator.onLine ? '' : 'You’re offline. Reconnect to send messages or watch together.'); }; updateOnline();
  const buttons = new Map<string, HTMLButtonElement>();
  let pageCleanup = () => {};
  function mount(page: { screen: HTMLElement; cleanup: () => void }) { pageCleanup(); pageCleanup = page.cleanup; outlet.replaceChildren(page.screen); }
  function openMovie(room: WatchSessionRow, file: File) { mount(watchRoom(value, room, file, () => route('watch'),()=>openMovie(room,file))); }
  function route(name: string) {
    const selected = ['home', 'chat', 'watch'].includes(name) ? name : 'home';
    for (const [key, button] of buttons) { button.classList.toggle('selected', key === selected); button.setAttribute('aria-current', key === selected ? 'page' : 'false'); }
    if (location.hash !== `#${selected}`) history.replaceState(null, '', `#${selected}`);
    if (selected === 'chat') mount(chatScreen(value)); else if (selected === 'watch') mount(watchLobby(value, openMovie)); else mount(dashboard(value, route));
  }
  for (const [key, label] of [['home', '⌂  Our space'], ['chat', '♡  Conversation'], ['watch', '▷  Watch together']]) { const button = PressableScale(label!, () => route(key!)); buttons.set(key!, button); nav.append(button); }
  const settings = el('div', 'sidebar-bottom'); const theme = el('select'); theme.setAttribute('aria-label', 'Appearance');
  for (const name of ['Auto', 'Midnight', 'Noir', 'Rose']) { const option = el('option', '', name === 'Auto' ? 'Warm glow' : name); option.value = name; theme.append(option); }
  theme.value = document.documentElement.dataset.theme || 'Auto'; theme.onchange = () => useTheme(theme.value);
  settings.append(el('p', 'fine muted', `Signed in as ${value.profile.display_name || 'you'}`), theme, PressableScale('Sign out', async () => {
    const result = await db.auth.signOut({ scope: 'local' }); if (result.error) show(offline, messageError(result.error));
  }));
  sidebar.append(wordmark, el('p', 'eyebrow', 'JUST THE TWO OF YOU'), nav, settings); wrapper.append(sidebar, offline, outlet);
  replace(wrapper); route(location.hash.slice(1));
  const hash = () => route(location.hash.slice(1)); window.addEventListener('hashchange', hash); window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
  cleanup = () => { pageCleanup(); window.removeEventListener('hashchange', hash); window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
}
async function loadUser(session: Session | null, force = false) {
  const user = session?.user.id || ''; if (!force && user === activeUser && context) return;
  activeUser = user; const attempt = ++generation;
  if (!user) { login(); return; }
  const loading = Screen('Opening your space…', 'JUST A MOMENT'); replace(loading);
  try { const result = await identity(user); if (attempt !== generation) return; context = result; shell(result); }
  catch (failure) {
    if (attempt !== generation) return;
    const page = Screen('Let’s get you connected.', 'YOUR ACCOUNT'); const error = notice(); show(error, messageError(failure));
    page.append(error, PressableScale('Try again', () => loadUser(session, true), 'primary'), PressableScale('Sign out', async () => { const result = await db.auth.signOut({ scope: 'local' }); if (result.error) show(error, messageError(result.error)); })); replace(page);
  }
}
if (!configured) login();
else {
  db.auth.onAuthStateChange((_event, session) => { if (session?.user.id !== activeUser || !session) void loadUser(session); });
  void db.auth.getSession().then(({ data, error }) => { if (error) { login(); } else if (!activeUser) void loadUser(data.session); });
}

import { b64, bytes, decrypt, encrypt, open, passphraseKey, keyPair, text, backupParams, safetyNumber } from '../../src/features/e2ee/crypto';
import { db, messageError, type Identity, type Message } from './backend.js';
import { card, el, field, Header, notice, PressableScale, Screen, show } from './ui.js';

export function chatScreen(context: Identity, options: { embedded?: boolean } = {}) {
  const screen = options.embedded ? el('section', 'movie-chat-panel') : Screen(context.partner.display_name || 'Your partner', 'YOUR CONVERSATION');
  if (options.embedded) {
    screen.setAttribute('aria-label', 'Live movie chat');
    screen.append(Header('Live chat', context.partner.display_name || 'Your partner'));
  }
  const status = notice(); const security = card('Private, just for you two.', 'Loading your chat privacy settings…');
  const list = el('div', 'messages'); list.setAttribute('aria-label', 'Messages');
  const scroll = el('div', 'conversation'); const older = PressableScale('Load earlier messages', async () => { await load(true); }); scroll.append(older, list);
  const composer = el('form', 'composer'); const draft = el('textarea'); draft.rows = 2; draft.maxLength = 4000; draft.placeholder = 'A little hello…'; draft.setAttribute('aria-label', 'Message to your partner');
  const send = PressableScale('Send ↑', async () => { await sendDraft(); }, 'primary');
  const pending = el('div', 'stack'); composer.append(draft, send);
  const privacyDetails = options.embedded ? el('details', 'chat-privacy') : null;
  if (privacyDetails) privacyDetails.append(el('summary', 'pressable', 'Chat privacy'), security);
  let disposed = false; let loading = false; let sending = false; let hasEarlier = true; let ready = false; let required = false;
  let secret: Uint8Array | null = null; let ownKey = ''; let peerKey = ''; let trustedPeer = ''; let rows: Message[] = [];
  let lastPush = 0; let recoverPass: HTMLInputElement | null = null;
  const mediaUrls = new Map<string, string>();
  const failed = new Map<string, { body: string; id: string }>();
  function usable() { return ready && (!required || (!!secret && trustedPeer === peerKey)) && navigator.onLine && !sending; }
  function state() { send.disabled = !usable(); draft.disabled = !ready || (required && !secret); }
  function lock() { secret?.fill(0); secret = null; trustedPeer = ''; mediaUrls.clear(); recovery(); render(); state(); }
  function recovery() {
    if (privacyDetails) privacyDetails.open = required && (!secret || trustedPeer !== peerKey);
    security.replaceChildren(el('h2', '', required ? secret ? 'Encrypted chat is unlocked' : 'Unlock your encrypted chat' : 'Your private conversation'));
    security.append(el('p', 'muted', required ? 'Your recovery key stays in this tab’s memory and is cleared when you leave this page.' : 'Your couple’s current chat privacy setting is shared with Android.'));
    if (!required && !rows.some(row => row.enc)) return;
    if (secret) {
      if (ownKey && peerKey) {
        security.append(el('p', 'fine', 'Compare this safety number with your partner’s Android Privacy screen before sending encrypted messages:'));
        security.append(el('p', 'safety-number', safetyNumber({ id: context.profile.id, key: ownKey }, { id: context.partner.id, key: peerKey })));
        if (trustedPeer !== peerKey) security.append(PressableScale('I verified this number with my partner', () => { trustedPeer = peerKey; recovery(); state(); }));
      }
      security.append(PressableScale('Lock this tab', lock)); return;
    }
    const pass = field('Recovery passphrase', 'password'); recoverPass = pass.input; pass.input.autocomplete = 'off';
    const unlock = PressableScale('Unlock chat', async () => {
      unlock.disabled = true; show(status, 'Unlocking your recovery backup…');
      let derived: Uint8Array | null = null;
      let recovered: Uint8Array | null = null;
      try {
        const result = await db.from('key_backups').select('*').eq('couple_id', context.profile.couple_id).eq('user_id', context.profile.id).single();
        if (result.error) throw result.error;
        for (const name of ['N', 'r', 'p', 'dkLen'] as const) if (result.data.params[name] !== backupParams[name]) throw new Error('Unsupported recovery parameters. Update the web app.');
        derived = await passphraseKey(pass.input.value, result.data.salt); pass.input.value = '';
        const value: unknown = JSON.parse(text(open(result.data.blob, derived)));
        if (!value || typeof value !== 'object' || !('secret' in value) || typeof value.secret !== 'string' || !('public' in value) || typeof value.public !== 'string') throw new Error('Invalid recovery backup.');
        recovered = bytes(value.secret); const pair = keyPair(() => recovered!); const publicKey = b64(pair.publicKey); pair.secretKey.fill(0);
        if (publicKey !== value.public || publicKey !== ownKey) throw new Error('This backup does not match your registered key.');
        if (disposed) return;
        secret?.fill(0); secret = recovered; recovered = null; recovery(); render(); state(); void markRead(); show(status, 'Chat unlocked on this tab.');
      } catch (failure) { if (!disposed) show(status, messageError(failure)); }
      finally { derived?.fill(0); recovered?.fill(0); pass.input.value = ''; unlock.disabled = false; }
    }, 'primary'); security.append(pass.wrapper, unlock);
  }
  async function privacy() {
    const result = await db.from('couples').select('e2ee_enabled').eq('id', context.profile.couple_id).single();
    if (result.error) throw result.error;
    const keys = await db.from('user_keys').select('*').eq('couple_id', context.profile.couple_id);
    if (keys.error) throw keys.error;
    if (disposed) return;
    const nextOwn = keys.data.find(key => key.user_id === context.profile.id)?.public_key || ''; const nextPeer = keys.data.find(key => key.user_id === context.partner.id)?.public_key || '';
    const changed = !ready || required !== result.data.e2ee_enabled || ownKey !== nextOwn || peerKey !== nextPeer;
    if ((peerKey && peerKey !== nextPeer) || (ownKey && ownKey !== nextOwn)) { secret?.fill(0); secret = null; trustedPeer = ''; show(status, 'Encryption keys changed. Verify the safety number in Android before unlocking this tab again.'); }
    required = result.data.e2ee_enabled; ownKey = nextOwn; peerKey = nextPeer; ready = true; if (changed) recovery(); state();
  }
  function body(row: Message): string {
    if (row.deleted_at) return 'This message was deleted';
    if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return 'Message expired';
    if (row.view_once) return 'View-once photo · open in the Android app';
    if (!row.enc) return row.body || (row.kind === 'image' ? 'Photo' : row.kind === 'voice' ? 'Voice message' : 'Message');
    if (!secret) return '🔒 Unlock your recovery key to read this message';
    try {
      const payload = decrypt(row.enc, { couple: row.couple_id, author: row.sender_id, client: row.client_id, kind: row.kind }, secret);
      if (!payload || typeof payload !== 'object' || !('body' in payload) || !('reply' in payload) || payload.reply !== row.reply_to || !('path' in payload) || payload.path !== row.media_path) throw new Error('Invalid message context');
      return typeof payload.body === 'string' ? payload.body : 'Encrypted attachment · open in the Android app';
    } catch { return '🔒 This message uses a different key or cannot be verified'; }
  }
  async function attachment(row: Message, bubble: HTMLElement) {
    if (row.enc || row.view_once || row.deleted_at || (row.expires_at && Date.parse(row.expires_at) <= Date.now()) || !row.media_path || !['image', 'voice'].includes(row.kind)) return;
    try {
      let url = mediaUrls.get(row.media_path);
      if (!url) { const result = await db.storage.from('media').createSignedUrl(row.media_path, 300); if (result.error) throw result.error; url = result.data.signedUrl; mediaUrls.set(row.media_path, url); }
      if (disposed || !bubble.isConnected) return;
      if (row.kind === 'image') { const image = el('img', 'chat-photo'); image.alt = 'Photo from your conversation'; image.loading = 'lazy'; image.src = url; bubble.append(image); }
      else { const audio = el('audio'); audio.controls = true; audio.preload = 'none'; audio.src = url; bubble.append(audio); }
    } catch { if (!disposed && bubble.isConnected) bubble.append(el('p', 'fine', 'Attachment unavailable. Refresh to retry.')); }
  }
  function render() {
    const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 120;
    const height = scroll.scrollHeight; const top = scroll.scrollTop;
    list.replaceChildren();
    if (!rows.length) list.append(card('Say a little hello.', 'This is your space to share the everyday things. Send your first message below.'));
    for (const row of rows) {
      const mine = row.sender_id === context.profile.id; const bubble = el('article', `bubble ${mine ? 'mine' : ''}`);
      if (row.reply_to) bubble.append(el('p', 'quoted fine', '↳ Reply to an earlier message'));
      bubble.append(el('p', 'message-body', body(row)));
      bubble.append(el('p', 'timestamp', `${new Date(row.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${mine ? row.read_at ? ' · Seen' : ' · Sent' : ''}`));
      list.append(bubble); void attachment(row, bubble);
    }
    older.hidden = !hasEarlier || !rows.length;
    if (nearBottom) scroll.scrollTop = scroll.scrollHeight; else scroll.scrollTop = top + scroll.scrollHeight - height;
  }
  async function markRead() {
    if (disposed || document.hidden || !document.hasFocus()) return;
    if (options.embedded) {
      const bounds = scroll.getBoundingClientRect();
      if (document.fullscreenElement || bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
    }
    const ids = rows.filter(row => row.sender_id !== context.profile.id && row.kind === 'text' && !row.read_at && !row.view_once && !row.deleted_at && (!row.enc || (!!secret && !body(row).startsWith('🔒'))) && !(row.expires_at && Date.parse(row.expires_at) <= Date.now())).map(row => row.id);
    if (!ids.length) return;
    const result = await db.from('messages').update({ read_at: new Date().toISOString() }).eq('couple_id', context.profile.couple_id).eq('sender_id', context.partner.id).in('id', ids).is('read_at', null);
    if (result.error && !disposed) show(status, 'Messages loaded; read receipts could not sync.');
  }
  async function load(previous = false) {
    if (loading || disposed) return; loading = true; older.disabled = true;
    const oldHeight = scroll.scrollHeight; const oldTop = scroll.scrollTop;
    try {
      let query = db.from('messages').select('*').eq('couple_id', context.profile.couple_id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
      const first = rows[0]; if (previous && first) query = query.or(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`);
      const result = await query; if (result.error) throw result.error; if (disposed) return;
      const merged = new Map(rows.map(row => [row.id, row])); for (const row of result.data) merged.set(row.id, row);
      rows = [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      if (previous || rows.length <= 50) hasEarlier = result.data.length === 50;
      render(); if (previous) scroll.scrollTop = oldTop + scroll.scrollHeight - oldHeight;
      if (security.querySelectorAll('input').length === 0 && !secret && rows.some(row => row.enc)) recovery(); void markRead();
    } catch (failure) { if (!disposed) show(status, messageError(failure)); } finally { loading = false; older.disabled = false; }
  }
  function renderFailed() {
    pending.replaceChildren();
    for (const item of failed.values()) {
      const note = card('Message not sent', item.body);
      note.append(PressableScale('Retry message', () => deliver(item.body, item.id)), PressableScale('Discard', () => { failed.delete(item.id); renderFailed(); })); pending.append(note);
    }
  }
  async function deliver(value: string, id: string) {
    if (sending) return; sending = true; state(); show(status, 'Sending…');
    try {
      // Fresh setting/key read prevents plaintext fallback when Android enables E2EE.
      await privacy(); if (disposed) return;
      if (required && (!secret || !peerKey || trustedPeer !== peerKey)) throw new Error('Unlock your recovery key and verify the safety number before sending encrypted messages.');
      const existing = await db.from('messages').select('id').eq('couple_id', context.profile.couple_id).eq('client_id', id).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) {
        const enc = required && secret ? encrypt({ body: value, meta: null, reply: null, path: null }, { couple: context.profile.couple_id, author: context.profile.id, client: id, kind: 'text' }, secret, peerKey, length => crypto.getRandomValues(new Uint8Array(length))) : null;
        const result = await db.from('messages').insert({ id, client_id: id, couple_id: context.profile.couple_id, sender_id: context.profile.id, kind: 'text', body: enc ? null : value, enc, media_path: null, reply_to: null }).select('id').single();
        if (result.error) throw result.error;
        if (Date.now() - lastPush > 1500) { lastPush = Date.now(); void db.functions.invoke('notify-partner', { body: { channel: 'messages', title: 'A message for you', body: 'New message', data: { route: '/(tabs)/chat', message_id: id, couple_id: context.profile.couple_id } } }).catch(() => undefined); }
      }
      failed.delete(id); show(status, ''); await load(); scroll.scrollTop = scroll.scrollHeight;
    } catch (failure) { if (!disposed) { failed.set(id, { body: value, id }); show(status, messageError(failure)); } }
    finally { sending = false; if (!disposed) { state(); renderFailed(); } }
  }
  async function sendDraft() { const value = draft.value.trim(); if (!value || !usable()) return; draft.value = ''; await deliver(value, crypto.randomUUID()); draft.focus(); }
  composer.onsubmit = event => { event.preventDefault(); void sendDraft(); };
  draft.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void sendDraft(); } };
  const refresh = async () => { try { await privacy(); await load(); if (!disposed) show(status, ''); } catch (failure) { if (!disposed) show(status, messageError(failure)); } };
  const visibility = () => { state(); if (!document.hidden) void refresh(); };
  document.addEventListener('visibilitychange', visibility); window.addEventListener('online', visibility); window.addEventListener('offline', state); window.addEventListener('focus', markRead);
  if (options.embedded) document.addEventListener('fullscreenchange', markRead);
  const channel = db.channel(`web-chat:${context.profile.couple_id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${context.profile.couple_id}` }, payload => {
      if (payload.eventType === 'DELETE') { rows = rows.filter(row => row.id !== payload.old.id); render(); }
      else { const row = payload.new as Message; rows = [...rows.filter(value => value.id !== row.id), row].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)); render(); void markRead(); }
    }).subscribe(value => { if (!disposed) { if (value === 'SUBSCRIBED') void refresh(); else if (value === 'CHANNEL_ERROR' || value === 'TIMED_OUT') show(status, 'Chat is reconnecting. Your draft is kept; refresh to retry.'); } });
  const timer = setInterval(() => { if (!document.hidden) { render(); void refresh(); } }, 30000);
  list.append(el('p', 'muted', 'Loading your conversation…')); state();
  screen.classList.add('chat-screen'); screen.append(privacyDetails || security, status, PressableScale('Refresh conversation', refresh), scroll, pending, composer);
  void refresh();
  return { screen, cleanup() { disposed = true; secret?.fill(0); secret = null; recoverPass && (recoverPass.value = ''); draft.value = ''; rows = []; failed.clear(); mediaUrls.clear(); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', markRead); window.removeEventListener('online', visibility); window.removeEventListener('offline', state); window.removeEventListener('focus', markRead); void db.removeChannel(channel); } };
}

import { WatchSync, type SyncState } from '../../src/features/movie/sync';
import { matches, type EventName } from '../../src/features/movie/model';
import { db, messageError, type Identity, type WatchSessionRow } from './backend.js';
import { card, el, notice, PressableScale, Screen, show, time } from './ui.js';

export async function pickVideo(): Promise<{ file: File; durationMs: number } | null> {
  const input = el('input'); input.type = 'file'; input.accept = 'video/*,.mkv';
  const file = await new Promise<File | null>(resolve => {
    input.onchange = () => resolve(input.files?.[0] || null);
    input.addEventListener('cancel', () => resolve(null), { once: true }); input.click();
  });
  if (!file) return null;
  const video = el('video'); video.preload = 'metadata'; const url = URL.createObjectURL(file);
  try {
    const durationMs = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Could not read this video. Try an MP4 with H.264 video and AAC audio.')), 20000);
      video.onloadedmetadata = () => { clearTimeout(timer); Number.isFinite(video.duration) && video.duration > 0 ? resolve(Math.round(video.duration * 1000)) : reject(new Error('This file has no usable duration.')); };
      video.onerror = () => { clearTimeout(timer); reject(new Error('Your browser cannot decode this file. Try an MP4 with H.264 video and AAC audio.')); };
      video.src = url;
    });
    return { file, durationMs };
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}

export function watchLobby(context: Identity, open: (room: WatchSessionRow, file: File) => void) {
  const screen = Screen('Movie night, together.', 'SAME MOVIE. SAME MOMENT.');
  const hero = card('A shared screen, miles apart.', 'Choose the same movie on both devices. Your file stays on your device; only playback controls travel between you.'); hero.classList.add('hero');
  const status = notice(); const list = el('div', 'stack'); let disposed = false; let refreshing = false;
  const create = PressableScale('＋ Pick a movie & invite', async () => {
    create.disabled = true; show(status, '');
    try {
      const picked = await pickVideo(); if (!picked || disposed) return;
      const result = await db.from('watch_sessions').insert({ couple_id: context.profile.couple_id, host_id: context.profile.id, title: picked.file.name, file_size: picked.file.size, duration_ms: picked.durationMs }).select('*').single();
      if (result.error) throw result.error; if (!disposed) open(result.data, picked.file);
    } catch (error) { show(status, messageError(error)); } finally { create.disabled = false; }
  }, 'primary');
  async function refresh() {
    if (disposed || refreshing || document.hidden) return; refreshing = true;
    try {
      const result = await db.from('watch_sessions').select('*').eq('couple_id', context.profile.couple_id).neq('status', 'ended').order('created_at', { ascending: false }).limit(30);
      if (result.error) throw result.error; if (disposed) return;
      list.replaceChildren();
      if (!result.data.length) list.append(card('Your next movie night starts here', 'No open invitations yet. Pick a movie you both have to start a session.'));
      for (const room of result.data) {
        const item = card(room.title || 'Untitled movie', `${room.host_id === context.profile.id ? 'Your invitation' : 'Your partner invited you'} · ${time((room.duration_ms || 0) / 1000)} · ${Math.round((room.file_size || 0) / 1048576)} MB`);
        const join = PressableScale('Join with my local copy →', async () => {
          join.disabled = true; show(status, '');
          try {
            const picked = await pickVideo(); if (!picked || disposed) return;
            if (!matches({ uri: '', name: picked.file.name, size: picked.file.size, durationMs: picked.durationMs }, room)) throw new Error('This copy does not match. Choose the same file size and duration as your partner.');
            open(room, picked.file);
          } catch (error) { show(status, messageError(error)); } finally { join.disabled = false; }
        });
        item.append(join); list.append(item);
      }
      show(status, '');
    } catch (error) { if (!disposed) show(status, messageError(error)); } finally { refreshing = false; }
  }
  list.append(el('p', 'muted', 'Loading invitations…'));
  screen.append(hero, create, status, el('h2', '', 'Your invitations'), list, PressableScale('Refresh invitations', refresh), el('p', 'muted fine', 'Use an unprotected local movie file that both devices can decode. Streaming services and DRM downloads cannot be played here. MP4 with H.264/AAC works across most browsers and Android devices.'));
  const channel = db.channel(`web-watch-list:${context.profile.couple_id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'watch_sessions', filter: `couple_id=eq.${context.profile.couple_id}` }, () => { void refresh(); }).subscribe();
  const timer = setInterval(() => { void refresh(); }, 10000); void refresh();
  return { screen, cleanup: () => { disposed = true; clearInterval(timer); void db.removeChannel(channel); } };
}

export function watchRoom(context: Identity, room: WatchSessionRow, file: File, back: () => void) {
  const screen = Screen(room.title || 'Our movie night', 'WATCH TOGETHER');
  const video = el('video', 'movie'); video.playsInline = true; video.preload = 'auto';
  const url = URL.createObjectURL(file); let disposed = false; let channel: ReturnType<typeof db.channel> | null = null;
  let generation = 0; let subscribed = false; let checking = false; let lastSaved = 0; let lastCheck = 0; let enabled = false;
  const positionKey = `us-watch-position:${context.profile.id}:${room.id}`;
  const status = notice(); const error = notice(); error.setAttribute('role', 'alert');
  const telemetry = el('p', 'muted fine'); const reaction = el('p', 'reaction'); reaction.setAttribute('aria-live', 'polite');
  const timeline = el('input'); timeline.type = 'range'; timeline.min = '0'; timeline.max = String((room.duration_ms || 0) / 1000); timeline.step = '0.1'; timeline.value = '0'; timeline.setAttribute('aria-label', 'Seek movie for both partners');
  const clock = el('span', 'muted fine', '0:00');
  let sync: WatchSync;
  const play = PressableScale('▶ Play together', () => { sync.control(video.paused ? 'play' : 'pause'); }, 'primary');
  const fullscreen = PressableScale('⛶ Fullscreen', async () => { try { await playerCard.requestFullscreen(); } catch { show(error, 'Fullscreen is unavailable in this browser.'); } });
  const enable = PressableScale('Enable playback on this browser', async () => {
    enable.disabled = true;
    try { await video.play(); video.pause(); enabled = true; sync.setReady(video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA); enable.hidden = true; show(error, ''); }
    catch (failure) { show(error, `Playback could not start: ${messageError(failure)}`); }
    finally { enable.disabled = false; }
  }, 'primary');
  const playerCard = el('section', 'player-card'); const controls = el('div', 'controls');
  const volume = el('input'); volume.type = 'range'; volume.min = '0'; volume.max = '1'; volume.step = '0.05'; volume.value = '1'; volume.setAttribute('aria-label', 'Local volume'); volume.oninput = () => { video.volume = Number(volume.value); };
  controls.append(play, clock, fullscreen); playerCard.append(video, timeline, controls, el('label', 'muted fine', 'Volume on this device'), volume);
  function changed(state: SyncState) {
    if (disposed) return;
    show(status, state.notice); play.disabled = !enabled || state.ended || !state.bothReady;
    play.textContent = video.paused ? '▶ Play together' : 'Ⅱ Pause together';
    timeline.disabled = !enabled || state.ended || !state.bothReady;
    telemetry.textContent = state.ended ? 'Session ended · Your position is saved on this browser' : `${state.connected ? 'Connected' : 'Reconnecting'} · ${state.partnerHere ? 'Partner connected' : 'Waiting for partner'} · ${state.bothReady ? 'Both ready' : 'Waiting for both ready'} · latency ${Math.round(state.latency)} ms · drift ${state.drift.toFixed(2)} s`;
  }
  sync = new WatchSync({
    user: context.profile.id, partner: context.partner.id, host: room.host_id, client: crypto.randomUUID(),
    player: { get currentTime() { return video.currentTime; }, set currentTime(value) { video.currentTime = value; }, get duration() { return video.duration; }, get playbackRate() { return video.playbackRate; }, set playbackRate(value) { video.playbackRate = value; }, get playing() { return !video.paused; },
      play() { if (video.paused) void video.play().catch(() => { if (!disposed) { enabled = false; sync.setReady(false); enable.hidden = false; show(error, 'Your browser blocked playback. Tap Enable playback, then Play together.'); } }); }, pause() { video.pause(); } },
    change: changed, reaction: emoji => { reaction.textContent = emoji; },
    send(event, payload) {
      if (!channel || !subscribed || disposed || (document.hidden && !['pause', 'leave'].includes(event))) return;
      // The initial ready packet discovers peers; recurring traffic needs a peer.
      if (['heartbeat', 'ping', 'reaction'].includes(event) && !sync.state.partnerHere) return;
      void channel.send({ type: 'broadcast', event, payload }).then(result => { if (result !== 'ok' && !disposed) { sync.connect(false); show(error, 'Sync delivery failed. Reconnect to continue.'); } }).catch(() => { if (!disposed) sync.connect(false); });
    },
  });
  async function checkSession() {
    if (checking || disposed || document.hidden) return; checking = true; lastCheck = Date.now();
    try {
      const result = await db.from('watch_sessions').select('status').eq('id', room.id).eq('couple_id', context.profile.couple_id).single();
      if (disposed) return; if (result.error) throw result.error; if (result.data.status === 'ended') sync.end(false);
    } catch (failure) { if (!disposed) { sync.connect(false); show(error, messageError(failure)); } } finally { checking = false; }
  }
  async function connect() {
    const attempt = ++generation;
    subscribed = false; sync.connect(false); if (channel) { const old = channel; channel = null; await db.removeChannel(old); }
    await db.realtime.setAuth(); if (disposed || attempt !== generation) return;
    const events: EventName[] = ['play', 'pause', 'seek', 'ready', 'heartbeat', 'end', 'ping', 'pong', 'reaction', 'leave'];
    channel = db.channel(`watch:${room.id}`, { config: { private: true, broadcast: { self: false, ack: true } } })
      .on('broadcast', { event: '*' }, ({ event, payload }: { event: string; payload: unknown }) => { if (!disposed && events.includes(event as EventName)) sync.receive(event as EventName, payload); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_sessions', filter: `id=eq.${room.id}` }, ({ new: row }) => { if (row.status === 'ended') sync.end(false); })
      .subscribe(value => { if (disposed || attempt !== generation) return; subscribed = value === 'SUBSCRIBED'; sync.connect(subscribed); if (subscribed) { show(error, ''); void checkSession(); } });
  }
  video.onloadedmetadata = () => { const saved = Number(localStorage.getItem(positionKey)); video.currentTime = Number.isFinite(saved) ? Math.min(saved, Math.max(0, video.duration - 0.1)) : 0; timeline.max = String(video.duration); };
  video.oncanplay = () => { sync.setReady(enabled); };
  video.onwaiting = () => sync.setReady(false);
  video.onpause = () => sync.unexpectedPause();
  video.onended = () => sync.control('pause');
  video.onerror = () => { sync.setReady(false); show(error, 'Could not decode this movie. Leave and choose a browser-compatible local copy.'); };
  video.ontimeupdate = () => { timeline.value = String(video.currentTime); clock.textContent = `${time(video.currentTime)} / ${time(video.duration || 0)}`; };
  timeline.onchange = () => sync.control('seek', Number(timeline.value));
  const visibility = () => { sync.setForeground(!document.hidden); save(); if (!document.hidden) void checkSession(); };
  function save() { if (Number.isFinite(video.currentTime)) try { localStorage.setItem(positionKey, String(video.currentTime)); } catch { /* Playback still works without position storage. */ } }
  document.addEventListener('visibilitychange', visibility);
  const timer = setInterval(() => {
    if (document.hidden) return; sync.tick();
    if (Date.now() - lastSaved >= 2000) { save(); lastSaved = Date.now(); }
    if (Date.now() - lastCheck >= 10000) void checkSession();
  }, 250);
  const reactions = el('div', 'controls'); for (const emoji of ['❤️', '😂', '😮', '🥹', '👏']) reactions.append(PressableScale(emoji, () => { if (sync.state.partnerHere) sync.reaction(emoji); }));
  const end = PressableScale('End session for both', async () => {
    end.disabled = true;
    try { const result = await db.from('watch_sessions').update({ status: 'ended' }).eq('id', room.id).eq('couple_id', context.profile.couple_id).select('id').single(); if (result.error) throw result.error; sync.end(); }
    catch (failure) { show(error, messageError(failure)); } finally { end.disabled = false; }
  });
  screen.append(PressableScale('← Back to movie nights', back), playerCard, enable, status, error, telemetry, reactions, reaction, PressableScale('Reconnect / retry playback', async () => { try { if (video.error) video.load(); await connect(); } catch (failure) { show(error, messageError(failure)); } }), end);
  video.src = url; void connect().catch(failure => show(error, messageError(failure)));
  return { screen, cleanup() { save(); sync.leave(); disposed = true; generation++; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); if (channel) void db.removeChannel(channel); video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); } };
}

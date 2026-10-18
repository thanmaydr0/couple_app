import { WatchSync, type SyncState } from './watch-sync.js';
import { matches, type EventName } from '../../src/features/movie/model';
import { db, messageError, type Identity, type WatchSessionRow } from './backend.js';
import { el, notice, PressableScale, Screen, show, time } from './ui.js';
import { MovieEngine, movieDuration } from './media-engine.js';
import { mediaSettings } from './media-settings.js';
import { fullscreenPlayer } from './fullscreen-player.js';
import { chatScreen } from './chat.js';
import { mountWatchLobbyView, type WatchLobbyProps } from './watch-lobby-view.js';

export async function pickVideo(): Promise<{ file: File; durationMs: number } | null> {
  const input = el('input'); input.type = 'file'; input.accept = 'video/*,.mkv,.avi,.mov,.m4v,.webm,.ts';
  const file = await new Promise<File | null>(resolve => {
    input.onchange = () => resolve(input.files?.[0] || null);
    input.addEventListener('cancel', () => resolve(null), { once: true }); input.click();
  });
  if (!file) return null;
  return { file, durationMs: await movieDuration(file) };
}

export function watchLobby(context: Identity, open: (room: WatchSessionRow, file: File) => void) {
  const screen = Screen('Movie night,\ntogether.', 'SAME MOVIE. SAME MOMENT.'); screen.classList.add('watch-lobby-screen');
  const mount = el('div', 'watch-lobby-root'); screen.append(mount);
  let sessions: WatchSessionRow[] | null = null; let error: string | null = null; let picking = false; let disposed = false; let refreshing = false;
  const joining = new Set<string>(); const seenInvitations = new Set<string>(); const pendingEntrance = new Set<string>();
  const view = mountWatchLobbyView(mount);
  function render() {
    if (disposed) return;
    const props: WatchLobbyProps = { userId: context.profile.id, sessions, error, picking, joining, onPick: () => { void create(); }, onJoin: room => { void join(room); }, onRefresh: () => { void refresh(); } };
    view.render(props);
    const entering = new Set(pendingEntrance); pendingEntrance.clear();
    if (entering.size) requestAnimationFrame(() => {
      if (disposed) return;
      for (const item of mount.querySelectorAll<HTMLElement>('[data-session-id]')) {
        if (entering.has(item.dataset.sessionId ?? '') && item.getBoundingClientRect().top < window.innerHeight) item.classList.add('watch-invitation-enter');
      }
    });
  }
  async function create() {
    if (picking || disposed) return;
    picking = true; error = null; render();
    try {
      const picked = await pickVideo(); if (!picked || disposed) return;
      const result = await db.from('watch_sessions').insert({ couple_id: context.profile.couple_id, host_id: context.profile.id, title: picked.file.name, file_size: picked.file.size, duration_ms: picked.durationMs }).select('*').single();
      if (result.error) throw result.error; if (!disposed) open(result.data, picked.file);
    } catch (failure) { if (!disposed) error = messageError(failure); }
    finally { picking = false; render(); }
  }
  async function join(room: WatchSessionRow) {
    if (joining.has(room.id) || disposed) return;
    joining.add(room.id); error = null; render();
    try {
      const picked = await pickVideo(); if (!picked || disposed) return;
      if (!matches({ uri: '', name: picked.file.name, size: picked.file.size, durationMs: picked.durationMs }, room)) throw new Error('This copy does not match. Choose the same file size and duration as your partner.');
      open(room, picked.file);
    } catch (failure) { if (!disposed) error = messageError(failure); }
    finally { joining.delete(room.id); render(); }
  }
  async function refresh() {
    if (disposed || refreshing || document.hidden) return; refreshing = true;
    try {
      const result = await db.from('watch_sessions').select('*').eq('couple_id', context.profile.couple_id).neq('status', 'ended').order('created_at', { ascending: false }).limit(30);
      if (result.error) throw result.error; if (disposed) return;
      sessions = result.data; error = null;
      for (const room of sessions) { if (!seenInvitations.has(room.id)) { seenInvitations.add(room.id); pendingEntrance.add(room.id); } }
    } catch (failure) { if (!disposed) error = messageError(failure); }
    finally { refreshing = false; render(); }
  }
  render();
  const channel = db.channel(`web-watch-list:${context.profile.couple_id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'watch_sessions', filter: `couple_id=eq.${context.profile.couple_id}` }, () => { void refresh(); }).subscribe();
  const timer = setInterval(() => { void refresh(); }, 10000); void refresh();
  return { screen, cleanup: () => { disposed = true; clearInterval(timer); view.unmount(); void db.removeChannel(channel); } };
}

export function watchRoom(context: Identity, room: WatchSessionRow, file: File, back: () => void, restart = back) {
  const screen = Screen(room.title || 'Our movie night', 'WATCH TOGETHER');
  screen.classList.add('watch-screen');
  const surface = el('div', 'movie'); const video = new MovieEngine(surface);
  let disposed = false; let channel: ReturnType<typeof db.channel> | null = null;
  let generation = 0; let subscribed = false; let checking = false; let lastSaved = 0; let lastCheck = 0; let enabled = false;
  const positionKey = `us-watch-position:${context.profile.id}:${room.id}`;
  const status = notice(); const error = notice(); error.setAttribute('role', 'alert');
  const telemetry = el('p', 'muted fine'); const reaction = el('p', 'reaction'); reaction.setAttribute('aria-live', 'polite');
  const timeline = el('input'); timeline.type = 'range'; timeline.min = '0'; timeline.max = String((room.duration_ms || 0) / 1000); timeline.step = '0.1'; timeline.value = '0'; timeline.setAttribute('aria-label', 'Seek movie for both partners');
  const clock = el('span', 'muted fine', '0:00');
  let scrubbing = false;
  let keyboardSeeking = false;
  let sync: WatchSync;
  const play = PressableScale('▶ Play together', () => { if (!video.paused) sync.control('pause'); else sync.control('play',video.currentTime>=video.duration-1?0:video.currentTime); }, 'primary');
  const fullscreen = PressableScale('⛶ Fullscreen', async () => { try { if (document.fullscreenElement === playerCard) await document.exitFullscreen(); else await playerCard.requestFullscreen(); } catch { show(error, 'Fullscreen is unavailable in this browser.'); } });
  const enable = PressableScale('Enable playback on this browser', async () => {
    enable.disabled = true;
    try { await loaded; await video.enable(); enabled = true; sync.setReady(true); enable.hidden = true; show(error, ''); }
    catch (failure) { show(error, `Playback could not start: ${messageError(failure)}`); }
    finally { enable.disabled = false; }
  }, 'primary');
  enable.disabled=true;
  const playerCard = el('section', 'player-card'); const controls = el('div', 'controls');
  const playerOverlay = el('div', 'player-overlay');
  const trackSettings = el('details', 'track-settings'); const settingsToggle = el('summary', 'pressable', 'Audio & captions · this device');
  const tracks = mediaSettings(video); trackSettings.append(settingsToggle, tracks.node);
  const presentation = fullscreenPlayer(playerCard, video, fullscreen);
  const volume = el('input'); volume.type = 'range'; volume.min = '0'; volume.max = '1'; volume.step = '0.05'; volume.value = '1'; volume.setAttribute('aria-label', 'Local volume'); volume.oninput = () => { video.volume = Number(volume.value); };
  const jump = el('input'); jump.type='text'; jump.placeholder='hh:mm:ss'; jump.setAttribute('aria-label','Jump to movie time');
  const jumpButton = PressableScale('Go to time',()=>{
    const parts=jump.value.trim().split(':').map(Number); const position=parts.reduce((sum,part)=>sum*60+part,0);
    if (!/^\d+(?::[0-5]?\d){0,2}$/.test(jump.value.trim()) || parts.length>3 || parts.some(part=>!Number.isFinite(part)||part<0) || position>video.duration) { show(error,'Enter a time within the movie, such as 12:30 or 1:02:30.'); return; }
    sync.control('seek',position); show(error,'');
  });
  const seekTools = el('div','seek-tools'); seekTools.append(jump,jumpButton);
  const backward=PressableScale('↶ 10s',()=>sync.control('seek',Math.max(0,video.currentTime-10)));
  const forward=PressableScale('10s ↷',()=>sync.control('seek',Math.min(video.duration,video.currentTime+10)));
  const mute=PressableScale('Mute',()=>{video.volume=video.volume>0?0:Number(volume.value)||1;if(video.volume>0)volume.value=String(video.volume);mute.textContent=video.volume>0?'Mute':'Unmute';});
  volume.oninput=()=>{video.volume=Number(volume.value);mute.textContent=video.volume>0?'Mute':'Unmute';};
  jump.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();jumpButton.click();}};
  const volumeControls=el('div','volume-controls');volumeControls.append(el('span','muted fine','Volume on this device'),volume,mute);
  controls.append(play, backward, forward, clock, fullscreen); playerOverlay.append(enable,timeline, controls, seekTools, trackSettings,volumeControls,error); playerCard.append(surface, playerOverlay);
  function changed(state: SyncState) {
    if (disposed) return;
    show(status, state.bothReady && state.notice === 'Waiting for your partner…' ? 'Both ready. Choose Play together.' : state.notice); play.disabled = !enabled || state.ended || !state.bothReady;
    play.textContent = video.paused ? '▶ Play together' : 'Ⅱ Pause together';
    timeline.disabled = !enabled || state.ended || !state.bothReady;
    jump.disabled=timeline.disabled; jumpButton.disabled=timeline.disabled;
    backward.disabled=timeline.disabled; forward.disabled=timeline.disabled;
    telemetry.textContent = state.ended ? 'Session ended · Your position is saved on this browser' : `${state.connected ? 'Connected' : 'Reconnecting'} · ${state.partnerHere ? 'Partner connected' : 'Waiting for partner'} · ${state.bothReady ? 'Both ready' : 'Waiting for both ready'} · latency ${Math.round(state.latency)} ms · drift ${state.drift.toFixed(2)} s`;
  }
  sync = new WatchSync({
    user: context.profile.id, partner: context.partner.id, host: room.host_id, client: crypto.randomUUID(),
    player: video,
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
  video.addEventListener('loadedmetadata', () => { const saved = Number(localStorage.getItem(positionKey)); video.currentTime = Number.isFinite(saved) && saved < video.duration - 1 ? Math.max(0,saved) : 0; timeline.max = String(video.duration); clock.textContent=`${time(video.currentTime)} / ${time(video.duration)}`; });
  video.addEventListener('ended', () => sync.control('pause'));
  video.addEventListener('error', () => { sync.setReady(false); show(error,video.failure || 'Decoder failed. Use Reconnect / retry playback.'); });
  video.addEventListener('timeupdate', () => { if (!scrubbing) timeline.value = String(video.currentTime); clock.textContent = `${time(scrubbing?Number(timeline.value):video.currentTime)} / ${time(video.duration || 0)}${scrubbing?' · preview':''}`; });
  timeline.oninput = () => { scrubbing = true; clock.textContent=`${time(Number(timeline.value))} / ${time(video.duration)} · preview`; };
  const commitSeek=()=>{const target=Number(timeline.value);scrubbing=false;sync.control('seek',target);};
  timeline.onchange = () => { if(!keyboardSeeking)commitSeek(); };
  timeline.onkeydown=event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))keyboardSeeking=true;};
  timeline.onkeyup=()=>{if(keyboardSeeking){keyboardSeeking=false;commitSeek();}};
  timeline.onblur=()=>{if(keyboardSeeking){keyboardSeeking=false;commitSeek();}};
  timeline.addEventListener('pointercancel',()=>{scrubbing=false;timeline.value=String(video.currentTime);});
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
  const connection=el('details','connection-details');connection.append(el('summary','pressable','Connection details'),telemetry);
  const chat = chatScreen(context, { embedded: true });
  const layout = el('div', 'watch-layout');
  const playerColumn = el('div', 'watch-player-column');
  playerColumn.append(playerCard, status, connection, reactions, reaction, PressableScale('Reconnect / retry playback', restart), end);
  layout.append(playerColumn, chat.screen);
  screen.append(PressableScale('← Back to movie nights', back), layout);
  const loaded=video.load(file).then(()=>{if(!disposed)enable.disabled=false;}).catch(failure=>{if(!disposed)show(error,messageError(failure));throw failure;}); void loaded.catch(()=>undefined);
  void connect().catch(failure => show(error, messageError(failure)));
  return { screen, cleanup() { save(); sync.leave(); disposed = true; generation++; clearInterval(timer); presentation.cleanup(); tracks.cleanup(); chat.cleanup(); document.removeEventListener('visibilitychange', visibility); if (channel) void db.removeChannel(channel); video.pause(); void video.destroy().catch(()=>undefined); } };
}

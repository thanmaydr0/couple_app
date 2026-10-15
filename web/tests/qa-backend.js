// Explicit --qa server only. Never copied into dist or used against Supabase.
(() => {
  // Both fixture tabs act as foreground devices for the two-device simulation.
  // Production code always reads the actual browser visibility/focus state.
  Object.defineProperty(document, 'hidden', { get: () => false });
  document.hasFocus = () => true;
  const host = '00000000-0000-4000-8000-000000000001';
  const guest = '00000000-0000-4000-8000-000000000002';
  const couple = '00000000-0000-4000-8000-000000000003';
  const uid = new URLSearchParams(location.search).get('user') === 'guest' ? guest : host;
  const key = 'us-web-qa-fixture-v1';
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
    profiles: [{ id: host, couple_id: couple, display_name: 'QA Host' }, { id: guest, couple_id: couple, display_name: 'QA Guest' }],
    couples: [{ id: couple, anniversary: null, e2ee_enabled: false }], user_keys: [], key_backups: [], messages: [], watch_sessions: [],
  }));
  const bus = new BroadcastChannel('us-web-qa-bus'); const channels = new Set(); let authCallback;
  function publish(event) { bus.postMessage(event); dispatch(event); }
  function dispatch(event) {
    for (const channel of channels) for (const listener of channel.listeners) {
      if (listener.type === 'broadcast' && channel.topic === event.topic && event.client !== channel.client) listener.callback({ event: event.event, payload: event.payload });
      if (listener.type === 'postgres_changes' && event.table === listener.filter.table && (listener.filter.event === '*' || listener.filter.event === event.eventType)) listener.callback(event);
    }
  }
  bus.onmessage = event => dispatch(event.data);
  function from(table) {
    const filters = []; const sorts = []; let operation = 'read'; let value; let maximum = Infinity; let single = false; let maybe = false;
    const query = {
      select() { return query; }, eq(k, v) { filters.push(row => row[k] === v); return query; }, neq(k, v) { filters.push(row => row[k] !== v); return query; },
      is(k, v) { filters.push(row => (row[k] ?? null) === v); return query; }, in(k, values) { filters.push(row => values.includes(row[k])); return query; },
      or() { return query; }, order(k, options = {}) { sorts.push([k, options.ascending !== false]); return query; }, limit(n) { maximum = n; return query; },
      single() { single = true; return query; }, maybeSingle() { single = true; maybe = true; return query; },
      insert(row) { operation = 'insert'; value = row; return query; }, update(row) { operation = 'update'; value = row; return query; },
      then(resolve) {
        const store = JSON.parse(localStorage.getItem(key)); let selected = store[table].filter(row => filters.every(filter => filter(row)));
        if (operation === 'insert') {
          const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), status: 'open', read_at: null, deleted_at: null, expires_at: null, view_once: false, enc: null, ...value };
          store[table].push(row); selected = [row]; localStorage.setItem(key, JSON.stringify(store)); publish({ table, eventType: 'INSERT', new: row, old: {} });
        } else if (operation === 'update') {
          for (const row of selected) Object.assign(row, value);
          localStorage.setItem(key, JSON.stringify(store)); for (const row of selected) publish({ table, eventType: 'UPDATE', new: row, old: {} });
        }
        selected.sort((a, b) => { for (const [k, ascending] of sorts) { const order = String(a[k]).localeCompare(String(b[k])); if (order) return ascending ? order : -order; } return 0; }); selected = selected.slice(0, maximum);
        return Promise.resolve({ data: single ? selected[0] || null : selected, error: single && !selected.length && !maybe ? { message: 'QA row not found' } : null }).then(resolve);
      },
    }; return query;
  }
  const session = { user: { id: uid }, access_token: 'qa-only' };
  window.US_CONFIG = { url: 'https://qa.invalid', anonKey: 'qa-only' };
  window.supabase = { createClient: () => ({
    from, auth: {
      onAuthStateChange(callback) { authCallback = callback; queueMicrotask(() => callback('INITIAL_SESSION', session)); return { data: { subscription: { unsubscribe() {} } } }; },
      getSession: async () => ({ data: { session }, error: null }), signOut: async () => { authCallback('SIGNED_OUT', null); return { error: null }; },
    }, realtime: { setAuth: async () => {} }, functions: { invoke: async () => ({ error: null }) },
    channel(topic) {
      const channel = { topic, client: crypto.randomUUID(), listeners: [],
        on(type, filter, callback) { channel.listeners.push({ type, filter, callback }); return channel; },
        subscribe(callback) { channels.add(channel); queueMicrotask(() => callback?.('SUBSCRIBED')); return channel; },
        send: async ({ event, payload }) => { publish({ topic, event, payload, client: channel.client }); return 'ok'; },
      }; return channel;
    }, removeChannel: async channel => { channels.delete(channel); },
  }) };
})();

import type { Video } from './types';
export type YouTubeLink = { videoId: string | null; playlistId: string | null };
export const validVideoId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
export function parseYouTube(text: string): YouTubeLink {
  const links = text.match(/(?:https?:\/\/)?(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\/[^\s<>"']+/gi) ?? [];
  for (const raw of links) {
    let url: URL;
    try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { continue; }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) continue;
    const host = url.hostname.toLowerCase();
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'].includes(host)) continue;
    const parts = url.pathname.split('/').filter(Boolean); const kind = parts[0] ?? '';
    const candidate = host.endsWith('youtu.be') ? parts[0] : kind === 'watch' || kind === 'playlist' ? url.searchParams.get('v') : ['shorts', 'embed', 'live'].includes(kind) ? parts[1] : null;
    const playlist = url.searchParams.get('list');
    const playlistId = playlist && /^[A-Za-z0-9_-]{10,100}$/.test(playlist) ? playlist : null;
    if (validVideoId(candidate)) return { videoId: candidate, playlistId };
    if (parts[0] === 'playlist' && playlistId) return { videoId: null, playlistId };
  }
  throw new Error('Paste a YouTube watch, short, youtu.be or public playlist link.');
}
export async function fetchVideo(videoId: string, signal?: AbortSignal): Promise<Video> {
  if (!validVideoId(videoId)) throw new Error('Invalid YouTube video id.');
  const timeout = new AbortController(); const timer = setTimeout(() => timeout.abort(), 12000);
  const cancel = () => timeout.abort(); signal?.addEventListener('abort', cancel);
  try {
    if (signal?.aborted) timeout.abort();
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, { signal: timeout.signal });
    if (!response.ok) throw new Error('YouTube could not validate this video. It may be private, removed or unavailable.');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('title' in data) || typeof data.title !== 'string') throw new Error('YouTube returned an invalid preview.');
    // Use only the validated id for images; never load arbitrary oEmbed HTML.
    return { videoId, title: data.title.slice(0, 300), thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
export function videoList(value: unknown): Video[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v: unknown): v is Video => !!v && typeof v === 'object' && 'videoId' in v && validVideoId(v.videoId) && 'title' in v && typeof v.title === 'string' && 'thumbnail' in v && typeof v.thumbnail === 'string').slice(0, 50).map(v => ({ ...v, thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` }));
}

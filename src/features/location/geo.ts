import type { Destination, LocationPoint, ShareMode } from './types';
export function isLive(until: string, now = Date.now()) { return until === 'infinity' || Date.parse(until) > now; }
export function sameExpiry(a: string, b: string) { return a === b || (Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b)); }
export function expiry(mode: ShareMode, now = Date.now()) { return mode === 'until-stop' ? 'infinity' : new Date(now + (mode === 'eight' ? 8 : 1) * 3_600_000).toISOString(); }
export function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function updateInterval(speed: number | null) { return (speed ?? 0) >= 4 ? 10_000 : (speed ?? 0) >= 0.5 ? 20_000 : 300_000; }
export function estimate(meters: number, speed: number | null, direction: 'away' | 'left' = 'away') { return `${(meters / 1000).toFixed(1)} km ${direction} · ${speed && speed >= 0.5 ? `about ${Math.max(1, Math.round(meters / speed / 60))} min at current speed` : 'ETA unavailable while stationary'}`; }
export function age(point: LocationPoint, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(point.updated_at)) / 1000));
  return seconds < 30 ? 'just now' : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)} min ago`;
}
export function accuracyRing(point: LocationPoint) {
  const radius = Math.min(point.accuracy ?? 0, 100_000);
  return Array.from({ length: 49 }, (_, i) => {
    const angle = i / 48 * 2 * Math.PI;
    return [point.lon + radius * Math.cos(angle) / (111_320 * Math.max(0.01, Math.cos(point.lat * Math.PI / 180))), Math.max(-90, Math.min(90, point.lat + radius * Math.sin(angle) / 111_320))];
  });
}
export async function searchDestinations(name: string, signal?: AbortSignal): Promise<Destination[]> {
  if (name.trim().length < 2) return [];
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=6&language=en&format=json`, { signal });
  if (!response.ok) throw new Error('Destination search is unavailable. Try a saved place.');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('results' in body) || !Array.isArray(body.results)) return [];
  return body.results.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || !('name' in item) || typeof item.name !== 'string' || !('latitude' in item) || typeof item.latitude !== 'number' || !('longitude' in item) || typeof item.longitude !== 'number') return [];
    const region = 'admin1' in item && typeof item.admin1 === 'string' ? `, ${item.admin1}` : '';
    return [{ name: `${item.name}${region}`, lat: item.latitude, lon: item.longitude }];
  });
}

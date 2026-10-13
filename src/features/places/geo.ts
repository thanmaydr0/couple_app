import asset from './world-paths.json';
import type { Place, Suggestion } from './types';
const radians = Math.PI / 180;
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = (b.lat - a.lat) * radians, dLon = (b.lon - a.lon) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
export function project(lat: number, lon: number): { x: number; y: number } {
  const a1 = 1.340264, a2 = -0.081106, a3 = 0.000893, a4 = 0.003796;
  const theta = Math.asin(Math.sqrt(3) / 2 * Math.sin(lat * radians)), t2 = theta * theta, t6 = t2 * t2 * t2;
  const x = lon * radians * Math.cos(theta) / (Math.sqrt(3) / 2 * (a1 + 3 * a2 * t2 + t6 * (7 * a3 + 9 * a4 * t2)));
  const y = theta * (a1 + a2 * t2 + t6 * (a3 + a4 * t2));
  return { x: x * asset.scale + (asset.translate[0] ?? 0), y: -y * asset.scale + (asset.translate[1] ?? 0) };
}
export function greatCircle(a: { lat: number; lon: number }, b: { lat: number; lon: number }): string {
  const vector = (p: typeof a) => [Math.cos(p.lat * radians) * Math.cos(p.lon * radians), Math.cos(p.lat * radians) * Math.sin(p.lon * radians), Math.sin(p.lat * radians)] as const;
  const u = vector(a), v = vector(b), d = Math.acos(Math.max(-1, Math.min(1, u[0]*v[0] + u[1]*v[1] + u[2]*v[2])));
  if (d < 1e-7) return '';
  // Near-antipodal points have no unique shortest arc; choose a stable midpoint.
  if (Math.PI - d < 1e-5) { const mid = { lat: 0, lon: a.lon + 90 > 180 ? a.lon - 270 : a.lon + 90 }; return greatCircle(a, mid) + greatCircle(mid, b); }
  let result = '', previousX: number | undefined;
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, s = Math.sin((1-t)*d)/Math.sin(d), e = Math.sin(t*d)/Math.sin(d);
    const x = s*u[0]+e*v[0], y=s*u[1]+e*v[1], z=s*u[2]+e*v[2];
    const p = project(Math.atan2(z, Math.hypot(x,y))/radians, Math.atan2(y,x)/radians);
    result += `${previousX === undefined || Math.abs(p.x-previousX)>asset.width/2 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`; previousX = p.x;
  }
  return result;
}
export function stats(places: Place[]) {
  // 193 UN members plus the Holy See and Palestine; territories remain map pins.
  const countries = new Set('AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW VA PS'.split(' '));
  const visited = places.filter(p => p.kind !== 'wishlist');
  const ordered = visited.filter(p => p.visited_on).sort((a,b) => (a.visited_on ?? '').localeCompare(b.visited_on ?? '') || a.created_at.localeCompare(b.created_at));
  return { countries: new Set(visited.map(p => p.country_code).filter((code): code is string => !!code && countries.has(code))).size,
    cities: new Set(visited.map(p => `${p.name.toLowerCase()}:${p.country_code ?? ''}`)).size,
    km: Math.round(ordered.reduce((sum,p,i) => sum + (i ? haversine(ordered[i-1]!,p) : 0),0)) };
}
export function clusterPhotos(points: { lat: number; lon: number; date: string | null }[]): Suggestion[] {
  const groups: Suggestion[] = [];
  for (const point of points) { const group = groups.find(g => haversine(g, point) <= 20); if (group) group.count++; else groups.push({ ...point, count: 1 }); }
  return groups.sort((a,b) => b.count-a.count);
}
export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }

import { themes, type ThemeColors } from '@/theme';
import { projectMessage } from '@/features/chat/body';
import type { BookOptions, BookSource } from './types';
import { favoriteMessages, monthLabel } from './service';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
const shortDate = (value: string, timezone: string) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone }).format(new Date(value));
const monthKey = (value: string, timezone: string) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: timezone }).format(new Date(value));
const palette = (colors: ThemeColors, printFriendly: boolean) => printFriendly
  ? { paper: themes.Auto.bg, panel: themes.Auto.surface, ink: themes.Auto.textPrimary, muted: themes.Auto.textSecondary, accent: themes.Auto.primary, line: themes.Auto.border }
  : { paper: colors.bg, panel: colors.surface, ink: colors.textPrimary, muted: colors.textSecondary, accent: colors.primary, line: colors.border };

type Progress = (done: number, total: number, label: string) => void;
type BuildArgs = { options: BookOptions; source: BookSource; colors: ThemeColors; fontCss: string; canceled: () => boolean; progress: Progress };

function mapSnapshot(source: BookSource, colors: ReturnType<typeof palette>) {
  const width = 720, height = 330;
  const project = (lon: number, lat: number) => ({ x: ((lon + 180) / 360) * width, y: ((90 - lat) / 180) * height });
  const land = [
    'M58 70 L86 38 126 25 164 37 183 59 174 83 155 96 149 122 131 142 119 169 99 168 91 143 76 129 69 105 48 93 Z',
    'M167 177 L194 182 211 202 207 226 198 245 191 270 177 300 164 285 160 257 151 237 151 214 Z',
    'M290 70 L323 45 359 40 387 48 408 37 440 44 461 54 501 53 532 68 558 73 573 91 560 107 535 109 524 128 500 128 483 144 457 142 438 157 415 155 398 177 375 178 364 160 343 154 328 132 307 124 293 104 272 99 Z',
    'M335 153 L363 145 389 158 402 179 396 202 380 215 372 241 357 266 341 263 333 237 321 220 320 195 309 176 Z',
    'M537 217 L564 209 589 218 602 235 589 251 566 255 547 245 Z',
    'M620 111 L632 106 641 112 638 122 626 124 Z',
  ];
  const dots = source.places.map(place => { const point = project(place.lon, place.lat); return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="8" fill="${colors.accent}" stroke="${colors.paper}" stroke-width="3"><title>${esc(place.name)}</title></circle>`; }).join('');
  return `<svg class="world" viewBox="0 0 ${width} ${height}" role="img" aria-label="Map of saved places"><rect width="100%" height="100%" rx="22" fill="${colors.panel}"/><g stroke="${colors.line}" stroke-width="1" opacity=".7"><path d="M0 82H720M0 165H720M0 248H720M180 0V330M360 0V330M540 0V330"/></g><g fill="${colors.line}" opacity=".75">${land.map(path => `<path d="${path}"/>`).join('')}</g>${dots}</svg>`;
}

function styles(colors: ReturnType<typeof palette>, fontCss: string) {
  return `${fontCss}
    :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:${colors.paper};color:${colors.ink};font-family:BookSans,Arial,sans-serif;font-size:10pt;line-height:1.55}
    @page{size:A5;margin:14mm 13mm 15mm}h1,h2,h3,p{margin-top:0}h1,h2,.serif{font-family:BookSerif,Georgia,serif}h1{font-size:32pt;line-height:1.08;font-weight:600}h2{font-size:21pt;line-height:1.16;font-weight:600;margin-bottom:4mm}h3{font-size:12pt;margin-bottom:2mm}p{margin-bottom:3mm}.small{font-size:8pt;color:${colors.muted}}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:7pt;font-weight:700;color:${colors.accent}}
    .page{min-height:180mm;page-break-after:always;position:relative;overflow:visible;break-inside:auto}.page:last-child{page-break-after:auto}.cover{display:flex;flex-direction:column;justify-content:space-between;padding:16mm 7mm 8mm;border:1px solid ${colors.line};border-radius:5mm;background:linear-gradient(155deg,${colors.panel},${colors.paper} 70%)}.cover .ornament{font-size:25pt;color:${colors.accent};letter-spacing:.1em}.cover h1{max-width:100mm;margin:0}.dedication{border-left:2px solid ${colors.accent};padding-left:5mm;color:${colors.muted};font-size:10pt;max-width:85mm}.cover-footer{display:flex;justify-content:space-between;align-items:end;color:${colors.muted};font-size:8pt}
    .toc{padding-top:12mm}.toc-row{display:flex;gap:4mm;align-items:baseline;border-bottom:1px solid ${colors.line};padding:4mm 0}.toc-row b{font-family:BookSerif,Georgia,serif;font-size:12pt}.toc-row span{color:${colors.muted};font-size:8pt}
    .chapter{padding-top:3mm}.chapter-head{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid ${colors.line};padding-bottom:3mm;margin-bottom:5mm}.grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.photo{border-radius:2.5mm;overflow:hidden;background:${colors.panel};break-inside:avoid}.photo img{display:block;width:100%;height:40mm;object-fit:cover}.photo figcaption{padding:2mm 2.5mm 3mm;font-size:7pt;color:${colors.muted};min-height:8mm}.message{display:flex;margin:0 0 4mm;break-inside:avoid}.message.right{justify-content:flex-end}.bubble{max-width:83%;padding:3mm 4mm;border-radius:4mm;background:${colors.panel};border:1px solid ${colors.line}}.message.right .bubble{background:${colors.accent};color:${colors.paper};border-color:${colors.accent}}.bubble p{margin:0}.bubble small{display:block;margin-top:2mm;opacity:.78;font-size:7pt}.entry{padding:3mm 0;border-bottom:1px solid ${colors.line};break-inside:avoid}.entry .date{font-size:7pt;color:${colors.accent};text-transform:uppercase;letter-spacing:.08em}.entry p{margin:1mm 0 0;color:${colors.muted};font-size:9pt}.place{padding:3mm 0;border-bottom:1px solid ${colors.line};break-inside:avoid}.world{display:block;width:100%;height:auto;margin:5mm 0 3mm}.stats{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:5mm}.stat{border:1px solid ${colors.line};border-radius:3mm;background:${colors.panel};padding:4mm}.stat strong{display:block;font:600 19pt BookSerif,Georgia,serif;color:${colors.accent}.stat span{font-size:7pt;color:${colors.muted}}
    .footer{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;color:${colors.muted};font-size:7pt;border-top:1px solid ${colors.line};padding-top:2mm}
    @media screen{body{background:#e7e3de;padding:12px}.page{width:148mm;min-height:210mm;margin:0 auto 14px;padding:14mm 13mm 15mm;background:${colors.paper};box-shadow:0 8px 24px #0002}.page.cover{padding:18mm 20mm 15mm}.footer{bottom:0}}
  `;
}

export async function generateBookHtml({ options, source, colors: themeColors, fontCss, canceled, progress }: BuildArgs) {
  const colors = palette(themeColors, options.printFriendly);
  const selectedChapters = Object.entries(options.chapters).filter(([, selected]) => selected).map(([id]) => id);
  const total = Math.max(1, selectedChapters.length);
  let completed = 0;
  const chunks: string[] = [];
  const push = (html: string, label: string) => { chunks.push(`<section class="page ${label}">${html}<footer class="footer"><span>Book of Us</span><span>${esc(options.title || 'Our story')}</span></footer></section>`); };

  push(`<div class="cover"><div><div class="eyebrow">A little book for two</div><div class="ornament">♡　✳　♡</div></div><h1>${esc(options.title.trim() || 'Book of Us')}</h1><div class="dedication">${esc(options.dedication.trim() || 'The little things became our story.')}</div><div class="cover-footer"><span>${esc(sourceRangeLabel(source, options))}</span><span>Made with love</span></div></div>`, 'cover');
  const toc = selectedChapters.map(id => `<div class="toc-row"><b>${chapterTitle(id)}</b><span>${chapterDescription(id)}</span></div>`).join('');
  push(`<div class="toc"><div class="eyebrow">Between these covers</div><h2>Our chapters</h2>${toc || '<p>A quiet little collection, just for us.</p>'}<p class="small" style="margin-top:9mm">Saved places, shared words, and moments we chose to keep.</p></div>`, 'contents');

  for (const chapter of selectedChapters) {
    if (canceled()) throw new Error('Export canceled.');
    if (chapter === 'photos') {
      const groups = new Map<string, typeof source.photos>();
      for (const photo of source.photos) { const label = monthLabel(photo.taken_at, source.timezone); groups.set(label, [...(groups.get(label) ?? []), photo]); }
      let photoProgress = 0;
      for (const [label, photos] of groups) {
        if (canceled()) throw new Error('Export canceled.');
        for (let offset = 0; offset < photos.length; offset += 6) {
          const tiles: string[] = [];
          const pagePhotos = photos.slice(offset, offset + 6);
          for (let index = 0; index < pagePhotos.length; index++) {
            if (canceled()) throw new Error('Export canceled.');
            const photo = pagePhotos[index]!;
            const local = await source.mediaStore.cache(photo);
            const { Image: Compressor } = await import('react-native-compressor');
            const compressed = await Compressor.compress(local, { maxWidth: 1600, maxHeight: 1600, quality: options.lightQuality ? 0.42 : 0.68, output: 'jpg', returnableOutputType: 'uri' });
            try {
              const FileSystem = await import('expo-file-system/legacy');
              const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
              const caption = photo.caption?.trim() || shortDate(photo.taken_at, source.timezone);
              tiles.push(`<figure class="photo"><img src="data:image/jpeg;base64,${base64}"/><figcaption>${esc(caption)}</figcaption></figure>`);
            } finally {
              if (compressed !== local && compressed.startsWith('file://')) { const FileSystem = await import('expo-file-system/legacy'); await FileSystem.deleteAsync(compressed, { idempotent: true }).catch(() => undefined); }
            }
            photoProgress++;
            progress(completed + photoProgress / Math.max(source.photos.length, 1), total, `Preparing ${label} · photo ${offset + index + 1} of ${photos.length}`);
          }
          push(`<div class="chapter-head"><div><div class="eyebrow">Memories in pictures</div><h2>${esc(label)}${offset ? ' · continued' : ''}</h2></div><span class="small">${Math.min(offset + 6, photos.length)} of ${photos.length}</span></div><div class="grid">${tiles.join('')}</div>`, 'chapter');
        }
      }
      if (!groups.size) push('<div class="eyebrow">Memories in pictures</div><h2>Photo chapters</h2><p>Your photos from this period will appear here.</p>', 'chapter');
    } else if (chapter === 'messages') {
      const chosen = favoriteMessages(source.messages, source.reactions).filter(row => options.selectedMessages.includes(row.id));
      const projected = chosen.map(row => projectMessage(row));
      const messages = projected.filter(row => !row.decryptionError && typeof row.body === 'string');
      const lockedCount = projected.length - messages.length;
      const perPage = 7;
      for (let offset = 0; offset < messages.length; offset += perPage) {
        const page = messages.slice(offset, offset + perPage);
        const items = page.map(row => `<div class="message ${row.sender_id === source.userId ? 'right' : ''}"><div class="bubble"><p>${esc(row.body ?? '')}</p><small>${esc(shortDate(row.created_at, source.timezone))}${source.reactions[row.id] ? ` · ${source.reactions[row.id]} reactions` : ''}</small></div></div>`).join('');
        push(`<div class="eyebrow">Words worth keeping</div><h2>Little hellos</h2>${items}`, 'chapter');
      }
      if (!messages.length) push(`<div class="eyebrow">Words worth keeping</div><h2>Little hellos</h2><p>${lockedCount ? 'Selected encrypted messages could not be opened on this phone, so their text was left out.' : 'Choose a few messages from this period to keep here.'}</p>`, 'chapter');
      else if (lockedCount) push(`<div class="eyebrow">A small note</div><h2>Words worth keeping</h2><p>${lockedCount} selected encrypted ${lockedCount === 1 ? 'message could' : 'messages could'} not be opened on this phone and ${lockedCount === 1 ? 'was' : 'were'} left out.</p>`, 'chapter');
    } else if (chapter === 'milestones') {
      const entries = [
        ...source.milestones.map(item => ({ at: item.at, title: item.title, detail: item.detail ?? '' })),
        ...source.events.map(item => ({ at: item.starts_at, title: item.title, detail: item.location || item.kind })),
        ...source.capsules.map(item => ({ at: item.opened_at ?? item.created_at, title: item.title || 'A time capsule opened', detail: item.body || 'A note we saved for this moment.' })),
      ].sort((a, b) => a.at.localeCompare(b.at));
      for (let offset = 0; offset < Math.max(1, entries.length); offset += 7) {
        const cards = entries.slice(offset, offset + 7).map(item => `<div class="entry"><span class="date">${esc(shortDate(item.at, source.timezone))}</span><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`).join('');
        push(`<div class="eyebrow">The dates that became ours</div><h2>Milestones & moments${offset ? ' · continued' : ''}</h2>${cards || '<p>More moments are waiting to be added to your story.</p>'}`, 'chapter');
      }
    } else if (chapter === 'places') {
      const placePages = Math.max(1, Math.ceil(source.places.length / 5));
      for (let page = 0; page < placePages; page++) {
        const places = source.places.slice(page * 5, page * 5 + 5).map(place => `<div class="place"><h3>${esc(place.name)}${place.country_code ? ` · ${esc(place.country_code)}` : ''}</h3><span class="small">${esc(place.kind === 'home' ? 'A place called home' : place.visited_on ? shortDate(place.visited_on, source.timezone) : 'A place in your story')}</span>${place.notes ? `<p class="small">${esc(place.notes)}</p>` : ''}</div>`).join('');
        push(`<div class="eyebrow">Where life took us</div><h2>Places we kept${page ? ' · continued' : ''}</h2>${page === 0 ? mapSnapshot(source, colors) : ''}${places || '<p>No saved places in this period yet.</p>'}`, 'chapter');
      }
    } else if (chapter === 'wins') {
      const pages = Math.max(1, Math.ceil(source.wins.length / 8));
      for (let page = 0; page < pages; page++) {
        const items = source.wins.slice(page * 8, page * 8 + 8).map(item => `<div class="entry"><span class="date">A little dream, done · ${esc(shortDate(item.done_at, source.timezone))}</span><h3>✓ ${esc(item.title)}</h3>${item.notes ? `<p>${esc(item.notes)}</p>` : ''}</div>`).join('');
        push(`<div class="eyebrow">We said we would</div><h2>And then we did${page ? ' · continued' : ''}</h2>${items || '<p>Every adventure starts as an idea. Your completed bucket-list wins will live here.</p>'}`, 'chapter');
      }
    } else if (chapter === 'stats') {
      const stats = source.stats;
      const values: [string, string][] = [];
      if (stats?.messages) values.push(['Messages shared', stats.messages.total.toLocaleString()], ['Longest chat streak', `${longestStreak(stats.messages.by_day)} days`]);
      else values.push(['Favorite messages', source.messages.length.toLocaleString()]);
      if (stats?.media) values.push(['Memories saved', stats.media.total.toLocaleString()], ['Photos & videos', stats.media.by_kind.reduce((totalValue, item) => totalValue + item.count, 0).toLocaleString()]);
      else values.push(['Photos saved', source.photos.length.toLocaleString()]);
      if (stats?.calls) values.push(['Minutes on calls', Math.round(stats.calls.seconds / 60).toLocaleString()], ['Longest call', `${Math.round(stats.calls.longest / 60)} min`]);
      if (stats?.watch_sessions) values.push(['Movie nights', stats.watch_sessions.total.toLocaleString()]);
      values.push(['Moments marked', (source.milestones.length + source.events.length + source.capsules.length).toLocaleString()], ['Saved places', source.places.length.toLocaleString()], ['Bucket-list wins', source.wins.length.toLocaleString()]);
      const cards = values.map(([label, value]) => `<div class="stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('');
      push(`<div class="eyebrow">A few numbers from our life</div><h2>The little things add up</h2><div class="stats">${cards || '<p>No stats were available for this period.</p>'}</div>`, 'chapter');
    }
    completed++;
    progress(completed, total, `${chapterTitle(chapter)} ready`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${styles(colors, fontCss)}</style></head><body>${chunks.join('')}</body></html>`;
}

function chapterTitle(id: string) { return ({ photos: 'Photo chapters', messages: 'Favorite messages', milestones: 'Milestones', places: 'Places', wins: 'Bucket-list wins', stats: 'Our year in numbers' } as Record<string, string>)[id] ?? id; }
function chapterDescription(id: string) { return ({ photos: 'Moments in pictures', messages: 'Words worth keeping', milestones: 'Dates and days that stayed with us', places: 'The places we made ours', wins: 'Little dreams we completed', stats: 'A few numbers from our life' } as Record<string, string>)[id] ?? ''; }
function longestStreak(days: { key: string; count: number }[]) { let best = 0, run = 0, previous = -2; for (const day of [...days].sort((a, b) => a.key.localeCompare(b.key))) { const current = Date.parse(`${day.key}T00:00:00Z`) / 86400000; run = current === previous + 1 ? run + 1 : 1; best = Math.max(best, run); previous = current; } return best; }
function sourceRangeLabel(source: BookSource, options: BookOptions) { return source.messages.length ? `${new Date(source.messages[source.messages.length - 1]!.created_at).getFullYear()} · ${options.title.trim() || 'Our story'}` : options.title.trim() || 'A story made together'; }

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoEqualEarth, geoPath, geoContains } from 'd3-geo';

const require = createRequire(import.meta.url);
const atlas = JSON.parse(await readFile(require.resolve('world-atlas/countries-110m.json'), 'utf8'));
// ISO 3166 numeric → alpha-2. The numeric ID is also retained in the output.
const iso = Object.fromEntries('004:AF,248:AX,008:AL,012:DZ,016:AS,020:AD,024:AO,660:AI,010:AQ,028:AG,032:AR,051:AM,533:AW,036:AU,040:AT,031:AZ,044:BS,048:BH,050:BD,052:BB,112:BY,056:BE,084:BZ,204:BJ,060:BM,064:BT,068:BO,535:BQ,070:BA,072:BW,074:BV,076:BR,086:IO,096:BN,100:BG,854:BF,108:BI,132:CV,116:KH,120:CM,124:CA,136:KY,140:CF,148:TD,152:CL,156:CN,162:CX,166:CC,170:CO,174:KM,178:CG,180:CD,184:CK,188:CR,384:CI,191:HR,192:CU,531:CW,196:CY,203:CZ,208:DK,262:DJ,212:DM,214:DO,218:EC,818:EG,222:SV,226:GQ,232:ER,233:EE,748:SZ,231:ET,238:FK,234:FO,242:FJ,246:FI,250:FR,254:GF,258:PF,260:TF,266:GA,270:GM,268:GE,276:DE,288:GH,292:GI,300:GR,304:GL,308:GD,312:GP,316:GU,320:GT,831:GG,324:GN,624:GW,328:GY,332:HT,334:HM,336:VA,340:HN,344:HK,348:HU,352:IS,356:IN,360:ID,364:IR,368:IQ,372:IE,833:IM,376:IL,380:IT,388:JM,392:JP,832:JE,400:JO,398:KZ,404:KE,296:KI,408:KP,410:KR,414:KW,417:KG,418:LA,428:LV,422:LB,426:LS,430:LR,434:LY,438:LI,440:LT,442:LU,446:MO,450:MG,454:MW,458:MY,462:MV,466:ML,470:MT,584:MH,474:MQ,478:MR,480:MU,175:YT,484:MX,583:FM,498:MD,492:MC,496:MN,499:ME,500:MS,504:MA,508:MZ,104:MM,516:NA,520:NR,524:NP,528:NL,540:NC,554:NZ,558:NI,562:NE,566:NG,570:NU,574:NF,807:MK,580:MP,578:NO,512:OM,586:PK,585:PW,275:PS,591:PA,598:PG,600:PY,604:PE,608:PH,612:PN,616:PL,620:PT,630:PR,634:QA,638:RE,642:RO,643:RU,646:RW,652:BL,654:SH,659:KN,662:LC,663:MF,666:PM,670:VC,882:WS,674:SM,678:ST,682:SA,686:SN,688:RS,690:SC,694:SL,702:SG,534:SX,703:SK,705:SI,090:SB,706:SO,710:ZA,239:GS,728:SS,724:ES,144:LK,729:SD,740:SR,744:SJ,752:SE,756:CH,760:SY,158:TW,762:TJ,834:TZ,764:TH,626:TL,768:TG,772:TK,776:TO,780:TT,788:TN,792:TR,795:TM,796:TC,798:TV,800:UG,804:UA,784:AE,826:GB,840:US,581:UM,858:UY,860:UZ,548:VU,862:VE,704:VN,092:VG,850:VI,876:WF,732:EH,887:YE,894:ZM,716:ZW'.split(',').map(pair => pair.split(':')));
const countries = feature(atlas, atlas.objects.countries).features;
const width = 1000, height = 520;
const projection = geoEqualEarth().fitExtent([[8, 8], [width - 8, height - 8]], { type: 'Sphere' });
const path = geoPath(projection).digits(1);
function simplifyRing(ring, threshold) {
  const kept = ring.filter((p, i) => i === 0 || i === ring.length - 1 || Math.hypot(p[0] - ring[i - 1][0], p[1] - ring[i - 1][1]) > threshold);
  return kept.length >= 4 ? kept : ring;
}
function lowGeometry(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const coordinates = polygons.map(p => p.map(r => simplifyRing(r, 0.65)));
  return { ...geometry, coordinates: geometry.type === 'Polygon' ? coordinates[0] : coordinates };
}
const output = { width, height, scale: projection.scale(), translate: projection.translate(), source: 'Natural Earth / world-atlas 110m (public domain)', countries: countries.map(c => ({
  id: c.id ?? null, code: iso[String(c.id).padStart(3, '0')] ?? (c.properties.name === 'Kosovo' ? 'XK' : null), name: c.properties.name,
  path: path(c), low: path({ ...c, geometry: lowGeometry(c.geometry) }),
})) };
const json = JSON.stringify(output);
if (Buffer.byteLength(json) >= 600 * 1024) throw new Error('Map asset exceeds 600 KB');
await mkdir(new URL('../src/features/places/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/features/places/world-paths.json', import.meta.url), json + '\n');
// Sanity check geodata, projection, and country mapping at generation time.
if (!countries.some(c => iso[c.id] === 'IN' && geoContains(c, [77.2, 28.6]))) throw new Error('India/Delhi mapping failed');
console.log(`${countries.length} shapes; ${Buffer.byteLength(json)} bytes; Equal Earth scale ${projection.scale()}`);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const root=__dirname;
const source=fs.readFileSync(path.join(root,'geo.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const mod={exports:{}};
vm.runInNewContext(compiled,{exports:mod.exports,require:id=>require(path.resolve(root,id))});
const geo=mod.exports;
const map=require('./world-paths.json');
assert.ok(fs.statSync(path.join(root,'world-paths.json')).size<600*1024);
assert.equal(map.countries.length,177);
assert.ok(map.countries.some(c=>c.code==='IN'));
assert.ok(map.countries.some(c=>c.code==='US'));
assert.ok(Math.abs(geo.haversine({lat:0,lon:0},{lat:0,lon:1})-111.195)<0.01);
assert.equal(geo.haversine({lat:10,lon:10},{lat:10,lon:10}),0);
assert.ok(Number.isFinite(geo.haversine({lat:90,lon:0},{lat:-90,lon:180})));
assert.equal(geo.validDate('2024-02-29'),true);
assert.equal(geo.validDate('2025-02-29'),false);
assert.equal(geo.validDate('2026-13-01'),false);
assert.equal(geo.clusterPhotos([{lat:15.5,lon:73.8,date:null},{lat:15.51,lon:73.81,date:null},{lat:15.49,lon:73.79,date:null},{lat:28.6,lon:77.2,date:null}])[0].count,3);
const p=(overrides)=>({id:'p',couple_id:'c',name:'Delhi',country_code:'IN',lat:28.6,lon:77.2,kind:'visited',visited_on:'2026-01-01',created_at:'2026-01-01',media_ids:[],notes:null,created_by:'u',...overrides});
const stats=geo.stats([p({}),p({id:'2'}),p({id:'3',name:'Paris',country_code:'FR',kind:'wishlist'}),p({id:'4',name:'Puerto Rico',country_code:'PR',visited_on:null})]);
assert.equal(stats.countries,1);assert.equal(stats.cities,2);assert.equal(stats.km,0);
const dateline=geo.greatCircle({lat:0,lon:170},{lat:0,lon:-170});
assert.ok((dateline.match(/M/g)||[]).length>=2,'dateline arc must split');
assert.ok(!geo.greatCircle({lat:0,lon:0},{lat:0,lon:180}).includes('NaN'));
(async()=>{
 const {geoEqualEarth}=await import('d3-geo');
 const projection=geoEqualEarth().scale(map.scale).translate(map.translate);
 for(const [lon,lat] of [[0,0],[77.2,28.6],[-122.4,37.8],[179,80],[-179,-80]]) {
   const expected=projection([lon,lat]),actual=geo.project(lat,lon);
   assert.ok(Math.abs(actual.x-expected[0])<1e-8 && Math.abs(actual.y-expected[1])<1e-8,'map pins must match generated projection');
 }
 // Exercise the same SVG parser used by native Skia through its WASM backend.
 const CanvasKit=await require('canvaskit-wasm')({locateFile:file=>require.resolve(`canvaskit-wasm/bin/${file}`)});
 for(const country of map.countries) for(const svg of [country.path,country.low]) {
   const parsed=CanvasKit.Path.MakeFromSVGString(svg);assert.ok(parsed,`Invalid Skia path for ${country.name}`);parsed.delete();
 }
 const surface=CanvasKit.MakeSurface(map.width,map.height);assert.ok(surface);
 const paint=new CanvasKit.Paint();const themes=require('../../theme/tokens.json').themes;
 const canvas=surface.getCanvas();canvas.clear(CanvasKit.parseColorString(themes.Midnight.bgElevated));
 paint.setAntiAlias(true);
 for(const c of map.countries) { const parsed=CanvasKit.Path.MakeFromSVGString(c.path);paint.setColor(CanvasKit.parseColorString(c.code==='IN'?themes.Midnight.primary:themes.Midnight.surfaceAlt));canvas.drawPath(parsed,paint);parsed.delete(); }
 surface.flush();const image=surface.makeImageSnapshot();const bytes=image.encodeToBytes();assert.ok(bytes?.length);
 // Optional review artifact stays inside this feature's folder.
 if(process.argv.includes('--render')) fs.writeFileSync(path.join(root,'map-qa.png'),bytes);
 image.delete();paint.delete();surface.delete();
 console.log('PASS: map size/codes, 354 Skia paths, raster render, projection parity, haversine, dates, GPS clustering, stats, dateline/antipodal arcs.');
})().catch(error=>{console.error(error);process.exitCode=1;});

import { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, DashPathEffect, Group, Image as SkImage, LinearGradient, Path, Rect, Skia, useCanvasRef, useImage, vec, type CanvasRef, type SkPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, useAnimatedReaction, useDerivedValue, useSharedValue, withDecay, withRepeat, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { RefObject } from 'react';
import { useTheme } from '@/theme';
import { useMotion } from '@/motion/useMotion';
import { PressableScale, Text } from '@/ui';
import asset from './world-paths.json';
import { greatCircle, project } from './geo';
import { usePhotoUrl } from './data';
import type { Home, Place } from './types';

// Parsed once for the lifetime of this JS runtime; never parsed during gestures.
const paths = new Map<string, SkPath>();
function cachedPath(svg: string) { let p = paths.get(svg); if (!p) { p = Skia.Path.MakeFromSVGString(svg) ?? Skia.Path.Make(); paths.set(svg, p); } return p; }
type Shape = typeof asset.countries[number];
const countryByCode = new Map(asset.countries.filter(c => c.code).map(c => [c.code, c]));
let mergedLow: SkPath | undefined, mergedHigh: SkPath | undefined;
const baseLow = () => mergedLow ??= cachedPath(asset.countries.map(c => c.low).join(''));
const baseHigh = () => mergedHigh ??= cachedPath(asset.countries.map(c => c.path).join(''));

const Country = memo(function Country({ shape, low, visited, active }: { shape: Shape; low: boolean; visited: boolean; active: boolean }) {
  const { colors, geometry } = useTheme(); const motion = useMotion(); const path = cachedPath((low ? shape.low : shape.path) ?? '');
  const bounds = path.getBounds(); const reveal = useSharedValue(visited ? 0 : 1);
  const fade = useSharedValue(visited ? 0 : 1);
  useEffect(() => {
    reveal.value = active && motion.level === 'full' ? withTiming(1, { duration: motion.duration('hero') }) : 1;
    fade.value = active ? withTiming(1, { duration: motion.duration('base') }) : 1;
    return () => { cancelAnimation(reveal); cancelAnimation(fade); };
  }, [visited, active, motion.level, reveal, fade]);
  const clip = useDerivedValue(() => { const p = Skia.Path.Make(); p.addCircle(bounds.x+bounds.width/2, bounds.y+bounds.height/2, Math.hypot(bounds.width,bounds.height)*reveal.value); return p; });
  return visited ? <Group clip={clip} opacity={fade}><Path path={path}><LinearGradient start={vec(bounds.x,bounds.y)} end={vec(bounds.x+bounds.width,bounds.y+bounds.height)} colors={[colors.primary, colors.accent]} /></Path></Group>
    : <Path path={path} color={colors.textPrimary} style="stroke" strokeWidth={geometry.stroke} strokeCap="round"><DashPathEffect intervals={[geometry.hairline, geometry.dot]} /></Path>;
});

const Pin = memo(function Pin({ place, photo, couple }: { place: Place; photo?: { id: string; thumb_path: string | null; storage_path: string }; couple: string | null | undefined }) {
  const { colors, geometry } = useTheme(); const p = project(place.lat, place.lon); const r = geometry.avatar / 2;
  const url = usePhotoUrl(photo?.id, photo ? photo.thumb_path ?? photo.storage_path : undefined, couple);
  const image = useImage(url.data ?? null);
  const clip = useMemo(() => { const path = Skia.Path.Make(); path.addCircle(p.x,p.y,r); return path; },[p.x,p.y,r]);
  return <><Circle cx={p.x} cy={p.y} r={r+geometry.stroke} color={colors.bg} />
    <Circle cx={p.x} cy={p.y} r={r} color={place.kind === 'wishlist' ? colors.surfaceAlt : colors.primary} />
    {image ? <Group clip={clip}><SkImage image={image} x={p.x-r} y={p.y-r} width={r*2} height={r*2} fit="cover" /></Group> : <Circle cx={p.x} cy={p.y} r={geometry.dot} color={place.kind === 'wishlist' ? colors.textPrimary : colors.primaryContrast} />}</>;
});

export function WorldMap({ places, homes, photos = [], couple, active, canvasRef }: {
  places: Place[]; homes: Home[]; photos?: { id: string; thumb_path: string | null; storage_path: string }[];
  couple: string | null | undefined; active: boolean; canvasRef: RefObject<CanvasRef | null>;
}) {
  const { colors, geometry, radius, spacing } = useTheme(); const motion = useMotion(); const [width, setWidth] = useState(geometry.touch * 6);
  const height = width * asset.height / asset.width; const fit = width/asset.width;
  const zoom = useSharedValue(1), x = useSharedValue(0), y = useSharedValue(0), startZ = useSharedValue(1), startX = useSharedValue(0), startY = useSharedValue(0);
  const [low, setLow] = useState(true);
  useAnimatedReaction(() => zoom.value < 2, (value, previous) => { if (value !== previous) scheduleOnRN(setLow,value); }, []);
  const transform = useDerivedValue(() => [{ translateX: x.value }, { translateY: y.value }, { scale: fit * zoom.value }]);
  const duration = motion.duration('base'), momentum = motion.level === 'full';
  const reset = () => { zoom.value=withTiming(1,{duration}); x.value=withTiming(0,{duration}); y.value=withTiming(0,{duration}); };
  useEffect(() => { if (!active || motion.level !== 'full') { cancelAnimation(x); cancelAnimation(y); } },[active,motion.level,x,y]);
  const pan = Gesture.Pan().maxPointers(1).onStart(() => { cancelAnimation(x); cancelAnimation(y); cancelAnimation(zoom); startX.value=x.value; startY.value=y.value; })
    .onUpdate(e => { x.value=Math.max(width*(1-zoom.value), Math.min(0,startX.value+e.translationX)); y.value=Math.max(height*(1-zoom.value),Math.min(0,startY.value+e.translationY)); })
    .onEnd(e => { if (momentum) { x.value=withDecay({velocity:e.velocityX,clamp:[width*(1-zoom.value),0]}); y.value=withDecay({velocity:e.velocityY,clamp:[height*(1-zoom.value),0]}); } });
  const pinch = Gesture.Pinch().onStart(() => { cancelAnimation(x); cancelAnimation(y); cancelAnimation(zoom); startZ.value=zoom.value; startX.value=x.value; startY.value=y.value; })
    .onUpdate(e => { const z=Math.max(1,Math.min(8,startZ.value*e.scale)), ratio=z/startZ.value; zoom.value=z; x.value=Math.max(width*(1-z),Math.min(0,e.focalX-(e.focalX-startX.value)*ratio)); y.value=Math.max(height*(1-z),Math.min(0,e.focalY-(e.focalY-startY.value)*ratio)); });
  const double = Gesture.Tap().numberOfTaps(2).onEnd((e,success) => { if (!success) return; const z=zoom.value>=4 ? 1 : Math.min(8,zoom.value*2), ratio=z/zoom.value;
    x.value=withTiming(Math.max(width*(1-z),Math.min(0,e.x-(e.x-x.value)*ratio)),{duration}); y.value=withTiming(Math.max(height*(1-z),Math.min(0,e.y-(e.y-y.value)*ratio)),{duration}); zoom.value=withTiming(z,{duration}); });
  const visited = useMemo(() => new Set(places.filter(p=>p.kind!=='wishlist').map(p=>p.country_code).filter((code): code is string=>!!code)),[places]);
  const wishlist = useMemo(() => new Set(places.filter(p=>p.kind==='wishlist').map(p=>p.country_code).filter((code): code is string=>!!code && !visited.has(code))),[places,visited]);
  const arc = useMemo(() => homes[0] && homes[1] ? cachedPath(greatCircle(homes[0],homes[1])) : null,[homes]);
  const phase = useSharedValue(0);
  useEffect(() => { cancelAnimation(phase); phase.value=0; if (active && arc && motion.level==='full') phase.value=withRepeat(withTiming(-geometry.dot*2,{duration:motion.duration('pulse')}),-1,false); return ()=>cancelAnimation(phase); },[active,arc,motion.level,phase,geometry.dot]);
  // Dense maps keep the newest 48 photo pins; all saved locations remain in the list.
  const pins = useMemo(() => places.slice(0,geometry.maxParticles),[places,geometry.maxParticles]);
  return <View style={{ gap:spacing.sm }}>
    <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={{ borderRadius:radius.lg,overflow:'hidden',backgroundColor:colors.bgElevated }}>
      <GestureDetector gesture={Gesture.Simultaneous(pan,pinch,double)}><Canvas ref={canvasRef} style={{width:'100%',height}} accessible accessibilityLabel={`Our world map. ${visited.size} visited countries. Use the place list below to inspect locations.`}>
        <Rect x={0} y={0} width={width} height={height} color={colors.bgElevated} />
        <Group transform={transform}>
          <Path path={low ? baseLow() : baseHigh()} color={colors.surfaceAlt} />
          <Path path={low ? baseLow() : baseHigh()} color={colors.border} style="stroke" strokeWidth={geometry.hairline} />
          {[...visited].map(code=>{ const shape=countryByCode.get(code); return shape && <Country key={code} shape={shape} low={low} visited active={active} />; })}
          {[...wishlist].map(code=>{ const shape=countryByCode.get(code); return shape && <Country key={code} shape={shape} low={low} visited={false} active={active} />; })}
          {arc && <Path path={arc} color={colors.textPrimary} style="stroke" strokeWidth={geometry.stroke} strokeCap="round"><DashPathEffect intervals={[geometry.stroke,geometry.dot]} phase={phase} /></Path>}
          {pins.map(p=><Pin key={p.id} place={p} couple={couple} photo={photos.find(photo=>photo.id===p.media_ids[0])} />)}
          {homes.map(h=>{ const point=project(h.lat,h.lon); return <Circle key={h.id} cx={point.x} cy={point.y} r={geometry.dot} color={colors.accent} />; })}
        </Group>
      </Canvas></GestureDetector>
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:spacing.sm}}><Text variant="caption" color="textSecondary" style={{flex:1}}>Accent: visited · Dots: wishlist{pins.length<places.length ? ' · Newest 48 pins' : ''}</Text><PressableScale accessibilityRole="button" onPress={reset}><Text variant="label">Reset zoom</Text></PressableScale></View>
    <View style={{flexDirection:'row',gap:spacing.sm,alignItems:'center'}}><Text variant="caption" color="textSecondary" style={{flex:1}}>Pinch or double-tap to zoom · Drag to explore</Text><PressableScale accessibilityRole="button" accessibilityLabel="Zoom map in" onPress={()=>{ const z=Math.min(8,zoom.value*2), ratio=z/zoom.value; x.value=withTiming(Math.max(width*(1-z),Math.min(0,width/2-(width/2-x.value)*ratio)),{duration});y.value=withTiming(Math.max(height*(1-z),Math.min(0,height/2-(height/2-y.value)*ratio)),{duration});zoom.value=withTiming(z,{duration}); }}><Text variant="label">Zoom in</Text></PressableScale></View>
  </View>;
}
export { useCanvasRef };

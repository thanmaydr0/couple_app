import { useEffect, useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { Canvas, Circle, Group, BlurMask, Path, Skia } from '@shopify/react-native-skia';
import { PressableScale, useMotion, motionTokens } from '@/motion';
import { useTheme } from '@/theme';
import { clamp, predict } from './protocol';
import type { Point } from './types';
import type { useTouchRoom } from './useTouchRoom';

type Room = ReturnType<typeof useTouchRoom>;
type Trail = Point & { at: number; mine: boolean };
export function TouchCanvas({ room }: { room: Room }) {
  const { colors, geometry, spacing, radius } = useTheme(); const motion = useMotion();
  const [size, setSize] = useState({ width: 1, height: 1 }); const [now, setNow] = useState(Date.now());
  const trails = useRef<Trail[]>([]); const smooth = useRef<Point>({ x: 0.5, y: 0.5 });
  const bloomAt = useRef(0); const lastBloom = useRef(0); const lastPoint = useRef<Point | undefined>(undefined); const downAt = useRef(0);
  const finger = useRef<string | undefined>(undefined);
  const full = motion.level === 'full';
  useEffect(() => {
    if (!room.active || room.expired) return;
    let timer: ReturnType<typeof setTimeout>; let stopped = false;
    const frame = () => {
      if (stopped) return;
      const time = Date.now(); const a = room.mine.current; const b = room.theirs.current;
      const target = predict(room.previous.current, b, time);
      smooth.current = full ? { x: smooth.current.x + (target.x - smooth.current.x) * 0.35, y: smooth.current.y + (target.y - smooth.current.y) * 0.35 } : target;
      if (room.bloom !== lastBloom.current) { bloomAt.current = time; lastBloom.current = room.bloom; }
      if (full) {
        if (a.down) trails.current.push({ ...a, at: time, mine: true });
        if (b.down) trails.current.push({ ...smooth.current, at: time, mine: false });
        trails.current = trails.current.filter(p => time - p.at < motionTokens.particles).slice(-geometry.maxParticles);
      } else trails.current = [];
      setNow(time);
      timer = setTimeout(frame, a.down || b.down ? 1000 / (full ? 30 : 15) : motionTokens.slow);
    };
    frame(); return () => { stopped = true; clearTimeout(timer); };
  }, [room.active, room.expired, room.bloom, full, room.mine, room.theirs, room.previous, geometry.maxParticles]);
  const local = room.mine.current; const remote = room.theirs.current;
  const peerColor = room.partnerAccent ?? colors.accent;
  const orb = geometry.thumb / 2;
  const center = { x: (local.x + smooth.current.x) / 2 * size.width, y: (local.y + smooth.current.y) / 2 * size.height };
  const progress = clamp((now - bloomAt.current) / motionTokens.particles);
  const point = (event: GestureResponderEvent): Point => ({ x: clamp(event.nativeEvent.locationX / size.width), y: clamp(event.nativeEvent.locationY / size.height) });
  function release(event: GestureResponderEvent) {
    if (finger.current === undefined) return;
    // A long hold is never counted as a tap gesture.
    if (Date.now() - downAt.current < motionTokens.base && lastPoint.current) {
      const p = point(event); if (Math.hypot(p.x - lastPoint.current.x, p.y - lastPoint.current.y) < 0.025) room.tap(p);
    }
    finger.current = undefined; room.up();
  }
  const heartProgress = room.heart ? clamp((now - room.heart.at) / motionTokens.particles) : 1;
  // Unit-space heart; its rendered size comes from the shared icon geometry.
  const heartPath = Skia.Path.MakeFromSVGString('M 0 .25 C -.83 -.25 -.92 -.92 -.42 -1 C -.17 -1.08 0 -.83 0 -.75 C 0 -.83 .17 -1.08 .42 -1 C .92 -.92 .83 -.25 0 .25 Z');
  return <PressableScale haptic={false} accessible accessibilityRole="button" accessibilityLabel="Touch canvas. Hold one finger to connect; double tap to send a heart." disabled={room.expired || !room.online}
    style={{ flex: 1, minHeight: geometry.touch * 4, overflow: 'hidden', borderRadius: radius.sheet, backgroundColor: colors.shadowColor }}
    onLayout={e => { room.up(); setSize(e.nativeEvent.layout); }}
    onTouchStart={e => { if (finger.current !== undefined) return; finger.current = e.nativeEvent.identifier; downAt.current = Date.now(); lastPoint.current = point(e); room.move(lastPoint.current); }}
    onTouchMove={e => { if (e.nativeEvent.identifier === finger.current) room.move(point(e)); }}
    onTouchEnd={e => { if (e.nativeEvent.identifier === finger.current) release(e); }}
    onTouchCancel={() => { finger.current = undefined; room.up(); }}>
    <View pointerEvents="none" style={{ flex: 1 }}>
      <Canvas style={{ flex: 1 }}>
        {full && trails.current.map((p, i) => <Circle key={i} cx={p.x * size.width} cy={p.y * size.height} r={orb * (1 - (now - p.at) / motionTokens.particles)} color={p.mine ? colors.primary : peerColor} opacity={(1 - (now - p.at) / motionTokens.particles) * 0.35} />)}
        {full && !room.present && <Circle cx={size.width / 2} cy={size.height / 2} r={spacing.s56 + Math.sin(now / motionTokens.pulse * Math.PI) * spacing.sm} color={colors.primary} opacity={0.25}><BlurMask blur={spacing.lg} style="normal" /></Circle>}
        {(local.down || remote.down) && !room.merged && <Group>
          {local.down && <Circle cx={local.x * size.width} cy={local.y * size.height} r={orb} color={colors.primary}>{full && <BlurMask blur={spacing.xs} style="normal" />}</Circle>}
          {remote.down && <Circle cx={smooth.current.x * size.width} cy={smooth.current.y * size.height} r={orb} color={peerColor}>{full && <BlurMask blur={spacing.xs} style="normal" />}</Circle>}
          {full && [local.down ? local : null, remote.down ? smooth.current : null].map((p, i) => p && <Circle key={i} cx={p.x * size.width} cy={p.y * size.height} r={orb + (now % motionTokens.pulse) / motionTokens.pulse * spacing.s56} color={i ? peerColor : colors.primary} style="stroke" strokeWidth={geometry.stroke} opacity={1 - (now % motionTokens.pulse) / motionTokens.pulse} />)}
        </Group>}
        {room.merged && <Group>
          {full && <Circle cx={center.x} cy={center.y} r={spacing.s56} color={colors.primary} opacity={0.5}><BlurMask blur={spacing.lg} style="normal" /></Circle>}
          <Circle cx={center.x} cy={center.y} r={orb * 1.5} color={colors.primary} />
          <Circle cx={center.x} cy={center.y} r={orb / 2} color={peerColor} />
        </Group>}
        {full && progress < 1 && Array.from({ length: geometry.maxParticles / 2 }, (_, i) => <Circle key={i} cx={center.x + Math.cos(i * 2.39996) * progress * geometry.particleTravel} cy={center.y + Math.sin(i * 2.39996) * progress * geometry.particleTravel} r={geometry.particle * (1 - progress)} color={i % 2 ? colors.primary : peerColor} opacity={1 - progress} />)}
        {room.heart && heartProgress < 1 && <Group transform={[{ translateX: room.heart.point.x * size.width }, { translateY: room.heart.point.y * size.height }]}>
          {full && <Circle r={spacing.s56 * heartProgress} color={peerColor} style="stroke" strokeWidth={geometry.stroke} opacity={1 - heartProgress} />}
          {heartPath && <Group transform={[{ scale: geometry.icon }]}><Path path={heartPath} color={peerColor} opacity={full ? 1 - heartProgress : 1} /></Group>}
        </Group>}
      </Canvas>
    </View>
  </PressableScale>;
}

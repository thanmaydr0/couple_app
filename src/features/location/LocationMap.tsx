import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer, type CameraRef, type LngLat } from '@maplibre/maplibre-react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useMotion } from '@/motion';
import { Avatar, Button, Text } from '@/ui';
import { accuracyRing } from './geo';
import type { LocationPoint } from './types';

function Person({ point, name, uri }: { point: LocationPoint; name: string; uri?: string }) {
  const motion = useMotion();
  const { colors, geometry, spacing, radius } = useTheme();
  const [position, setPosition] = useState<LngLat>([point.lon, point.lat]);
  const current = useRef(position);
  const pulse = useSharedValue(1);
  useEffect(() => {
    const target: LngLat = [point.lon, point.lat];
    const start = current.current;
    const duration = motion.level === 'full' ? motion.duration('slow') : 0;
    let frame = 0;
    const beginning = Date.now();
    const move = () => {
      const progress = duration ? Math.min(1, (Date.now() - beginning) / duration) : 1;
      // Take the shortest path across the antimeridian.
      const delta = ((target[0] - start[0] + 540) % 360) - 180;
      current.current = [((start[0] + delta * progress + 540) % 360) - 180, start[1] + (target[1] - start[1]) * progress];
      setPosition(current.current);
      if (progress < 1) frame = requestAnimationFrame(move);
    };
    move();
    return () => cancelAnimationFrame(frame);
  }, [point.lon, point.lat, motion.level]);
  useEffect(() => {
    pulse.value = motion.level === 'full' ? withRepeat(withSequence(withTiming(1 + geometry.parallax, { duration: motion.duration('pulse') }), withTiming(1, { duration: motion.duration('pulse') })), -1) : 1;
    return () => cancelAnimation(pulse);
  }, [motion.level, pulse, geometry.parallax]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return <Marker id={point.user_id} lngLat={position}><View accessibilityLabel={`${name} location, accuracy ${Math.round(point.accuracy ?? 0)} meters`} style={{ alignItems: 'center', padding: spacing.sm }}>
    <Animated.View style={[{ borderWidth: geometry.stroke, borderColor: colors.primary, borderRadius: radius.pill, padding: spacing.xs, backgroundColor: colors.surface }, style]}><Avatar name={name} uri={uri} /></Animated.View>
    <View style={{ backgroundColor: colors.surface, padding: spacing.xs, borderRadius: radius.sm }}><Text variant="caption">{name}</Text></View>
  </View></Marker>;
}
export function LocationMap({ points, uid, ownAvatar, partnerAvatar, partnerName }: { points: LocationPoint[]; uid?: string; ownAvatar?: string; partnerAvatar?: string; partnerName: string }) {
  const { colors, spacing, radius, geometry, dark } = useTheme();
  const motion = useMotion();
  const camera = useRef<CameraRef>(null);
  const [follow, setFollow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const styleUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim().replace('{theme}', dark ? 'dark' : 'light');
  const me = points.find(p => p.user_id === uid);
  useEffect(() => {
    if (follow && me) camera.current?.easeTo({ center: [me.lon, me.lat], zoom: 14, duration: motion.level === 'full' ? motion.duration('slow') : 0 });
  }, [follow, me?.lat, me?.lon, motion.level]);
  if (!styleUrl) return <Text color="textSecondary">Map setup needed: configure EXPO_PUBLIC_MAP_STYLE_URL with your MapLibre style URL and rebuild the Android app. Sharing controls remain available.</Text>;
  if (!/^https:\/\//.test(styleUrl)) return <Text color="danger">Map setup needed: EXPO_PUBLIC_MAP_STYLE_URL must be an HTTPS map style URL.</Text>;
  const features: GeoJSON.Feature[] = points.map(point => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [accuracyRing(point)] } }));
  if (points.length === 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map(p => [p.lon, p.lat]) } });
  return <View style={{ gap: spacing.sm }}>
    <View style={{ minHeight: geometry.touch * 6, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
      <Map key={revision} mapStyle={styleUrl} style={{ flex: 1, minHeight: geometry.touch * 6 }} attribution tintColor={colors.primary} onDidFailLoadingMap={() => setFailed(true)}>
        <Camera ref={camera} initialViewState={points[0] ? { center: [points[0].lon, points[0].lat], zoom: 12 } : { zoom: 1 }} />
        <GeoJSONSource id="location-geometry" data={{ type: 'FeatureCollection', features }}>
          <Layer id="accuracy" type="fill" filter={['==', '$type', 'Polygon']} paint={{ 'fill-color': colors.primary, 'fill-opacity': geometry.parallax }} />
          <Layer id="distance-line" type="line" filter={['==', '$type', 'LineString']} paint={{ 'line-color': colors.primary, 'line-width': geometry.stroke }} />
        </GeoJSONSource>
        {points.map(point => <Person key={point.user_id} point={point} name={point.user_id === uid ? 'You' : partnerName} uri={point.user_id === uid ? ownAvatar : partnerAvatar} />)}
      </Map>
    </View>
    {failed && <><Text color="danger">The map could not load. Check your connection and map style setup.</Text><Button title="Retry map" variant="secondary" onPress={() => { setFailed(false); setRevision(v => v + 1); }} /></>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <Button title={follow ? 'Following you' : 'Follow me'} variant="secondary" disabled={!me} onPress={() => setFollow(v => !v)} />
      <Button title="Fit both" variant="secondary" disabled={points.length < 2} onPress={() => {
        setFollow(false);
        const lons = points.map(p => p.lon), lats = points.map(p => p.lat);
        camera.current?.fitBounds([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)], { padding: { top: spacing.s56, right: spacing.s56, bottom: spacing.s56, left: spacing.s56 }, duration: motion.level === 'full' ? motion.duration('slow') : 0 });
      }} />
    </View>
    <Text variant="caption">Map data © OpenStreetMap contributors · Maps © MapTiler</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <Button title="OpenStreetMap attribution" variant="ghost" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright'); }} />
      <Button title="MapTiler attribution" variant="ghost" onPress={() => { void Linking.openURL('https://www.maptiler.com/copyright/'); }} />
    </View>
  </View>;
}

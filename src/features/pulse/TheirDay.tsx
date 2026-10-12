import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { Canvas, Circle, Rect, LinearGradient, Group, vec } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import { usePartner, useProfile } from '@/lib/hooks';
import { deviceTimezone, validTimezone } from '@/lib/couple-time';
import { useTheme } from '@/theme';
import { useMotion } from '@/motion';
import { Card, Text, Button } from '@/ui';
import { pulseDb, limits } from './service';

const placeSchema = z.object({ city: z.string().nullable(), timezone: z.string().nullable(), lat: z.number().nullable(), lon: z.number().nullable() });
const weatherSchema = z.object({ current: z.object({ temperature_2m: z.number(), weather_code: z.number(), is_day: z.number() }), daily: z.object({ sunrise: z.array(z.string()), sunset: z.array(z.string()) }) });
export function timeDifference(now: Date, zone: string, yours: string) {
  const wall = (timeZone: string) => { const p = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now); const v = (t: string) => p.find(x => x.type === t)?.value; return Date.parse(`${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:00Z`); };
  const minutes = Math.round((wall(zone) - wall(yours)) / 60_000); const n = Math.abs(minutes);
  return minutes === 0 ? 'Same local time' : `${Math.floor(n / 60)}h ${n % 60}m ${minutes > 0 ? 'ahead' : 'behind'}`;
}
function condition(code: number) { return code === 0 ? 'Clear' : code <= 3 ? 'Cloudy' : code <= 48 ? 'Foggy' : code <= 67 ? 'Rain' : code <= 77 ? 'Snow' : code <= 82 ? 'Showers' : code <= 86 ? 'Snow showers' : 'Thunderstorms'; }
function Sky({ night, cloudy, mini }: { night: boolean; cloudy: boolean; mini: boolean }) {
  const { colors, spacing, geometry } = useTheme(); const motion = useMotion(); const drift = useSharedValue(0);
  useEffect(() => { drift.value = 0; if (motion.level === 'full') drift.value = withRepeat(withTiming(spacing.md, { duration: motion.duration('drift') }), -1, true); return () => cancelAnimation(drift); }, [motion.level, spacing.md, drift]);
  const transform = useDerivedValue(() => [{ translateX: drift.value }]); const h = mini ? geometry.touch : geometry.touch * 2;
  return <View accessible accessibilityLabel={`${night ? 'Moonlit' : 'Daytime'} ${cloudy ? 'cloudy' : 'clear'} sky`} style={{ height: h }}><Canvas style={{ flex: 1 }}><Rect x={0} y={0} width={geometry.particleTravel * 4} height={h}><LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[night ? colors.bg : colors.bgElevated, colors.surfaceAlt]} /></Rect><Group transform={transform}><Circle cx={geometry.touch} cy={h / 2} r={spacing.md} color={night ? colors.textSecondary : colors.primary} />{night && <Circle cx={geometry.touch + spacing.sm} cy={h / 2 - spacing.xs} r={spacing.md} color={colors.bg} />}{night && [2, 3, 4, 5].map(i => <Circle key={i} cx={geometry.touch * i} cy={spacing.sm + (i % 2) * spacing.md} r={geometry.hairline} color={colors.textPrimary} />)}{cloudy && [3, 4, 5].map(i => <Circle key={i} cx={geometry.touch + i * spacing.sm} cy={h / 2 + spacing.sm} r={spacing.md} color={colors.textSecondary} />)}</Group></Canvas></View>;
}
export function TheirDay({ mini = false, now = new Date(), offline = false }: { mini?: boolean; now?: Date; offline?: boolean }) {
  const { data: partner, isPending, error } = usePartner(); const { data: profile } = useProfile(); const { spacing } = useTheme();
  const [consent, setConsent] = useState(false); const key = `pulse:weather-consent:${profile?.id}:${partner?.id}`;
  useEffect(() => { let alive = true; setConsent(false); void AsyncStorage.getItem(key).then(v => { if (alive) setConsent(v === 'yes'); }).catch(() => {}); return () => { alive = false; }; }, [key]);
  const place = useQuery({ queryKey: ['pulse', 'place', partner?.id], enabled: !!partner?.id && !offline, queryFn: async ({ signal }) => { const { data, error: e } = await pulseDb.from('profiles').select('city,timezone,lat,lon').eq('id', partner!.id).abortSignal(signal).single(); if (e) throw e; return placeSchema.parse(data); } });
  const p = place.data; const zone = p?.timezone && validTimezone(p.timezone) ? p.timezone : null;
  const weather = useQuery({ queryKey: ['pulse-weather', profile?.id, partner?.id, p?.lat, p?.lon, zone], enabled: consent && !offline && !!p?.city && !!zone && p.lat !== null && p.lon !== null, staleTime: limits.weatherMs, gcTime: limits.weatherMs, refetchInterval: limits.weatherMs,
    queryFn: async ({ signal }) => { const params = new URLSearchParams({ latitude: String(p!.lat), longitude: String(p!.lon), timezone: zone!, current: 'temperature_2m,weather_code,is_day', daily: 'sunrise,sunset', forecast_days: '1' }); const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal }); if (!r.ok) throw new Error('Weather unavailable'); return weatherSchema.parse(await r.json()); } });
  const hour = zone ? Number(new Intl.DateTimeFormat('en', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(now)) : 12;
  return <Card style={{ gap: spacing.sm }}><Text variant="title/S">Their day{p?.city ? ` · ${p.city}` : ''}</Text>
    {error || place.error ? <Text color="danger">Their city could not load.</Text> : isPending || (!!partner && place.isPending) ? <Text>Loading their day…</Text> : !partner ? <Text>Link your couple to see their day.</Text> : !p?.city ? <Text color="textSecondary">Their city is private. They can choose to share a city in Settings → About you.</Text> : <>
      {zone ? <><Text>{new Intl.DateTimeFormat('en', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(now)}</Text><Text variant="body/S" color="textSecondary">Time difference: {timeDifference(now, zone, deviceTimezone())}</Text></> : <Text>They can add their time zone in Settings.</Text>}
      <Sky mini={mini} night={weather.data ? !weather.data.current.is_day : hour < 6 || hour >= 18} cloudy={(weather.data?.current.weather_code ?? 0) > 0} />
      {consent ? <><Text>{weather.isError ? 'Weather unavailable · try again later' : weather.data ? `${weather.data.current.temperature_2m}°C · ${condition(weather.data.current.weather_code)}` : offline ? 'Offline · weather paused' : 'Loading weather…'}</Text>{!mini && weather.data && <Text variant="body/S">Sunrise {weather.data.daily.sunrise[0]?.slice(11, 16)} · Sunset {weather.data.daily.sunset[0]?.slice(11, 16)}</Text>}<Button title="Weather sharing on · turn off" variant="ghost" onPress={() => { setConsent(false); void AsyncStorage.removeItem(key).catch(() => {}); }} /></> : <><Text variant="body/S" color="textSecondary">Weather is off. Enabling sends their shared city coordinates to Open-Meteo.</Text><Button title="Enable city weather" variant="secondary" disabled={offline || !zone || p.lat === null || p.lon === null} onPress={() => { setConsent(true); void AsyncStorage.setItem(key, 'yes').catch(() => setConsent(false)); }} /></>}
    </>}
  </Card>;
}

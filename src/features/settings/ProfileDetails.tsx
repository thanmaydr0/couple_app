import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useProfile } from '@/lib/hooks';
import { featureSupabase } from '@/lib/data/feature-client';
import { deviceTimezone, validTimezone } from '@/lib/couple-time';
import { validAnniversary } from '@/lib/settings';
import { Button, Card, Text, ListItem, ErrorState } from '@/ui';
import { FormField } from '@/ui/FormField';
import { useTheme } from '@/theme';

const locationSchema = z.object({ id: z.number(), name: z.string(), country: z.string().optional(), admin1: z.string().optional(), latitude: z.number(), longitude: z.number(), timezone: z.string() });
const geocodingSchema = z.object({ results: z.array(locationSchema).optional() });
type City = z.infer<typeof locationSchema>;
const detailsSchema = z.object({ birthday: z.string().nullable(), city: z.string().nullable(), lat: z.number().nullable(), lon: z.number().nullable(), timezone: z.string().nullable() });
export function ProfileDetails() {
  const { spacing } = useTheme(); const { data: profile } = useProfile(); const client = useQueryClient();
  const [birthday, setBirthday] = useState(''); const [city, setCity] = useState('');
  const [timezone, setTimezone] = useState(deviceTimezone); const [selected, setSelected] = useState<City | null>(null);
  const [results, setResults] = useState<City[]>([]); const [notice, setNotice] = useState('');
  const [shareCity, setShareCity] = useState(false); const revision = useRef(0);
  const details = useQuery({ queryKey: ['profile-details', profile?.id], enabled: !!profile?.id, queryFn: async ({ signal }) => {
    if (!profile) throw new Error('Profile unavailable');
    const { data, error } = await featureSupabase.from('profiles').select('birthday,city,lat,lon,timezone').eq('id', profile.id).abortSignal(signal).single(); if (error) throw error; return detailsSchema.parse(data);
  } });
  useEffect(() => { setBirthday(details.data?.birthday ?? ''); }, [details.data?.birthday]);
  useEffect(() => { setTimezone(details.data?.timezone ?? deviceTimezone()); }, [details.data?.timezone]);
  useEffect(() => { setCity(details.data?.city ?? ''); setShareCity(!!details.data?.city); }, [details.data?.city]);
  const search = useMutation({ mutationFn: async () => {
    const current = revision.current; const term = city.trim(); if (term.length < 2) throw new Error('Enter at least two letters to search for a city.');
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=5&language=en&format=json`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('City search is unavailable. Try again.');
    return { current, cities: geocodingSchema.parse(await response.json()).results ?? [] };
  }, onSuccess: ({ current, cities }) => { if (current !== revision.current) return; setResults(cities); setNotice(cities.length ? 'Choose a city below. Nothing is shared until you save.' : 'No cities found. Try a nearby city.'); } });
  const save = useMutation({ mutationFn: async () => {
    if (!profile) throw new Error('Profile unavailable');
    if (!validAnniversary(birthday) || (birthday && birthday > new Date().toISOString().slice(0, 10))) throw new Error('Enter a valid birthday as YYYY-MM-DD, or leave it blank.');
    if (!validTimezone(timezone)) throw new Error('Enter a valid IANA time zone, for example Asia/Kolkata.');
    if (shareCity && !selected && city !== details.data?.city) throw new Error('Search and choose a city before saving.');
    const { error } = await featureSupabase.from('profiles').update({ birthday: birthday || null, timezone,
      city: shareCity ? selected?.name ?? details.data?.city ?? null : null,
      lat: shareCity ? selected?.latitude ?? details.data?.lat ?? null : null,
      lon: shareCity ? selected?.longitude ?? details.data?.lon ?? null : null,
    }).eq('id', profile.id).select('id').single(); if (error) throw error;
    await client.invalidateQueries({ queryKey: ['profile-details', profile.id] }); await client.invalidateQueries({ queryKey: ['profile'] });
  }, onSuccess: () => setNotice('Profile details saved.') });
  const clearCity = useMutation({ mutationFn: async () => {
    if (!profile) throw new Error('Profile unavailable');
    const { error } = await featureSupabase.from('profiles').update({ city: null, lat: null, lon: null }).eq('id', profile.id).select('id').single();
    if (error) throw error;
  }, onSuccess: () => {
    revision.current += 1; setShareCity(false); setSelected(null); setCity(''); setResults([]); setNotice('City sharing is off. Your saved city and coordinates were removed.');
    client.setQueryData(['profile-details', profile?.id], (previous: z.infer<typeof detailsSchema> | undefined) => previous ? { ...previous, city: null, lat: null, lon: null } : previous);
    void client.invalidateQueries({ queryKey: ['profile'] });
  } });
  const busy = save.isPending || clearCity.isPending;
  const error = clearCity.error ?? save.error ?? search.error;
  return <Card style={{ gap: spacing.md }}><Text variant="title/M">About you</Text><Text variant="body/S" color="textSecondary">Birthday and time zone are visible to your partner when saved. City sharing is optional and off until you choose a city. It never tracks your device.</Text>
    {details.isPending ? <Text>Loading profile details…</Text> : details.isError ? <ErrorState description="Profile details could not load." onRetry={() => { void details.refetch(); }} /> : <>
    <FormField label="Birthday (YYYY-MM-DD)" value={birthday} onChangeText={setBirthday} maxLength={10} editable={!busy} />
    <FormField label="Time zone" value={timezone} onChangeText={setTimezone} autoCapitalize="none" editable={!busy} /><Button title="Use device time zone" variant="ghost" onPress={() => setTimezone(deviceTimezone())} disabled={busy} />
    <Text color={shareCity ? 'primary' : 'textSecondary'}>{details.data?.city ? shareCity ? 'City sharing is on' : 'City removal ready to save' : shareCity ? 'City selected — save to share' : 'City sharing is off'}</Text>
    <FormField label="City (optional)" value={city} onChangeText={value => { revision.current += 1; setCity(value); setSelected(null); setResults([]); }} editable={!busy} />
    <Button title="Search cities" loading={search.isPending} disabled={search.isPending || busy} onPress={() => { setNotice(''); search.mutate(); }} />
    <View>{results.map(result => <ListItem key={result.id} title={result.name} subtitle={[result.admin1, result.country, result.timezone].filter(Boolean).join(' · ')} disabled={busy} onPress={() => { revision.current += 1; setSelected(result); setCity(result.name); setTimezone(result.timezone); setShareCity(true); setResults([]); setNotice('City selected. Save to share with your partner.'); }} />)}</View>
    <Button title="Turn off city sharing" variant="ghost" loading={clearCity.isPending} disabled={busy} onPress={() => { setNotice(''); clearCity.mutate(); }} />
    <Button title="Save profile details" loading={save.isPending} disabled={busy} onPress={() => { setNotice(''); save.mutate(); }} />
    </>}{notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}{error && <Text accessibilityRole="alert" color="danger">{error instanceof Error ? error.message : 'Could not save. Check your connection and try again.'}</Text>}
    <Text variant="caption" color="textSecondary">City search by Open-Meteo · GeoNames</Text>
  </Card>;
}

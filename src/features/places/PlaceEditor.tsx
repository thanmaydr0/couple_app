import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Button, Card, Chip, PressableScale, SegmentedControl, Text, TextField } from '@/ui';
import { useTheme } from '@/theme';
import { usePhotos, usePhotoUrl, searchPlaces } from './data';
import { DatePicker } from './DatePicker';
import { haversine, validDate } from './geo';
import { suggestFromPhotos } from './photos';
import type { GeoResult, Place, PlaceInput, Suggestion } from './types';
import asset from './world-paths.json';

function MemoryChoice({ photo, couple, selected, onPress }: { photo: { id: string; thumb_path: string | null; storage_path: string; caption: string | null; taken_at: string }; couple: string; selected: boolean; onPress: () => void }) {
  const { spacing, geometry, colors, radius } = useTheme(); const url=usePhotoUrl(photo.id,photo.thumb_path ?? photo.storage_path,couple);
  return <PressableScale accessibilityRole="checkbox" accessibilityState={{checked:selected}} accessibilityLabel={photo.caption ?? `Photo from ${new Date(photo.taken_at).toLocaleDateString()}`} onPress={onPress} style={{flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.sm,padding:spacing.sm,borderWidth:geometry.stroke,borderColor:selected ? colors.primary : colors.border}}>
    {url.data && <Image source={{uri:url.data}} style={{width:geometry.avatar,height:geometry.avatar,borderRadius:radius.sm}} />}<Text style={{flex:1}} numberOfLines={2}>{selected ? '✓ ' : ''}{photo.caption ?? new Date(photo.taken_at).toLocaleDateString()}{url.isError ? ' · Preview unavailable' : ''}</Text>
  </PressableScale>;
}
export function PlaceEditor({ place, knownPlaces, couple, offline, onSave, onClose }: { place?: Place; knownPlaces: Place[]; couple: string; offline: boolean; onSave: (input: PlaceInput, id?: string) => Promise<void>; onClose: () => void }) {
  const { spacing } = useTheme(); const [name,setName]=useState(place?.name ?? ''); const [term,setTerm]=useState('');
  const [location,setLocation]=useState<{lat:number;lon:number}|null>(place ? {lat:place.lat,lon:place.lon} : null);
  const [country,setCountry]=useState(place?.country_code ?? ''); const [kind,setKind]=useState<Place['kind']>(place?.kind ?? 'visited');
  const [date,setDate]=useState(place?.visited_on ?? ''); const [notes,setNotes]=useState(place?.notes ?? '');
  const [ids,setIds]=useState(place?.media_ids ?? []); const [results,setResults]=useState<GeoResult[]>([]);
  const [searching,setSearching]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const [searched,setSearched]=useState(false), [suggestions,setSuggestions]=useState<Suggestion[]|null>(null);
  const [gpsEnabled,setGpsEnabled]=useState(false); const [scanning,setScanning]=useState(false); const [photoLimit,setPhotoLimit]=useState(8);
  const photos=usePhotos(couple,!offline); const request=useRef<AbortController|null>(null); const scanVersion=useRef(0);
  useEffect(()=>()=>{request.current?.abort();scanVersion.current++;},[]);
  async function search() {
    request.current?.abort(); const controller=new AbortController();request.current=controller;setSearching(true);setError('');
    try { const found=await searchPlaces(term,controller.signal); if (!controller.signal.aborted) {setResults(found);setSearched(true);} }
    catch {if (!controller.signal.aborted) setError('Place search failed. Check your connection and try again.');}
    finally {if (!controller.signal.aborted) setSearching(false);}
  }
  async function scan() {
    const version=++scanVersion.current;setScanning(true);setError('');
    try { const found=await suggestFromPhotos();if(version===scanVersion.current)setSuggestions(found); }
    catch(e) {if(version===scanVersion.current)setError(e instanceof Error ? e.message : 'Could not inspect selected photos.');}
    finally {if(version===scanVersion.current)setScanning(false);}
  }
  function useSuggestion(s: Suggestion) {
    const nearby=results.find(r=>haversine(s,{lat:r.latitude,lon:r.longitude})<=40);
    const saved=knownPlaces.find(p=>haversine(s,p)<=40);
    setLocation({lat:s.lat,lon:s.lon});setName(nearby?.name ?? saved?.name ?? 'Photo location');setCountry(nearby?.country_code ?? saved?.country_code ?? '');setDate(s.date ?? '');
  }
  async function save() {
    setError('');
    if (!name.trim() || !location) {setError('Search and select a location, or choose a photo suggestion.');return;}
    if(date && !validDate(date)) {setError('Choose a valid visit date.');return;}
    if(country && !/^[A-Z]{2}$/.test(country)) {setError('Country code must be two letters, for example IN.');return;}
    setBusy(true);
    try { await onSave({name:name.trim(),...location,country_code:country || null,kind,visited_on:date || null,notes:notes.trim() || null,media_ids:ids},place?.id);onClose(); }
    catch {setError('Could not save this place. Your draft is still here; reconnect and try again.');}
    finally {setBusy(false);}
  }
  return <Card style={{gap:spacing.md}}><Text variant="title/M">{place ? 'Edit our place' : 'Add to our world'}</Text>
    <Text variant="body/S" color="textSecondary">Saved locations and linked memories are shared with your partner. Search sends your query to Open-Meteo.</Text>
    <TextField label="Search a city or place" value={term} onChangeText={setTerm} maxLength={160} editable={!busy} />
    <Button title="Find place" variant="secondary" loading={searching} disabled={offline || term.trim().length<2 || busy} onPress={()=>void search()} />
    {results.map(r=><PressableScale key={r.id} accessibilityRole="button" onPress={()=>{setName(r.name);setCountry(r.country_code ?? '');setLocation({lat:r.latitude,lon:r.longitude});setResults([]);setSearched(false);}}><Text>{[r.name,r.admin1,r.country].filter(Boolean).join(', ')}</Text></PressableScale>)}
    {searched && !results.length && <Text color="textSecondary">No results. Try a nearby city or a different spelling.</Text>}
    <TextField label="Name" value={name} onChangeText={setName} maxLength={160} editable={!busy} />
    {location && <Text variant="caption" color="textSecondary">Selected location: {location.lat.toFixed(3)}, {location.lon.toFixed(3)}</Text>}
    <TextField label="Country code (optional)" value={country} onChangeText={v=>setCountry(v.toUpperCase())} maxLength={2} autoCapitalize="characters" editable={!busy} hint={asset.countries.find(c=>c.code===country)?.name ?? 'ISO code, for example IN. Small islands still count even without a map shape.'} />
    <SegmentedControl options={(['visited','wishlist','home','special'] as const).map(value=>({value,label:value[0]!.toUpperCase()+value.slice(1)}))} value={kind} onChange={setKind} disabled={busy} />
    <DatePicker value={date} onChange={setDate} />
    <TextField label="Notes" value={notes} onChangeText={setNotes} maxLength={2000} multiline editable={!busy} />
    <Text variant="title/S">Link photos from Memories ({ids.length}/30)</Text>
    {photos.isLoading && <Text color="textSecondary">Loading shared photos…</Text>}
    {photos.isError && <><Text color="danger">Could not load Memories.</Text><Button title="Retry photos" variant="secondary" onPress={()=>void photos.refetch()} /></>}
    {photos.data?.length===0 && <Text color="textSecondary">Add photos in Memories first. You can save this place now.</Text>}
    {photos.data?.slice(0,photoLimit).map(photo=><MemoryChoice key={photo.id} photo={photo} couple={couple} selected={ids.includes(photo.id)} onPress={()=>setIds(current=>current.includes(photo.id) ? current.filter(id=>id!==photo.id) : current.length<30 ? [...current,photo.id] : current)} />)}
    {ids.some(id=>!photos.data?.some(p=>p.id===id)) && <><Text color="textSecondary">Some linked photos are unavailable.</Text><Button title="Unlink unavailable photos" variant="secondary" disabled={!photos.isSuccess} onPress={()=>setIds(ids.filter(id=>photos.data?.some(p=>p.id===id)))} /></>}
    {(photos.data?.length ?? 0)>photoLimit && <Button title="More memories" variant="secondary" onPress={()=>setPhotoLimit(n=>n+8)} />}
    <Chip label={gpsEnabled ? 'Photo location suggestions: ON · Turn off' : 'Photo location suggestions: OFF · Enable'} selected={gpsEnabled} disabled={busy} onPress={()=>{setGpsEnabled(!gpsEnabled);setSuggestions(null);scanVersion.current++;setScanning(false);}} />
    {gpsEnabled && <><Text variant="body/S" color="textSecondary">Only selected photos are inspected on this phone. Android may remove GPS. Turn off to discard suggestions. Originals are never uploaded here.</Text><Button title="Inspect selected photos" variant="secondary" loading={scanning} onPress={()=>void scan()} />
      {suggestions?.length===0 && <Text color="textSecondary">No GPS found in those photos. Search for the place instead.</Text>}
      {suggestions?.map((s,i)=>{const nearby=results.find(r=>haversine(s,{lat:r.latitude,lon:r.longitude})<=40);const saved=knownPlaces.find(p=>haversine(s,p)<=40);return <Button key={i} title={`${s.count} photo${s.count===1?'':'s'} taken near ${nearby?.name ?? saved?.name ?? `${s.lat.toFixed(2)}, ${s.lon.toFixed(2)}`}: add as a place?`} variant="secondary" disabled={busy} onPress={()=>useSuggestion(s)} />;})}</>}
    {!!error && <Text color="danger" accessibilityLiveRegion="polite">{error}</Text>}
    <Button title="Save our place" loading={busy} disabled={offline || !location || !name.trim()} onPress={()=>void save()} />
    <Button title="Cancel" variant="ghost" disabled={busy} onPress={onClose} />
    <Text variant="caption" color="textSecondary">Geocoding: Open-Meteo / GeoNames</Text>
  </Card>;
}

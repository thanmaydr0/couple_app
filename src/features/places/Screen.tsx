import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useNetInfo } from '@react-native-community/netinfo';
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Button, Card, Dialog, EmptyState, ErrorState, Header, ListItem, OfflineBanner, Screen, SegmentedControl, Skeleton, Switch, Text } from '@/ui';
import { useTheme } from '@/theme';
import { usePlaces, useHomes, useMeeting, usePhotos } from './data';
import { haversine, stats } from './geo';
import { PlaceEditor } from './PlaceEditor';
import { WorldMap, useCanvasRef } from './WorldMap';
import type { Place } from './types';

export default function PlacesScreen() {
  const { spacing, geometry }=useTheme(); const model=usePlaces(); const net=useNetInfo();
  const offline=net.isConnected===false || net.isInternetReachable===false;
  const [showHomes,setShowHomes]=useState(false); const homes=useHomes(model.couple,showHomes && model.active);
  const meeting=useMeeting(model.couple,showHomes && model.active); const photos=usePhotos(model.couple,model.active);
  const [sort,setSort]=useState<'recent'|'name'|'kind'>('recent'); const [filter,setFilter]=useState<'all'|'visited'|'wishlist'>('all');
  const [editor,setEditor]=useState<Place|'new'|null>(null); const [deleting,setDeleting]=useState<Place|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [mapVisible,setMapVisible]=useState(true); const canvasRef=useCanvasRef();
  const places=model.data ?? []; const numbers=useMemo(()=>stats(model.data ?? []),[model.data]);
  const rows=useMemo(()=>[...places].filter(p=>filter==='all' || (filter==='visited' ? p.kind!=='wishlist' : p.kind==='wishlist')).sort((a,b)=>sort==='name' ? a.name.localeCompare(b.name) : sort==='kind' ? a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) : (b.visited_on ?? b.created_at).localeCompare(a.visited_on ?? a.created_at)),[model.data,sort,filter]);
  const displayedHomes=showHomes ? homes.data ?? [] : [];
  const distance=displayedHomes[0] && displayedHomes[1] ? Math.round(haversine(displayedHomes[0],displayedHomes[1])) : null;
  async function share() {
    setBusy(true);setError(''); let uri:string|undefined;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
      if (!canvasRef.current || !FS.cacheDirectory) throw new Error('The map is still loading.');
      const image=await canvasRef.current.makeImageSnapshotAsync(); const base64=image.encodeToBase64();image.dispose();
      uri=`${FS.cacheDirectory}our-places-${Date.now()}.png`;await FS.writeAsStringAsync(uri,base64,{encoding:FS.EncodingType.Base64});
      await Sharing.shareAsync(uri,{mimeType:'image/png',dialogTitle:'Our Places'});
    } catch(e) {setError(e instanceof Error ? e.message : 'Could not share this map.');}
    finally {if(uri) await FS.deleteAsync(uri,{idempotent:true}).catch(()=>{});setBusy(false);}
  }
  async function remove() {if(!deleting)return;setBusy(true);setError('');try{await model.remove(deleting.id);setDeleting(null);}catch{setError('Could not remove this place. Try again when connected.');}finally{setBusy(false);}}
  return <Screen bottomInset><Stack.Screen options={{headerShown:false}} /><Header title="Our Places" subtitle="A world of little moments, together." onBack={()=>router.back()} />
    <FlatList data={rows} keyExtractor={p=>p.id} keyboardShouldPersistTaps="handled" initialNumToRender={geometry.firstScreenful} windowSize={5} onScroll={e=>{const visible=e.nativeEvent.contentOffset.y<geometry.touch*6;if(visible!==mapVisible)setMapVisible(visible);}} contentContainerStyle={{gap:spacing.md,paddingBottom:spacing.lg}}
      ListHeaderComponent={<View style={{gap:spacing.md}}>
        <OfflineBanner offline={offline} message="You’re offline. Loaded places remain visible; saving and search need a connection." />
        {model.profile.isLoading && <Skeleton height={geometry.touch} />}
        {model.profile.isError && <ErrorState title="Could not load your couple" onRetry={()=>void model.profile.refetch()} />}
        {!model.profile.isLoading && !model.profile.isError && !model.couple && <EmptyState title="A world for two" description="Sign in with a linked couple to start your map." />}
        {model.couple && <>
          <WorldMap places={places} homes={displayedHomes} photos={photos.data} couple={model.couple} active={model.active && mapVisible} canvasRef={canvasRef} />
          <Text variant="caption" color="textSecondary">Natural Earth / world-atlas · Borders are illustrative. Tiny islands may appear as pins only.</Text>
          <Card style={{gap:spacing.sm}}><Text variant="title/M">{numbers.countries} of 195 countries</Text><Text>{numbers.cities} cities · {numbers.km.toLocaleString()} km estimated</Text><Text variant="caption" color="textSecondary">Estimate joins dated visited places in date order; it is not a recorded journey.</Text></Card>
          <Card style={{gap:spacing.sm}}><View style={{flexDirection:'row',alignItems:'center',gap:spacing.sm}}><Text variant="title/S" style={{flex:1}}>Distance between us · {showHomes ? 'ON' : 'OFF'}</Text><Switch value={showHomes} onValueChange={setShowHomes} accessibilityLabel="Show shared home cities and distance on this map" /></View>
            <Text variant="body/S" color="textSecondary">Uses home cities you each opted to share in Settings. This map view is off by default.</Text>
            {showHomes && <>{homes.isLoading ? <Text>Loading shared home cities…</Text> : homes.isError ? <ErrorState title="Home cities unavailable" onRetry={()=>void homes.refetch()} /> : distance!==null ? <><Text variant="title/M">{distance.toLocaleString()} km between us</Text><Text>{displayedHomes.map(h=>h.city).join(' ↔ ')}</Text>{meeting.data && <Text>Next time we meet: {Math.max(0,Math.ceil((Date.parse(meeting.data)-Date.now())/86_400_000))} days</Text>}</> : <Text color="textSecondary">Both partners need to opt in to sharing a home city in Settings.</Text>}
              {meeting.isError && <><Text color="textSecondary">Plans countdown unavailable.</Text><Button title="Retry countdown" variant="ghost" onPress={()=>void meeting.refetch()} /></>}
              <Button title="Manage shared home cities" variant="ghost" onPress={()=>router.push('/settings')} />
            </>}
          </Card>
          <Button title="Add a place" disabled={offline || editor!==null} onPress={()=>setEditor('new')} />
          <Button title="Share map image" variant="secondary" disabled={model.isLoading} loading={busy && !deleting} onPress={()=>void share()} />
          <Text variant="caption" color="textSecondary">Shares the visible map, including photo pins and home cities when shown.</Text>
          {model.isLoading && <Skeleton height={geometry.touch} />}
          {model.isError && <ErrorState title="Places could not sync" description="Loaded places are kept below. Reconnect and retry." onRetry={()=>void model.refetch()} />}
          {model.liveError && <OfflineBanner message="Live updates paused. Refresh to get your partner’s latest places." onRetry={()=>void model.refetch()} />}
          {!!error && <Text color="danger" accessibilityLiveRegion="polite">{error}</Text>}
          {editor && <PlaceEditor key={editor==='new' ? 'new' : editor.id} place={editor==='new' ? undefined : editor} knownPlaces={places} couple={model.couple} offline={offline} onSave={model.save} onClose={()=>setEditor(null)} />}
          <Text variant="title/M">Our place list</Text>
          <SegmentedControl options={[{value:'all',label:'All'},{value:'visited',label:'Visited'},{value:'wishlist',label:'Wishlist'}]} value={filter} onChange={setFilter} />
          <SegmentedControl options={[{value:'recent',label:'Date'},{value:'name',label:'Name'},{value:'kind',label:'Kind'}]} value={sort} onChange={setSort} />
          <Button title="Refresh places" variant="ghost" disabled={offline} onPress={()=>void model.refetch()} />
        </>}
      </View>}
      ListEmptyComponent={model.couple && !model.isLoading && !model.isError ? <EmptyState title={filter==='all' ? 'Your first pin is waiting' : 'No places in this view'} description="Save somewhere you have been or somewhere you dream of going." /> : null}
      renderItem={({item})=><Card style={{gap:spacing.sm}}><ListItem title={item.name} subtitle={`${item.kind} · ${item.country_code ?? 'Country not set'}${item.visited_on ? ` · ${item.visited_on}` : ''}`} onPress={()=>setEditor(item)} disabled={busy || editor!==null} />{item.notes && <Text>{item.notes}</Text>}<Text variant="caption" color="textSecondary">{item.media_ids.length} linked photos</Text><Button title={`Remove ${item.name}`} variant="ghost" disabled={offline || busy} onPress={()=>setDeleting(item)} /></Card>}
    />
    <Dialog visible={!!deleting} title={`Remove ${deleting?.name ?? 'place'}?`} description="This removes the place for both of you. Linked Memories are kept." onClose={()=>{if(!busy)setDeleting(null);}} actionLabel="Remove place" destructive busy={busy} onAction={()=>void remove()}>{!!error && <Text color="danger">{error}</Text>}</Dialog>
  </Screen>;
}

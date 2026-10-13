import * as Picker from 'expo-image-picker';
import * as Library from 'expo-media-library/legacy';
import { clusterPhotos } from './geo';

function coordinate(value: unknown, ref: unknown): number | null {
  let n: number;
  if (typeof value === 'number') n = value;
  else if (Array.isArray(value) && value.length >= 3 && value.every(v => typeof v === 'number')) n = Number(value[0]) + Number(value[1])/60 + Number(value[2])/3600;
  else return null;
  return Number.isFinite(n) ? (ref === 'S' || ref === 'W' ? -Math.abs(n) : n) : null;
}
// Only user-selected assets are inspected. No background location permission or GPS upload.
export async function suggestFromPhotos() {
  const permission = await Picker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo access was not granted. You can still search for a place.');
  const result = await Picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 30, exif: true, quality: 1 });
  if (result.canceled) return null;
  const points: { lat: number; lon: number; date: string | null }[] = [];
  for (const photo of result.assets) {
    let lat = coordinate(photo.exif?.GPSLatitude, photo.exif?.GPSLatitudeRef), lon = coordinate(photo.exif?.GPSLongitude, photo.exif?.GPSLongitudeRef);
    let date: string | null = null;
    if (photo.assetId) {
      try { const info = await Library.getAssetInfoAsync(photo.assetId); lat ??= info.location?.latitude ?? null; lon ??= info.location?.longitude ?? null; if (info.creationTime) date = new Date(info.creationTime).toISOString().slice(0,10); } catch { /* Android may redact GPS with limited permission. */ }
    }
    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) points.push({ lat, lon, date });
  }
  return clusterPhotos(points);
}

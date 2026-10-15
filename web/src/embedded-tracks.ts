import { el } from './ui.js';

export type LocalAudioTrack = { readonly label: string; readonly language: string; enabled: boolean };
export type LocalCaptionTrack = { readonly label: string; readonly language: string; readonly kind: string; mode: TextTrackMode };
type TrackList<T> = EventTarget & { readonly length: number; readonly [index: number]: T | undefined };
type TrackVideo = HTMLVideoElement & { readonly audioTracks?: TrackList<LocalAudioTrack> };

export function audioChoice(tracks: readonly LocalAudioTrack[], index: number) {
  const selected = tracks[index]; if (!selected) return false;
  // Enable the new track before disabling the old one to avoid a silent gap.
  selected.enabled = true;
  for (const track of tracks) if (track !== selected) track.enabled = false;
  return true;
}
export function captionChoice(tracks: readonly LocalCaptionTrack[], index: number) {
  if (index !== -1 && !tracks[index]) return false;
  tracks.forEach((track, at) => { track.mode = at === index ? 'showing' : 'disabled'; });
  return true;
}
function label(track: { label: string; language: string }, index: number) {
  return [track.label || `Track ${index + 1}`, track.language].filter(Boolean).join(' · ');
}
function options(select: HTMLSelectElement, choices: { name: string; value: number }[], selected: number) {
  const signature = JSON.stringify(choices);
  if (select.dataset.choices !== signature) {
    select.replaceChildren(...choices.map(choice => { const option = el('option', '', choice.name); option.value = String(choice.value); return option; }));
    select.dataset.choices = signature;
  }
  select.value = String(selected);
}

/** Device-local media preferences. Deliberately has no backend or sync access. */
export function embeddedTracks(video: HTMLVideoElement) {
  const node = el('div', 'local-track-controls');
  const audioLabel = el('label', 'field', 'Audio language · this device'); const audio = el('select'); audioLabel.append(audio);
  const captionLabel = el('label', 'field', 'Captions · this device'); const captions = el('select'); captionLabel.append(captions);
  const hint = el('p', 'muted fine'); hint.setAttribute('role', 'status');
  node.append(audioLabel, captionLabel, hint);
  const audioList = (video as TrackVideo).audioTracks;
  const audios = () => audioList ? Array.from({ length: audioList.length }, (_, index) => audioList[index]).filter((track): track is LocalAudioTrack => !!track) : [];
  const texts = () => Array.from(video.textTracks).filter(track => track.kind === 'captions' || track.kind === 'subtitles');
  let failed = false;
  function refresh() {
    const availableAudio = audios(); const availableText = texts();
    options(audio, availableAudio.length ? availableAudio.map((track, index) => ({ name: label(track, index), value: index })) : [{ name: video.readyState === 0 && !failed ? 'Reading embedded tracks…' : 'Default audio', value: -1 }], availableAudio.findIndex(track => track.enabled));
    options(captions, [{ name: 'Off', value: -1 }, ...availableText.map((track, index) => ({ name: label(track, index), value: index }))], availableText.findIndex(track => track.mode === 'showing'));
    audio.disabled = availableAudio.length < 2; captions.disabled = availableText.length === 0;
    hint.textContent = video.readyState === 0 && !failed ? 'Reading tracks from your video…' : [
      'Language, captions and volume affect only this device.',
      !audioList ? 'This browser does not expose embedded audio-language switching.' : availableAudio.length < 2 ? 'No alternate audio track is exposed by this browser for this video.' : '',
      availableText.length === 0 ? 'No embedded subtitle tracks are exposed by this browser for this video.' : '',
    ].filter(Boolean).join(' ');
  }
  audio.onchange = () => { audioChoice(audios(), Number(audio.value)); refresh(); };
  captions.onchange = () => { captionChoice(texts(), Number(captions.value)); refresh(); };
  const onError = () => { failed = true; refresh(); };
  for (const event of ['loadedmetadata', 'loadeddata', 'canplay', 'emptied']) video.addEventListener(event, refresh);
  video.addEventListener('error', onError);
  for (const list of [audioList, video.textTracks]) if (list) for (const event of ['addtrack', 'removetrack', 'change']) list.addEventListener(event, refresh);
  refresh();
  return { node, cleanup() {
    for (const event of ['loadedmetadata', 'loadeddata', 'canplay', 'emptied']) video.removeEventListener(event, refresh);
    video.removeEventListener('error', onError);
    for (const list of [audioList, video.textTracks]) if (list) for (const event of ['addtrack', 'removetrack', 'change']) list.removeEventListener(event, refresh);
  } };
}

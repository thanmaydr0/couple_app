import { type MovieEngine } from './media-engine.js';
import { el, notice, show } from './ui.js';
export function mediaSettings(engine: MovieEngine) {
  const node = el('div','local-track-controls'); const audioLabel = el('label','field','Audio language · this device'); const audio = el('select'); audioLabel.append(audio);
  const captionLabel = el('label','field','Captions · this device'); const captions = el('select'); captionLabel.append(captions);
  audio.setAttribute('aria-label','Audio language · this device');captions.setAttribute('aria-label','Captions · this device');
  const help = el('p','muted fine','Embedded tracks are read directly from your movie. Your choices stay on this device.'); const error = notice();
  node.append(audioLabel, captionLabel, help, error);
  function options(select: HTMLSelectElement, choices: { id: number; label: string }[], chosen: number) {
    const signature = JSON.stringify(choices);
    if (select.dataset.choices !== signature) { select.replaceChildren(...choices.map(choice => { const option = el('option','',choice.label); option.value = String(choice.id); return option; })); select.dataset.choices = signature; }
    select.value = String(chosen);
  }
  function refresh() {
    const audios = engine.tracks.filter(track=>track.kind==='audio'); const subtitles = engine.tracks.filter(track=>track.kind==='subtitle');
    options(audio,audios.length?audios:[{id:-1,label:'No audio track'}],engine.selectedAudio>=0?engine.selectedAudio:audios[0]?.id??-1);
    options(captions,[{id:-1,label:'Off'},...subtitles],engine.selectedCaption);
    audio.disabled = !engine.enabled || engine.busy || audios.length<2; captions.disabled = !engine.enabled || engine.busy || engine.captionLoading || !subtitles.length;
    help.textContent = engine.captionLoading ? 'Reading embedded captions locally… Playback can continue while captions prepare.' : engine.tracks.length ? `${audios.length} audio · ${subtitles.length} subtitle tracks. Language, captions and volume stay on this device.` : 'Reading embedded tracks from your movie…';
  }
  audio.onchange = async () => { const id=Number(audio.value); audio.disabled=true; show(error,''); try { await engine.selectAudio(id); } catch(failure) { show(error,failure instanceof Error?failure.message:'Could not switch audio'); } finally { refresh(); } };
  captions.onchange = async () => { const id=Number(captions.value); captions.disabled=true; show(error,''); try { await engine.selectSubtitle(id); } catch(failure) { show(error,failure instanceof Error?failure.message:'Could not switch captions'); } finally { refresh(); } };
  for (const event of ['trackschange','statechange','loadedmetadata']) engine.addEventListener(event,refresh); refresh();
  return {node,cleanup(){for(const event of ['trackschange','statechange','loadedmetadata'])engine.removeEventListener(event,refresh);}};
}

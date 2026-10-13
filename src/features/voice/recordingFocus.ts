import { createAudioPlayer } from 'expo-audio';

// expo-audio's Android recorder does not request audio focus; its player does.
// A muted local loop owns focus for the capture and exposes focus loss through
// playback status. Release it immediately when capture ends, including calls.
export function recordingFocus(onInterrupted: () => void): () => void {
  const focus = createAudioPlayer(require('./silence.wav'));
  focus.muted = true; focus.loop = true;
  let playing = false; let disposed = false; let interrupted = false;
  const listener = focus.addListener('playbackStatusUpdate', status => {
    if (disposed) return;
    if (status.playing) playing = true;
    else if (!interrupted && (playing || status.error)) { interrupted = true; onInterrupted(); }
  });
  focus.play();
  return () => { disposed = true; listener.remove(); focus.remove(); };
}

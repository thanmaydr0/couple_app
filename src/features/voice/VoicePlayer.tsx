import { useEffect, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { Waveform } from './Waveform';
import { playbackSnapshot, pauseVoice, playVoice, seekVoice, subscribePlayback, voiceSpeed, watchAudioFocus, type VoiceTrack } from './playback';
import { voiceTime } from './types';

export function VoicePlayer(props: VoiceTrack) {
  const { colors, spacing, typography, geometry, radius } = useTheme();
  const playback = useSyncExternalStore(subscribePlayback, playbackSnapshot, playbackSnapshot);
  const active = playback.id === props.id;
  useEffect(() => watchAudioFocus(), []);
  const duration = active ? playback.duration * 1000 : props.meta?.duration_ms ?? 0;
  const text = { ...typography['body/S'], color: colors.textPrimary };
  return <View style={{ minWidth: geometry.touch * 4, gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xs }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <PressableScale accessibilityRole="button" accessibilityLabel={active && playback.loading ? 'Cancel voice loading' : active && playback.playing ? 'Pause voice message' : 'Play voice message'} onPress={() => { if (active && playback.loading) pauseVoice(); else void playVoice(props); }} style={{ justifyContent: 'center', alignItems: 'center' }}><Text style={text}>{active && playback.loading ? '…' : active && playback.playing ? 'Ⅱ' : '▶'}</Text></PressableScale>
      <Waveform peaks={props.meta?.peaks ?? Array.from({ length: 64 }, () => 0.25)} progress={active && playback.duration ? playback.position / playback.duration : 0} onSeek={fraction => { void (async () => { if (playbackSnapshot().id !== props.id) await playVoice(props); await seekVoice(props.id, fraction); })().catch(() => undefined); }} />
      <PressableScale accessibilityRole="button" accessibilityLabel="Change voice playback speed" onPress={voiceSpeed} style={{ justifyContent: 'center', alignItems: 'center' }}><Text style={text}>{playback.speed}×</Text></PressableScale>
    </View>
    <Text style={text}>{active ? `${voiceTime(playback.position * 1000)} / ` : ''}{duration ? voiceTime(duration) : 'Voice message'}{props.receiver && props.meta?.played_at ? ' · Heard' : ''}</Text>
    {active && playback.error && <PressableScale onPress={() => void playVoice(props)}><Text style={{ ...text, color: colors.danger }}>{playback.error}</Text></PressableScale>}
  </View>;
}

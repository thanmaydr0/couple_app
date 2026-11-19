import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { Waveform } from './Waveform';
import {
  playbackSnapshot,
  pauseVoice,
  playVoice,
  seekVoice,
  subscribePlayback,
  voiceSpeed,
  watchAudioFocus,
  type VoiceTrack,
} from './playback';
import { voiceTime } from './types';

export function VoicePlayer(props: VoiceTrack) {
  const { colors, spacing, typography, geometry, radius } = useTheme();
  const playback = useSyncExternalStore(subscribePlayback, playbackSnapshot, playbackSnapshot);
  const active = playback.id === props.id;

  useEffect(() => watchAudioFocus(), []);

  const duration = active ? playback.duration * 1000 : props.meta?.duration_ms ?? 0;

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: radius.lg,
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        {/* Play/Pause circular button */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            active && playback.loading
              ? 'Cancel voice loading'
              : active && playback.playing
              ? 'Pause voice message'
              : 'Play voice message'
          }
          onPress={() => {
            if (active && playback.loading) pauseVoice();
            else void playVoice(props);
          }}
          style={[styles.playBtn, { backgroundColor: colors.primary, borderRadius: radius.pill }]}
        >
          <Ionicons
            name={active && playback.loading ? 'hourglass' : active && playback.playing ? 'pause' : 'play'}
            size={16}
            color={colors.primaryContrast}
          />
        </PressableScale>

        {/* Live Audio Waveform */}
        <Waveform
          peaks={props.meta?.peaks ?? Array.from({ length: 48 }, () => 0.25)}
          progress={active && playback.duration ? playback.position / playback.duration : 0}
          onSeek={fraction => {
            void (async () => {
              if (playbackSnapshot().id !== props.id) await playVoice(props);
              await seekVoice(props.id, fraction);
            })().catch(() => undefined);
          }}
        />

        {/* Speed button pill */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Change voice playback speed"
          onPress={voiceSpeed}
          style={[styles.speedPill, { backgroundColor: colors.bgElevated, borderRadius: radius.pill }]}
        >
          <Text style={[styles.speedText, { color: colors.textPrimary }]}>
            {playback.speed}×
          </Text>
        </PressableScale>
      </View>

      {/* Meta duration & status row */}
      <View style={styles.metaRow}>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          {active ? `${voiceTime(playback.position * 1000)} / ` : ''}
          {duration ? voiceTime(duration) : 'Voice message'}
          {props.receiver && props.meta?.played_at ? ' · Heard' : ''}
        </Text>

        {active && playback.error && (
          <PressableScale onPress={() => void playVoice(props)}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{playback.error}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 200,
    padding: 10,
    gap: 6,
    marginVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  timeText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

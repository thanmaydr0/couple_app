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
  const { colors, surfaces, radius } = useTheme();
  const playback = useSyncExternalStore(subscribePlayback, playbackSnapshot, playbackSnapshot);
  const active = playback.id === props.id;
  const inverted = props.receiver === false;

  useEffect(() => watchAudioFocus(), []);

  const duration = active ? playback.duration * 1000 : props.meta?.duration_ms ?? 0;

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: radius.md,
          backgroundColor: inverted ? 'rgba(255,255,255,0.12)' : colors.surface,
          borderColor: inverted ? 'rgba(255,255,255,0.18)' : surfaces.rim,
        },
      ]}
    >
      <View style={styles.topRow}>
        <PressableScale
          sheen={false}
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
          style={[
            styles.playBtn,
            {
              backgroundColor: inverted ? colors.bubbleMineText : colors.primary,
              borderRadius: radius.pill,
            },
          ]}
        >
          <Ionicons
            name={active && playback.loading ? 'hourglass' : active && playback.playing ? 'pause' : 'play'}
            size={15}
            color={inverted ? colors.primary : colors.primaryContrast}
          />
        </PressableScale>

        <Waveform
          inverted={inverted}
          peaks={props.meta?.peaks ?? Array.from({ length: 48 }, () => 0.25)}
          progress={active && playback.duration ? playback.position / playback.duration : 0}
          onSeek={fraction => {
            void (async () => {
              if (playbackSnapshot().id !== props.id) await playVoice(props);
              await seekVoice(props.id, fraction);
            })().catch(() => undefined);
          }}
        />

        <PressableScale
          sheen={false}
          accessibilityRole="button"
          accessibilityLabel="Change voice playback speed"
          onPress={voiceSpeed}
          style={[
            styles.speedPill,
            {
              backgroundColor: inverted ? 'rgba(255,255,255,0.18)' : colors.surfaceAlt,
              borderRadius: radius.pill,
            },
          ]}
        >
          <Text
            style={[
              styles.speedText,
              { color: inverted ? colors.bubbleMineText : colors.textPrimary },
            ]}
          >
            {playback.speed}×
          </Text>
        </PressableScale>
      </View>

      <View style={styles.metaRow}>
        <Text
          style={[
            styles.timeText,
            { color: inverted ? colors.bubbleMineText : colors.textSecondary },
          ]}
        >
          {active ? `${voiceTime(playback.position * 1000)} / ` : ''}
          {duration ? voiceTime(duration) : 'Voice message'}
          {props.receiver && props.meta?.played_at ? ' · Heard' : ''}
        </Text>

        {active && playback.error && (
          <PressableScale sheen={false} onPress={() => void playVoice(props)} style={{ minHeight: 24, minWidth: 24 }}>
            <Text style={[styles.errorText, { color: inverted ? colors.bubbleMineText : colors.danger }]}>
              {playback.error}
            </Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 210,
    padding: 9,
    gap: 5,
    marginVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 34,
    height: 34,
    minWidth: 34,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedPill: {
    minWidth: 34,
    minHeight: 24,
    paddingHorizontal: 7,
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
    opacity: 0.85,
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

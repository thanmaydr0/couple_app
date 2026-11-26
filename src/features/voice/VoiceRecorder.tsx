import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { PressableScale, useMotion } from '@/motion';
import { useCalls } from '@/features/calls/engine';
import { claimRecording } from './playback';
import { recordingFocus } from './recordingFocus';
import { Waveform } from './Waveform';
import { voiceLimits, voicePeaks, voiceTime, type VoiceRecording } from './types';

export function VoiceRecorder({
  onRecorded,
  disabled = false,
  onBusyChange,
}: {
  onRecorded: (recording: VoiceRecording) => Promise<void> | void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { colors, surfaces, spacing, typography, geometry, radius } = useTheme();
  const motion = useMotion();
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 48000,
    isMeteringEnabled: true,
    android: { outputFormat: 'mpeg4', audioEncoder: 'aac', maxFileSize: voiceLimits.maxBytes },
  });
  const status = useAudioRecorderState(recorder, voiceLimits.sampleMs);
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'recording' | 'locked' | 'saving'>('idle');
  const [inputName, setInputName] = useState('');
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState<VoiceRecording | null>(null);
  const mode = useRef(phase);
  const held = useRef(false);
  const samples = useRef<number[]>([]);
  const elapsed = useRef(0);
  const cancelled = useSharedValue(0);
  const mounted = useRef(true);
  const callback = useRef(onRecorded);
  callback.current = onRecorded;
  const releaseFocus = useRef<(() => void) | undefined>(undefined);

  const change = (next: typeof phase) => {
    mode.current = next;
    if (mounted.current) setPhase(next);
  };
  const haptic = () => {
    if (motion.level === 'full') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  };

  const finish = async (cancel = false) => {
    if (!['recording', 'locked'].includes(mode.current)) return;
    change('saving');
    haptic();
    try {
      const nativeStatus = recorder.getStatus();
      const duration = Math.max(elapsed.current, nativeStatus.durationMillis);
      if (nativeStatus.canRecord) await recorder.stop();
      releaseFocus.current?.();
      releaseFocus.current = undefined;
      claimRecording(false);
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording was saved. Please try again.');
      if (cancel || duration < voiceLimits.minMs) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        if (cancel) {
          cancelled.value = 1;
          cancelled.value = withTiming(0, { duration: motion.duration('slow') });
        }
      } else {
        const result = {
          uri,
          meta: { duration_ms: Math.min(duration, voiceLimits.maxMs), peaks: voicePeaks(samples.current) },
        };
        setDraft(result);
        await callback.current(result);
        setDraft(null);
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      }
    } catch (cause: unknown) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not save voice. Retry below.');
    } finally {
      releaseFocus.current?.();
      releaseFocus.current = undefined;
      claimRecording(false);
      change('idle');
      onBusyChange?.(false);
    }
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const start = async (lock = false) => {
    if (disabled || mode.current !== 'idle' || draft || useCalls.getState().phase !== 'idle') return;
    change('preparing');
    onBusyChange?.(true);
    setError('');
    samples.current = [];
    elapsed.current = 0;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setDenied(true);
        throw new Error('Microphone access is needed. Allow it in Android Settings, then try again.');
      }
      setDenied(false);
      if ((!held.current && !lock) || AppState.currentState !== 'active' || !mounted.current) {
        change('idle');
        onBusyChange?.(false);
        return;
      }
      claimRecording(true);
      await setAudioModeAsync({
        allowsRecording: true,
        interruptionMode: 'doNotMix',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync();
      const inputs = recorder.getAvailableInputs();
      const headset =
        inputs.find(input => /bluetooth/i.test(input.type)) ?? inputs.find(input => /wired/i.test(input.type));
      if (headset) {
        let permitted = true;
        if (/bluetooth/i.test(headset.type) && Platform.OS === 'android' && Number(Platform.Version) >= 31) {
          permitted =
            (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)) ===
            PermissionsAndroid.RESULTS.GRANTED;
        }
        if (permitted) {
          try {
            recorder.setInput(headset.uid);
            setInputName(headset.name);
          } catch {
            setInputName('Phone microphone');
          }
        } else {
          setInputName('Phone microphone');
        }
      } else {
        setInputName('Phone microphone');
      }
      if ((!held.current && !lock) || AppState.currentState !== 'active' || useCalls.getState().phase !== 'idle' || !mounted.current) {
        await recorder.stop();
        claimRecording(false);
        change('idle');
        onBusyChange?.(false);
        return;
      }
      releaseFocus.current = recordingFocus(() => {
        void finishRef.current();
      });
      recorder.record({ forDuration: voiceLimits.maxMs / 1000 });
      change(lock ? 'locked' : 'recording');
      haptic();
    } catch (cause: unknown) {
      releaseFocus.current?.();
      releaseFocus.current = undefined;
      claimRecording(false);
      change('idle');
      onBusyChange?.(false);
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Microphone unavailable. Try again.');
    }
  };

  useEffect(() => {
    if (!['recording', 'locked'].includes(mode.current)) return;
    elapsed.current = Math.max(elapsed.current, status.durationMillis);
    if (status.metering !== undefined) samples.current.push(Math.min(1, Math.pow(10, status.metering / 20)));
    if (
      status.durationMillis >= voiceLimits.maxMs ||
      status.mediaServicesDidReset ||
      (!status.isRecording && elapsed.current > 0)
    ) {
      void finishRef.current();
    }
  }, [status.durationMillis, status.metering, status.isRecording, status.mediaServicesDidReset]);

  useEffect(() => {
    mounted.current = true;
    const app = AppState.addEventListener('change', value => {
      if (value !== 'active') {
        held.current = false;
        void finishRef.current(mode.current !== 'locked');
      }
    });
    const calls = useCalls.subscribe(value => {
      if (value.phase !== 'idle') {
        held.current = false;
        void finishRef.current();
      }
    });
    return () => {
      mounted.current = false;
      held.current = false;
      app.remove();
      calls();
      releaseFocus.current?.();
      if (['recording', 'locked'].includes(mode.current)) {
        void recorder.stop().catch(() => undefined).finally(() => claimRecording(false));
      }
    };
  }, [recorder]);

  const trashStyle = useAnimatedStyle(() => ({
    opacity: cancelled.value,
    transform: [{ translateY: motion.level === 'full' ? -cancelled.value * spacing.md : 0 }],
  }));

  const holdGesture = Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .enabled(!disabled && !draft && phase !== 'saving')
    .onBegin(() => {
      held.current = true;
      void start();
    })
    .onUpdate(event => {
      if (mode.current !== 'recording') return;
      if (event.translationX < -geometry.touch * 1.5) {
        held.current = false;
        void finish(true);
      } else if (event.translationY < -geometry.touch * 1.5) {
        change('locked');
        haptic();
      }
    })
    .onFinalize(() => {
      held.current = false;
      if (mode.current === 'recording') void finish();
    });

  const active = phase !== 'idle';

  return (
    <View style={[styles.wrap, active && { flex: 1 }]}>
      {active && (
        <View style={styles.recordingStrip}>
          <View style={styles.statusRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.timerText, { ...typography.label, color: colors.textPrimary }]}>
              {phase === 'preparing'
                ? 'Starting mic…'
                : phase === 'saving'
                ? 'Sending…'
                : voiceTime(status.durationMillis)}
            </Text>
            <Text style={[styles.hintText, { ...typography.caption, color: colors.textSecondary }]} numberOfLines={1}>
              {phase === 'locked' ? `Locked · ${inputName}` : '← cancel  ·  ↑ lock'}
            </Text>
          </View>
          <Waveform peaks={voicePeaks(samples.current.slice(-voiceLimits.bars))} progress={1} />
        </View>
      )}

      {phase === 'locked' ? (
        <View style={styles.lockedActions}>
          <PressableScale
            sheen={false}
            onPress={() => void finish(true)}
            accessibilityLabel="Discard voice recording"
            style={[styles.circleBtn, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </PressableScale>
          <PressableScale
            onPress={() => void finish()}
            accessibilityLabel="Send voice recording"
            style={[styles.circleBtn, { backgroundColor: colors.primary, borderRadius: radius.pill }]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.primaryContrast} />
          </PressableScale>
        </View>
      ) : (
        <GestureDetector gesture={holdGesture}>
          <PressableScale
            sheen={false}
            disabled={disabled || phase === 'saving' || !!draft}
            haptic={false}
            accessibilityRole="button"
            accessibilityLabel="Hold to record voice. Slide left to discard, up to lock"
            accessibilityActions={[{ name: 'activate', label: 'Record hands-free' }]}
            onAccessibilityAction={() => void start(true)}
            style={[
              styles.micBtn,
              {
                backgroundColor: active ? colors.primary : surfaces.softPrimary,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Ionicons
              name={active ? 'mic' : 'mic-outline'}
              size={20}
              color={active ? colors.primaryContrast : colors.primary}
            />
          </PressableScale>
        </GestureDetector>
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.discardBadge,
          { backgroundColor: colors.bgElevated, borderRadius: radius.pill, borderColor: surfaces.rimStrong },
          trashStyle,
        ]}
      >
        <Ionicons name="trash-outline" size={14} color={colors.danger} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>Discarded</Text>
      </Animated.View>

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: colors.danger }]}>
          {error}
        </Text>
      )}
      {denied && (
        <PressableScale sheen={false} onPress={() => void Linking.openSettings()} style={{ minHeight: 28 }}>
          <Text style={[typography.caption, { color: colors.primary }]}>Open microphone settings</Text>
        </PressableScale>
      )}
      {draft && (
        <View style={styles.lockedActions}>
          <PressableScale
            sheen={false}
            onPress={() => {
              change('saving');
              void Promise.resolve(callback.current(draft))
                .then(async () => {
                  setDraft(null);
                  setError('');
                  await FileSystem.deleteAsync(draft.uri, { idempotent: true });
                })
                .catch(() => setError('Unavailable. Recording kept.'))
                .finally(() => change('idle'));
            }}
            disabled={phase === 'saving'}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>Retry</Text>
          </PressableScale>
          <PressableScale
            sheen={false}
            disabled={phase === 'saving'}
            onPress={() => {
              void FileSystem.deleteAsync(draft.uri, { idempotent: true });
              setDraft(null);
              setError('');
            }}
          >
            <Text style={[typography.caption, { color: colors.danger }]}>Discard</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingStrip: {
    flex: 1,
    gap: 2,
    paddingLeft: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerText: {
    fontVariant: ['tabular-nums'],
  },
  hintText: {
    flex: 1,
  },
  lockedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  micBtn: {
    width: 40,
    height: 40,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtn: {
    width: 38,
    height: 38,
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBadge: {
    position: 'absolute',
    right: 0,
    bottom: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform, Text, View } from 'react-native';
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

export function VoiceRecorder({ onRecorded, disabled = false, onBusyChange }: { onRecorded: (recording: VoiceRecording) => Promise<void> | void; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { colors, spacing, typography, geometry } = useTheme(); const motion = useMotion();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document', sampleRate: 24000, numberOfChannels: 1, bitRate: 48000, isMeteringEnabled: true, android: { outputFormat: 'mpeg4', audioEncoder: 'aac', maxFileSize: voiceLimits.maxBytes } });
  const status = useAudioRecorderState(recorder, voiceLimits.sampleMs);
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'recording' | 'locked' | 'saving'>('idle');
  const [inputName, setInputName] = useState('');
  const [error, setError] = useState(''); const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState<VoiceRecording | null>(null);
  const mode = useRef(phase); const held = useRef(false); const samples = useRef<number[]>([]); const elapsed = useRef(0);
  const cancelled = useSharedValue(0); const mounted = useRef(true);
  const callback = useRef(onRecorded); callback.current = onRecorded;
  const releaseFocus = useRef<(() => void) | undefined>(undefined);
  const change = (next: typeof phase) => { mode.current = next; if (mounted.current) setPhase(next); };
  const haptic = () => { if (motion.level === 'full') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); };
  const finish = async (cancel = false) => {
    if (!['recording', 'locked'].includes(mode.current)) return;
    change('saving'); haptic();
    try {
      const nativeStatus = recorder.getStatus();
      const duration = Math.max(elapsed.current, nativeStatus.durationMillis);
      if (nativeStatus.canRecord) await recorder.stop();
      releaseFocus.current?.(); releaseFocus.current = undefined;
      claimRecording(false);
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording was saved. Please try again.');
      if (cancel || duration < voiceLimits.minMs) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        if (cancel) { cancelled.value = 1; cancelled.value = withTiming(0, { duration: motion.duration('slow') }); }
      } else {
        const result = { uri, meta: { duration_ms: Math.min(duration, voiceLimits.maxMs), peaks: voicePeaks(samples.current) } };
        setDraft(result);
        await callback.current(result);
        setDraft(null);
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      }
    } catch (cause: unknown) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not save voice. Retry below.'); }
    finally { releaseFocus.current?.(); releaseFocus.current = undefined; claimRecording(false); change('idle'); onBusyChange?.(false); }
  };
  const finishRef = useRef(finish); finishRef.current = finish;
  const start = async (lock = false) => {
    if (disabled || mode.current !== 'idle' || draft || useCalls.getState().phase !== 'idle') return;
    change('preparing'); onBusyChange?.(true); setError(''); samples.current = []; elapsed.current = 0;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { setDenied(true); throw new Error('Microphone access is needed. Allow it in Android Settings, then try again.'); }
      setDenied(false);
      if ((!held.current && !lock) || AppState.currentState !== 'active' || !mounted.current) { change('idle'); onBusyChange?.(false); return; }
      claimRecording(true);
      await setAudioModeAsync({ allowsRecording: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false, shouldRouteThroughEarpiece: false });
      await recorder.prepareToRecordAsync();
      // Ask for nearby-device access only when a paired headset is offered.
      const inputs = recorder.getAvailableInputs();
      const headset = inputs.find(input => /bluetooth/i.test(input.type)) ?? inputs.find(input => /wired/i.test(input.type));
      if (headset) {
        let permitted = true;
        if (/bluetooth/i.test(headset.type) && Platform.OS === 'android' && Number(Platform.Version) >= 31) permitted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) === PermissionsAndroid.RESULTS.GRANTED;
        if (permitted) { try { recorder.setInput(headset.uid); setInputName(headset.name); } catch { setInputName('Phone microphone'); } }
        else setInputName('Phone microphone');
      } else setInputName('Phone microphone');
      if ((!held.current && !lock) || AppState.currentState !== 'active' || useCalls.getState().phase !== 'idle' || !mounted.current) { await recorder.stop(); claimRecording(false); change('idle'); onBusyChange?.(false); return; }
      releaseFocus.current = recordingFocus(() => { void finishRef.current(); });
      recorder.record({ forDuration: voiceLimits.maxMs / 1000 }); change(lock ? 'locked' : 'recording'); haptic();
    } catch (cause: unknown) { releaseFocus.current?.(); releaseFocus.current = undefined; claimRecording(false); change('idle'); onBusyChange?.(false); if (mounted.current) setError(cause instanceof Error ? cause.message : 'Microphone unavailable. Try again.'); }
  };
  useEffect(() => {
    if (!['recording', 'locked'].includes(mode.current)) return;
    elapsed.current = Math.max(elapsed.current, status.durationMillis);
    if (status.metering !== undefined) samples.current.push(Math.min(1, Math.pow(10, status.metering / 20)));
    if (status.durationMillis >= voiceLimits.maxMs || status.mediaServicesDidReset || (!status.isRecording && elapsed.current > 0)) void finishRef.current();
  }, [status.durationMillis, status.metering, status.isRecording, status.mediaServicesDidReset]);
  useEffect(() => {
    mounted.current = true;
    const app = AppState.addEventListener('change', value => { if (value !== 'active') { held.current = false; void finishRef.current(mode.current !== 'locked'); } });
    const calls = useCalls.subscribe(value => { if (value.phase !== 'idle') { held.current = false; void finishRef.current(); } });
    return () => { mounted.current = false; held.current = false; app.remove(); calls(); releaseFocus.current?.(); if (['recording', 'locked'].includes(mode.current)) { void recorder.stop().catch(() => undefined).finally(() => claimRecording(false)); } };
  }, [recorder]);
  const trashStyle = useAnimatedStyle(() => ({ opacity: cancelled.value, transform: [{ translateY: motion.level === 'full' ? -cancelled.value * spacing.md : 0 }] }));
  const holdGesture = Gesture.Pan().minDistance(0).runOnJS(true).enabled(!disabled && !draft && phase !== 'saving')
    .onBegin(() => { held.current = true; void start(); })
    .onUpdate(event => {
      if (mode.current !== 'recording') return;
      if (event.translationX < -geometry.touch * 1.5) { held.current = false; void finish(true); }
      else if (event.translationY < -geometry.touch * 1.5) { change('locked'); haptic(); }
    })
    .onFinalize((_event, success) => { held.current = false; if (mode.current === 'recording') void finish(!success); });
  const text = { ...typography['body/S'], color: colors.textPrimary };
  return <View style={{ gap: spacing.xs, flexShrink: 1 }}>
    {phase !== 'idle' && <View style={{ gap: spacing.xs }}><Text style={text}>{phase === 'preparing' ? 'Opening microphone…' : phase === 'saving' ? 'Saving voice…' : `${phase === 'locked' ? '🔒' : '●'} ${voiceTime(status.durationMillis)} · ${phase === 'locked' ? `Hands-free · ${inputName}` : '← cancel · ↑ lock'}`}</Text><Waveform peaks={voicePeaks(samples.current.slice(-voiceLimits.bars))} /></View>}
    {phase === 'locked' ? <View style={{ flexDirection: 'row', gap: spacing.sm }}><PressableScale onPress={() => void finish(true)} accessibilityLabel="Discard voice recording"><Text style={text}>Discard</Text></PressableScale><PressableScale onPress={() => void finish()} accessibilityLabel="Send voice recording"><Text style={text}>Send voice</Text></PressableScale></View> : <GestureDetector gesture={holdGesture}><PressableScale disabled={disabled || phase === 'saving' || !!draft} haptic={false} accessibilityRole="button" accessibilityLabel="Hold to record voice. Slide left to discard, up to lock" accessibilityActions={[{ name: 'activate', label: 'Record hands-free' }]} onAccessibilityAction={() => void start(true)} style={{ justifyContent: 'center', alignItems: 'center' }}><Text style={text}>🎙</Text></PressableScale></GestureDetector>}
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: geometry.touch }, trashStyle]}><Text style={text}>🗑 Discarded</Text></Animated.View>
    {!!error && <Text accessibilityLiveRegion="polite" style={{ ...text, color: colors.danger }}>{error}</Text>}
    {denied && <PressableScale onPress={() => void Linking.openSettings()}><Text style={text}>Open microphone settings</Text></PressableScale>}
    {draft && <View style={{ flexDirection: 'row', gap: spacing.sm }}><PressableScale onPress={() => { change('saving'); void Promise.resolve(callback.current(draft)).then(async () => { setDraft(null); setError(''); await FileSystem.deleteAsync(draft.uri, { idempotent: true }); }).catch(() => setError('Still unavailable. Your recording is kept here.')).finally(() => change('idle')); }} disabled={phase === 'saving'}><Text style={text}>Retry saved voice</Text></PressableScale><PressableScale disabled={phase === 'saving'} onPress={() => { void FileSystem.deleteAsync(draft.uri, { idempotent: true }); setDraft(null); setError(''); }}><Text style={text}>Discard saved voice</Text></PressableScale></View>}
  </View>;
}

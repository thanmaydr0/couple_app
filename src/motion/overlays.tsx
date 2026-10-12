import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AccessibilityInfo, Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { PressableScale } from './PressableScale';
import { useMotion } from './useMotion';
import { motionTokens } from './tokens';

export type BottomSheetProps = PropsWithChildren<{ visible: boolean; onClose: () => void; title: string; snapPoints?: readonly number[]; initialSnapIndex?: number }>;
/** Snap points are fractions of the available height (0.1–0.95). Drag handle or use accessible controls. */
export function BottomSheet({ visible, onClose, title, snapPoints = [0.45, 0.85], initialSnapIndex = 0, children }: BottomSheetProps) {
  const { colors, spacing, radius, geometry } = useTheme(); const motion = useMotion(); const insets = useSafeAreaInsets(); const { height } = useWindowDimensions();
  const available = height - insets.top; const points = snapPoints.length ? snapPoints.map(p => available * (1 - Math.max(0.1, Math.min(0.95, p)))).sort((a, b) => b - a) : [available / 2];
  const initial = points[Math.min(points.length - 1, Math.max(0, initialSnapIndex))] ?? available / 2;
  const offset = useSharedValue(available); const start = useSharedValue(0); const opacity = useSharedValue(0);
  useEffect(() => { cancelAnimation(offset); offset.value = motion.level === 'full' ? available : initial; if (visible) offset.value = motion.level === 'full' ? withSpring(initial, motion.spring('gentle')) : initial; opacity.value = withTiming(visible ? 1 : 0, { duration: motion.duration('fast') }); }, [visible, available, initial, motion.level, offset, opacity]);
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const contentHeight = useAnimatedStyle(() => ({ maxHeight: Math.max(0, available - offset.value - geometry.touch * 2 - insets.bottom - spacing.lg) }));
  const backdrop = useAnimatedStyle(() => ({ opacity: opacity.value * (1 - Math.max(0, offset.value - initial) / Math.max(1, available - initial)) }));
  const pan = Gesture.Pan().onBegin(() => { start.value = offset.value; }).onUpdate(e => { offset.value = Math.max(points[points.length - 1] ?? 0, Math.min(available, start.value + e.translationY)); }).onEnd(e => {
    if (offset.value > (points[0] ?? initial) + geometry.touch || e.velocityY > available) { scheduleOnRN(onClose); return; }
    const projected = offset.value + e.velocityY * 0.1;
    let nearest = initial; for (const point of points) if (Math.abs(point - projected) < Math.abs(nearest - projected)) nearest = point;
    offset.value = motion.level === 'full' ? withSpring(nearest, motion.spring('gentle')) : nearest;
  });
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent><View accessibilityViewIsModal style={{ flex: 1 }}><Animated.View style={[{ position: 'absolute', inset: 0, backgroundColor: colors.overlay }, backdrop]}><PressableScale haptic={false} accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={{ flex: 1 }} /></Animated.View><Animated.View style={[{ position: 'absolute', top: insets.top, left: 0, right: 0, height: available, backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }, panel]}><GestureDetector gesture={pan}><View accessible accessibilityRole="adjustable" accessibilityLabel="Sheet height" accessibilityActions={[{ name: 'increment', label: 'Expand' }, { name: 'decrement', label: 'Collapse' }]} onAccessibilityAction={e => { const target = e.nativeEvent.actionName === 'increment' ? points[points.length - 1] : points[0]; offset.value = withTiming(target ?? initial, { duration: motion.duration('fast') }); }} style={{ minHeight: geometry.touch, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: geometry.sheetHandle, height: geometry.sheetHandleHeight, borderRadius: radius.pill, backgroundColor: colors.border }} /></View></GestureDetector><View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Text variant="title/M" accessibilityRole="header" style={{ flex: 1 }}>{title}</Text><IconButton name="close" accessibilityLabel="Close sheet" onPress={onClose} /></View><Animated.ScrollView style={contentHeight} contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }} keyboardShouldPersistTaps="handled">{children}</Animated.ScrollView></Animated.View></View></Modal>;
}
export function Dialog({ visible, title, description, children, onClose, actionLabel = 'Continue', onAction, destructive = false, busy = false }: PropsWithChildren<{ visible: boolean; title: string; description?: string; onClose: () => void; actionLabel?: string; onAction?: () => void; destructive?: boolean; busy?: boolean }>) {
  const { colors, spacing, radius } = useTheme(); const motion = useMotion(); const insets = useSafeAreaInsets(); const progress = useSharedValue(0);
  useEffect(() => { progress.value = 0; if (visible) progress.value = withTiming(1, { duration: motion.duration('base') }); }, [visible, motion.level, progress]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: motion.level === 'full' ? (1 - progress.value) * motionTokens.travel : 0 }] }));
  return <Modal visible={visible} transparent animationType="none" onRequestClose={() => { if (!busy) onClose(); }}><View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingTop: insets.top, paddingBottom: insets.bottom }}><Animated.View style={[{ backgroundColor: colors.bgElevated, borderRadius: radius.sheet, padding: spacing.lg, maxHeight: '100%' }, animated]}><ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled"><Text accessibilityRole="header" variant="title/M">{title}</Text>{description && <Text color="textSecondary">{description}</Text>}{children}<View style={{ gap: spacing.sm }}>{onAction && <Button title={actionLabel} loading={busy} variant={destructive ? 'danger' : 'primary'} onPress={onAction} />}<Button title="Cancel" variant="ghost" disabled={busy} onPress={onClose} /></View></ScrollView></Animated.View></View></Modal>;
}
export type ToastMessage = { message: string; kind?: 'info' | 'success' | 'error'; actionLabel?: string; onAction?: () => void; duration?: number };
type ToastContextValue = { show: (toast: ToastMessage | string) => void; dismiss: () => void };
const ToastContext = createContext<ToastContextValue | null>(null);
export function Toast({ message, kind = 'info', actionLabel, onAction, onDismiss }: ToastMessage & { onDismiss: () => void }) {
  const { colors, spacing, radius } = useTheme(); const motion = useMotion(); const insets = useSafeAreaInsets(); const progress = useSharedValue(0);
  useEffect(() => { progress.value = withTiming(1, { duration: motion.duration('base') }); }, [progress, motion.level]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: motion.level === 'full' ? (1 - progress.value) * motionTokens.travel : 0 }] }));
  return <Animated.View accessibilityLiveRegion="polite" style={[{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.s56, borderRadius: radius.lg, borderWidth: 1, borderColor: kind === 'error' ? colors.danger : kind === 'success' ? colors.success : colors.border, backgroundColor: colors.bgElevated, padding: spacing.md, elevation: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, animated]}><Text style={{ flex: 1 }}>{message}</Text>{actionLabel && onAction && <Button title={actionLabel} variant="ghost" onPress={onAction} />}<IconButton name="close" accessibilityLabel="Dismiss notification" onPress={onDismiss} /></Animated.View>;
}
export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<(ToastMessage & { id: number }) | null>(null); const sequence = useRef(0);
  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.message);
    if (toast.kind === 'error' || toast.onAction || toast.duration === 0) return;
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const duration = toast.duration ?? motionTokens.toast;
    void AccessibilityInfo.getRecommendedTimeoutMillis(duration).then(timeout => { if (active) timer = setTimeout(() => setToast(current => current?.id === toast.id ? null : current), timeout); }).catch(() => { if (active) timer = setTimeout(() => setToast(null), duration); });
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [toast]);
  return <ToastContext.Provider value={{ show: value => setToast({ ...(typeof value === 'string' ? { message: value } : value), id: ++sequence.current }), dismiss: () => setToast(null) }}>{children}{toast && <Toast key={toast.id} {...toast} onDismiss={() => setToast(null)} />}</ToastContext.Provider>;
}
export function useToast() { const context = useContext(ToastContext); if (!context) throw new Error('useToast must be used inside ToastProvider'); return context; }
export function OfflineBanner({ offline = true, message = 'You’re offline. Some saved content is still available.', onRetry }: { offline?: boolean; message?: string; onRetry?: () => void }) {
  const { colors, spacing, radius, geometry } = useTheme(); if (!offline) return null;
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: geometry.hairline, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Ionicons name="cloud-offline-outline" size={geometry.icon} color={colors.textSecondary} /><Text color="textSecondary" style={{ flex: 1 }}>{message}</Text></View>{onRetry && <Button title="Retry" variant="secondary" onPress={onRetry} />}</View>;
}


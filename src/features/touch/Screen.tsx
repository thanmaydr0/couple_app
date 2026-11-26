import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Orientation from 'expo-screen-orientation';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { usePartner, useProfile } from '@/lib/hooks';
import { useTheme } from '@/theme';
import { Burst, PulseRing, PressableScale, useMotion, FadeInView } from '@/motion';
import { Screen, Header, Text, Button, IconButton, ErrorState, Skeleton, Card } from '@/ui';
import { duration } from './protocol';
import { invitePartner, useTouchRoom } from './useTouchRoom';
import { TouchCanvas } from './TouchCanvas';
import type { Intensity } from './types';

export default function TouchScreen() {
  const profile = useProfile();
  const partner = usePartner();
  const router = useRouter();
  const { colors, surfaces, spacing, radius, typography, geometry } = useTheme();
  const motion = useMotion();

  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [intensity, setIntensity] = useState<Intensity>('gentle');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<number>();
  const [burst, setBurst] = useState(0);
  const [retry, setRetry] = useState(false);

  const room = useTouchRoom(
    profile.data?.couple_id ?? undefined,
    profile.data?.id,
    partner.data?.id,
    colors.primary,
    open && !retry,
    intensity,
    motion.level === 'full'
  );

  function leave() {
    room.up();
    setSummary(room.held);
    setBurst(n => n + 1);
    setOpen(false);
  }

  useEffect(() => {
    if (!open || !room.active || room.expired) return;
    let disposed = false;
    let previous: Orientation.OrientationLock | undefined;
    const setup = async () => {
      try {
        previous = await Orientation.getOrientationLockAsync();
        if (disposed) return;
        await Orientation.lockAsync(Orientation.OrientationLock.PORTRAIT_UP);
        if (disposed && previous !== undefined) await Orientation.lockAsync(previous);
      } catch {
        if (!disposed) setNotice('Portrait lock unavailable. Touch positions still adapt to screen size.');
      }
    };
    void setup();
    void activateKeepAwakeAsync('touch-room')
      .then(() => { if (disposed) void deactivateKeepAwake('touch-room'); })
      .catch(() => { if (!disposed) setNotice('Keep-awake unavailable on this device.'); });

    return () => {
      disposed = true;
      void deactivateKeepAwake('touch-room');
      if (previous !== undefined) void Orientation.lockAsync(previous).catch(() => {});
    };
  }, [open, room.active, room.expired]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [open, room.held]);

  useEffect(() => {
    if (!retry) return;
    const timer = setTimeout(() => setRetry(false), motion.duration('fast'));
    return () => clearTimeout(timer);
  }, [retry]);

  async function enter(invite: boolean) {
    if (!profile.data?.id || !partner.data) return;
    setSummary(undefined);
    setNotice('');
    setOpen(true);
    if (invite) {
      setBusy(true);
      try {
        setNotice(await invitePartner(profile.data.id));
      } finally {
        setBusy(false);
      }
    }
  }

  const partnerName = partner.data?.display_name ?? 'Your partner';

  return (
    <Screen atmosphere gradient bottomInset style={styles.container}>
      <Header
        title="Touch Together"
        subtitle={open ? `Connected with ${partnerName}` : 'A hand to hold, wherever you are'}
        onBack={() => (open ? leave() : router.back())}
        right={
          <IconButton
            name="settings-outline"
            accessibilityLabel="Touch settings"
            onPress={() => setSettings(v => !v)}
          />
        }
      />

      {settings && (
        <FadeInView style={[styles.settingsDrawer, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: surfaces.rimStrong }]}>
          <View style={styles.settingsHeader}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text variant="title/S">Haptic Sensation</Text>
          </View>
          <Text variant="body/S" color="textSecondary">
            Simulate a warm pulse when your touches meet.
          </Text>
          <View style={styles.intensityRow}>
            {(['off', 'gentle', 'strong'] as const).map(value => {
              const isSelected = value === intensity;
              return (
                <PressableScale
                  key={value}
                  haptic={false}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setIntensity(value)}
                  style={[
                    styles.intensityPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                      borderRadius: radius.pill,
                    },
                  ]}
                >
                  <Text
                    variant="label"
                    color={isSelected ? 'primaryContrast' : 'textPrimary'}
                  >
                    {value.toUpperCase()} {isSelected && '✓'}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </FadeInView>
      )}

      {notice ? (
        <View style={[styles.noticeBadge, { backgroundColor: surfaces.softPrimary, borderWidth: geometry.hairline, borderColor: surfaces.rim, borderRadius: radius.pill }]}>
          <Text variant="body/S" color="textSecondary" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        </View>
      ) : null}

      {profile.isLoading || partner.isLoading ? (
        <Skeleton />
      ) : profile.isError || partner.isError ? (
        <ErrorState
          title="Couldn’t load your couple"
          onRetry={() => {
            void profile.refetch();
            void partner.refetch();
          }}
        />
      ) : !profile.data?.couple_id || !partner.data ? (
        <Card variant="elevated" style={styles.pairCard}>
          <Ionicons name="heart-dislike-outline" size={36} color={colors.textSecondary} />
          <Text variant="title/M">Pair with your partner</Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            Touch Together requires both partners to be linked. Pair in Settings to hold hands across any distance.
          </Text>
        </Card>
      ) : open ? (
        <View style={styles.activeContainer}>
          {/* Floating HUD status capsule */}
          <View
            style={[
              styles.hudCapsule,
              {
                backgroundColor: surfaces.glassBg,
                borderColor: room.merged ? colors.primary : surfaces.rimStrong,
                borderRadius: radius.pill,
              },
            ]}
          >
            <View
              style={[
                styles.liveIndicator,
                {
                  backgroundColor: room.merged
                    ? colors.primary
                    : room.present
                    ? colors.success
                    : colors.warning,
                },
              ]}
            />
            <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
              {room.merged
                ? `Touching · ${duration(room.held)}`
                : room.present
                ? `${partnerName} is here · Touch screen`
                : 'Waiting for partner…'}
            </Text>
          </View>

          {/* Active Canvas / Pause State */}
          {room.expired ? (
            <Card variant="elevated" style={styles.pauseCard}>
              <Ionicons name="hourglass-outline" size={32} color={colors.primary} />
              <Text variant="title/M">A little pause after 30 minutes</Text>
              <Text color="textSecondary" style={{ textAlign: 'center' }}>
                Your stream was paused to preserve battery and data.
              </Text>
              <View style={styles.pauseActions}>
                <Button title="Continue together" onPress={room.continueRoom} />
                <Button title="End session" variant="secondary" onPress={leave} />
              </View>
            </Card>
          ) : (
            <View style={styles.canvasFrame}>
              <TouchCanvas room={room} />
            </View>
          )}

          {/* Floating footer controls */}
          <View style={styles.bottomToolbar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Leave room"
              onPress={leave}
              style={[styles.floatingActionPill, { backgroundColor: surfaces.glassBg, borderWidth: geometry.hairline, borderColor: surfaces.rimStrong, borderRadius: radius.pill }]}
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
              <Text variant="label" color="textSecondary">Leave</Text>
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Reconnect"
              onPress={() => {
                room.up();
                setRetry(true);
              }}
              style={[styles.floatingActionPill, { backgroundColor: surfaces.glassBg, borderWidth: geometry.hairline, borderColor: surfaces.rimStrong, borderRadius: radius.pill }]}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.primary} />
              <Text variant="label" color="primary">Reconnect</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.lobbyContent, { paddingVertical: spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Ethereal Glow Hero */}
          <View style={styles.heroOrbContainer}>
            <PulseRing size={120}>
              <View
                style={[
                  styles.heroOrb,
                  {
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary,
                  },
                ]}
              >
                <Ionicons name="heart" size={48} color={colors.primaryContrast} />
              </View>
            </PulseRing>
          </View>

          <View style={styles.heroTextContainer}>
            <Text variant="display/M" style={{ textAlign: 'center' }}>
              Meet in the middle.
            </Text>
            <Text variant="body/M" color="textSecondary" style={{ textAlign: 'center', maxWidth: 300 }}>
              Touch the same place on your screens. When your fingertips meet, feel each other across the distance.
            </Text>
          </View>

          {/* Past summary celebration badge */}
          {summary !== undefined && (
            <FadeInView style={[styles.summaryCard, { backgroundColor: surfaces.softPrimary, borderWidth: geometry.hairline, borderColor: surfaces.rim, borderRadius: radius.lg }]}>
              <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
              <Text variant="title/S">
                You held hands for {Math.floor(summary / 60_000)}m {Math.floor(summary / 1000) % 60}s
              </Text>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Burst trigger={burst} />
              </View>
            </FadeInView>
          )}

          {/* Main Action Buttons */}
          <View style={styles.ctaContainer}>
            <Button
              title={`Invite ${partnerName} to Touch`}
              loading={busy}
              onPress={() => { void enter(true); }}
              style={{ width: '100%', paddingVertical: spacing.md }}
            />
            <Button
              title="Enter quietly without notification"
              variant="secondary"
              onPress={() => { void enter(false); }}
              style={{ width: '100%' }}
            />
          </View>

          <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>
            End-to-end encrypted · Nothing is saved · Tap anywhere to spark
          </Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  settingsDrawer: {
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  intensityPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 8,
  },
  pairCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    marginVertical: 40,
  },
  activeContainer: {
    flex: 1,
    position: 'relative',
  },
  hudCapsule: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  canvasFrame: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  pauseCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  pauseActions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  bottomToolbar: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  floatingActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lobbyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  heroOrbContainer: {
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOrb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  heroTextContainer: {
    gap: 10,
    alignItems: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  ctaContainer: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
    marginTop: 8,
  },
});

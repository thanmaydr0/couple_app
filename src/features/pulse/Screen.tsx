import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, View, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Card, Text, Button, ErrorState, EmptyState, IconButton } from '@/ui';
import { FadeInView, PressableScale } from '@/motion';
import { useTheme } from '@/theme';
import { usePulse } from './usePulse';
import { questionFor, streak } from './calendar';
import { pulseDb, notifyPulse } from './service';
import { StatusCard } from './StatusCard';
import { HeartButton } from './HeartButton';
import { TheirDay } from './TheirDay';

export default function PulseScreen() {
  const pulse = usePulse();
  const { spacing, radius, colors, surfaces, geometry, typography } = useTheme();
  const client = useQueryClient();

  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState(false);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(20);

  useEffect(() => {
    setDraft('');
    setNotice('');
  }, [pulse.day, pulse.userId]);

  useEffect(() => {
    if (!history) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setHistory(false);
      return true;
    });
    return () => sub.remove();
  }, [history]);

  const answers = pulse.data?.answers ?? [];
  const today = answers.filter(a => a.day === pulse.day);
  const mine = today.find(a => a.user_id === pulse.userId);
  const theirs = today.find(a => a.user_id !== pulse.userId);
  const completedDays = [...new Set(answers.map(a => a.day))].filter(
    day => new Set(answers.filter(a => a.day === day).map(a => a.user_id)).size >= 2
  );
  const days = [...new Set(answers.filter(a => a.day < pulse.day).map(a => a.day))];

  const submit = useMutation({
    mutationFn: async () => {
      if (!pulse.userId || !pulse.coupleId || !draft.trim()) {
        throw new Error('Write an answer first.');
      }
      const day = pulse.day;
      const { error } = await pulseDb.from('pulse_answers').insert({
        couple_id: pulse.coupleId,
        user_id: pulse.userId,
        day,
        answer: draft.trim(),
      });
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ['pulse'] });
      setDraft('');
      try {
        await notifyPulse(
          `pulse:answer:${pulse.coupleId}:${pulse.userId}:${day}`,
          "They answered today's question — your turn!",
          24 * 60 * 60_000
        );
      } catch {
        setNotice('Answer saved. The notification could not be delivered.');
      }
    },
  });

  const streakCount = streak(completedDays, pulse.day);
  const thoughtsCount = pulse.data?.thoughts ?? 0;

  return (
    <Screen atmosphere gradient bottomInset>
      <Header
        title={history ? 'Our daily pages' : 'Pulse'}
        subtitle="One small moment, just for us"
        onBack={() => (history ? setHistory(false) : router.back())}
        right={
          !history ? (
            <IconButton
              name="book-outline"
              accessibilityLabel="View question history"
              onPress={() => setHistory(true)}
            />
          ) : undefined
        }
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { gap: spacing.lg, paddingBottom: spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {pulse.offline && (
          <View style={[styles.offlineBanner, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
              Offline · showing saved information. Reconnect to send.
            </Text>
          </View>
        )}

        {pulse.profileError || (pulse.error && !pulse.data) ? (
          <ErrorState
            description="Pulse could not load. Check your connection and try again."
            onRetry={() => {
              void pulse.refetch();
              void client.invalidateQueries({ queryKey: ['profile'] });
              void client.invalidateQueries({ queryKey: ['couple'] });
            }}
          />
        ) : pulse.profileLoading ? (
          <Text accessibilityRole="progressbar">Loading your couple…</Text>
        ) : !pulse.coupleId ? (
          <EmptyState
            title="A moment for two"
            description="Link your couple in Settings to start Pulse."
            actionLabel="Open Settings"
            onAction={() => router.push('/settings')}
          />
        ) : pulse.isPending ? (
          <Text accessibilityRole="progressbar">
            {pulse.offline ? 'No saved Pulse yet. Reconnect to load it.' : 'Opening your daily pages…'}
          </Text>
        ) : (
          <>
            {pulse.error && (
              <ErrorState
                description="Showing saved Pulse. The latest update could not load."
                onRetry={() => { void pulse.refetch(); }}
              />
            )}

            {/* Streak & Thought Capsule Bar */}
            <View style={styles.metricsBar}>
              <View style={[styles.metricPill, { backgroundColor: surfaces.softPrimary, borderRadius: radius.pill, borderColor: surfaces.rim }]}>
                <Ionicons name="flame-outline" size={16} color={colors.primary} />
                <Text variant="label">{streakCount} day streak</Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: surfaces.softPrimary, borderRadius: radius.pill, borderColor: surfaces.rim }]}>
                <Ionicons name="heart" size={16} color={colors.primary} />
                <Text variant="label">{thoughtsCount} thoughts today</Text>
              </View>
            </View>

            {history ? (
              <>
                {days.length === 0 && (
                  <EmptyState
                    title="Your story starts today"
                    description="Past questions and answers will appear here as you answer each day."
                  />
                )}
                {days.slice(0, page).map(day => (
                  <Card key={day} variant="elevated" style={{ gap: spacing.md }}>
                    <View style={styles.historyCardHeader}>
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                      <Text variant="caption" color="textSecondary">{day}</Text>
                    </View>
                    <Text variant="title/S">{questionFor(day)}</Text>
                    {answers.filter(a => a.day === day).map(a => (
                      <View key={a.id} style={[styles.answerBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
                        <Text variant="label" color="primary">{a.user_id === pulse.userId ? 'You' : 'Them'}</Text>
                        <Text variant="body/M">{a.answer}</Text>
                      </View>
                    ))}
                    {answers.filter(a => a.day === day).length < 2 && (
                      <Text variant="caption" color="textSecondary">One of you left this page unwritten.</Text>
                    )}
                  </Card>
                ))}
                {days.length > page && (
                  <Button title="Older pages" variant="secondary" onPress={() => setPage(p => p + 20)} />
                )}
              </>
            ) : (
              <>
                {/* Wax-sealed Today's Question Card */}
                <Card variant="elevated" style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <View style={[styles.dayPill, { backgroundColor: surfaces.softPrimary, borderWidth: geometry.hairline, borderColor: surfaces.rim, borderRadius: radius.pill }]}>
                      <Text variant="caption" color="primary">TODAY</Text>
                    </View>
                    <Text variant="caption" color="textSecondary">{pulse.day}</Text>
                  </View>

                  <Text variant="title/L" style={styles.questionText}>
                    "{questionFor(pulse.day)}"
                  </Text>

                  {mine && theirs ? (
                    <View accessibilityLiveRegion="polite" style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                      {[mine, theirs].map((a, index) => (
                        <FadeInView key={a.id}>
                          <View
                            style={[
                              styles.revealedAnswer,
                              {
                                backgroundColor: index === 0 ? surfaces.softPrimary : colors.bgElevated,
                                borderRadius: radius.md,
                                borderColor: surfaces.rim,
                              },
                            ]}
                          >
                            <Text variant="label" color={index === 0 ? 'primary' : 'textSecondary'}>
                              {index === 0 ? 'Your Answer' : 'Their Answer'}
                            </Text>
                            <Text variant="body/M" style={{ marginTop: 4 }}>
                              {a.answer}
                            </Text>
                          </View>
                        </FadeInView>
                      ))}
                    </View>
                  ) : mine ? (
                    <View style={[styles.pendingEnvelope, { backgroundColor: surfaces.softPrimary, borderWidth: geometry.hairline, borderColor: surfaces.rim, borderRadius: radius.lg }]}>
                      <View style={{ width: spacing.s40, height: spacing.s40, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="mail-outline" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text variant="label">Your answer is sealed</Text>
                        <Text variant="body/S" color="textSecondary">
                          "{mine.answer}"
                        </Text>
                        <Text variant="caption" color="primary" style={{ marginTop: 4 }}>
                          Waiting for your partner · Envelope unseals when both answer
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ gap: spacing.md }}>
                      <Text variant="body/S" color="textSecondary">
                        Your answer stays privately sealed until you both answer.
                      </Text>

                      <TextInput
                        key={pulse.day}
                        accessibilityLabel="Your answer to today's question"
                        multiline
                        maxLength={2000}
                        value={draft}
                        onChangeText={setDraft}
                        editable={!pulse.offline && !submit.isPending}
                        placeholder="A little honesty goes a long way…"
                        placeholderTextColor={colors.textMuted}
                        style={[
                          styles.answerInput,
                          {
                            ...typography['body/M'],
                            color: colors.textPrimary,
                            backgroundColor: colors.bgElevated,
                            borderWidth: geometry.hairline,
                            borderColor: surfaces.rimStrong,
                            borderRadius: radius.md,
                            minHeight: geometry.touch * 2.2,
                          },
                        ]}
                      />

                      <Button
                        title="Seal my answer with love"
                        loading={submit.isPending}
                        disabled={pulse.offline || !draft.trim()}
                        onPress={() => {
                          setNotice('');
                          submit.mutate();
                        }}
                      />

                      <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
                        Answers cannot be edited once sealed.
                      </Text>

                      {submit.isError && (
                        <Text color="danger" variant="body/S" style={{ textAlign: 'center' }}>
                          Could not seal your answer. Please refresh and retry.
                        </Text>
                      )}
                    </View>
                  )}

                  {notice ? (
                    <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
                      {notice}
                    </Text>
                  ) : null}
                </Card>

                {/* Status / Mood Check-in Card */}
                <StatusCard
                  own={pulse.data?.statuses.find(s => s.user_id === pulse.userId)}
                  partner={pulse.data?.statuses.find(s => s.user_id !== pulse.userId)}
                  offline={pulse.offline}
                />

                {/* Thinking of you & Heartbeat Section */}
                <Card variant="elevated" style={{ gap: spacing.md, alignItems: 'center' }}>
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text variant="title/M">Thinking of you</Text>
                    <Text variant="body/S" color="textSecondary">
                      Tap to send a gentle pulse · hold for a sustained heartbeat
                    </Text>
                  </View>
                  <HeartButton disabled={pulse.offline} />
                </Card>

                {/* Weather & Time Difference */}
                <TheirDay now={pulse.now} offline={pulse.offline} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  metricsBar: {
    flexDirection: 'row',
    gap: 12,
  },
  metricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  questionCard: {
    gap: 16,
    padding: 20,
    borderWidth: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  questionText: {
    lineHeight: 28,
  },
  answerInput: {
    padding: 14,
    textAlignVertical: 'top',
  },
  revealedAnswer: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pendingEnvelope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  answerBox: {
    padding: 12,
    gap: 4,
  },
});

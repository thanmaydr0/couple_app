import { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { PressableScale, HeartbeatView } from '@/motion';
import { Card, Text, Button } from '@/ui';
import { moods, moodEmoji, availabilities, type Mood, type Availability, type Status } from './types';
import { setStatus } from './service';

export function StatusCard({
  own,
  partner,
  offline,
}: {
  own?: Status;
  partner?: Status;
  offline: boolean;
}) {
  const { spacing, radius, colors, surfaces, geometry, typography } = useTheme();
  const client = useQueryClient();

  const [mood, setMood] = useState<Mood>(own?.mood ?? 'calm');
  const [availability, setAvailable] = useState<Availability>(own?.availability ?? 'free');
  const [note, setNote] = useState(own?.note ?? '');

  useEffect(() => {
    if (own) {
      setMood(own.mood);
      setAvailable(own.availability);
      setNote(own.note ?? '');
    }
  }, [own?.updated_at]);

  const save = useMutation({
    mutationFn: ({ m, a, n }: { m: Mood; a: Availability; n: string }) => setStatus(m, a, n),
    onSuccess: () => client.invalidateQueries({ queryKey: ['pulse'] }),
  });

  const busy = offline || save.isPending;

  return (
    <Card variant="elevated" style={[styles.card, { gap: spacing.md }]}>
      {/* Partner Status Display */}
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={18} color={colors.primary} />
        <Text variant="title/M">How are you, really?</Text>
      </View>

      {partner ? (
        <View style={[styles.partnerBanner, { backgroundColor: surfaces.softPrimary, borderWidth: geometry.hairline, borderColor: surfaces.rim, borderRadius: radius.md }]}>
          <Text style={{ fontSize: 24 }}>{moodEmoji[moods.indexOf(partner.mood)]}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="label">Partner is {partner.mood}</Text>
              <Text variant="caption" color="textSecondary">· {partner.availability}</Text>
            </View>
            {partner.note ? (
              <Text variant="body/S" color="textPrimary">"{partner.note}"</Text>
            ) : null}
            <Text variant="caption" color="textSecondary">
              Updated {new Date(partner.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.partnerBanner, { backgroundColor: surfaces.divider, borderRadius: radius.md }]}>
          <Text variant="body/S" color="textSecondary">Partner hasn't checked in yet today.</Text>
        </View>
      )}

      {/* Mood Selector */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color="textSecondary">YOUR MOOD</Text>
        <View style={styles.moodGrid}>
          {moods.map((m, i) => {
            const isSelected = mood === m;
            return (
              <PressableScale
                key={m}
                accessibilityRole="button"
                accessibilityLabel={`Feeling ${m}`}
                accessibilityState={{ selected: isSelected }}
                disabled={busy}
                onPress={() => {
                  setMood(m);
                  save.mutate({ m, a: availability, n: note });
                }}
                style={[
                  styles.moodPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                    borderRadius: radius.pill,
                  },
                ]}
              >
                <Text style={{ fontSize: 16 }}>{moodEmoji[i]}</Text>
                <Text
                  variant="label"
                  color={isSelected ? 'primaryContrast' : 'textPrimary'}
                >
                  {m}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Availability Selector */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color="textSecondary">AVAILABILITY</Text>
        <View style={styles.availabilityRow}>
          {availabilities.map(a => {
            const isSelected = availability === a;
            return (
              <PressableScale
                key={a}
                accessibilityRole="button"
                accessibilityLabel={a}
                accessibilityState={{ selected: isSelected }}
                disabled={busy}
                onPress={() => {
                  setAvailable(a);
                  save.mutate({ m: mood, a, n: note });
                }}
                style={[
                  styles.availabilityPill,
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
                  {a.toUpperCase()}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Note input & Save button */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color="textSecondary">NOTE TO PARTNER</Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Optional status note"
            placeholder="Anything you want them to know?"
            placeholderTextColor={colors.textMuted}
            value={note}
            maxLength={240}
            editable={!busy}
            onChangeText={setNote}
            style={[
              styles.noteInput,
              {
                ...typography['body/M'],
                color: colors.textPrimary,
                backgroundColor: colors.bgElevated,
                borderWidth: geometry.hairline,
                borderColor: surfaces.rimStrong,
                borderRadius: radius.md,
              },
            ]}
          />
          <Button
            title="Save"
            loading={save.isPending}
            disabled={offline}
            onPress={() => save.mutate({ m: mood, a: availability, n: note })}
          />
        </View>
      </View>

      {save.isError && (
        <Text color="danger" variant="caption">
          Could not save check-in. Your draft is still here; try again.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  availabilityPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  noteInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});

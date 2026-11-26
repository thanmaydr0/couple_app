import { useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, router } from 'expo-router';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, ErrorState, Header, PressableScale, Screen, Text, IconButton } from '@/ui';
import { useTheme } from '@/theme';
import { Burst, FadeInView, ParallaxHeader, Skeleton } from '@/motion';
import { useStory } from './useStory';
import { SettingsSection } from './HomeCard';
import { MemoryImage } from './MemoryImage';
import { Wrapped } from './Wrapped';
import type { Entry, StoryFilter } from './types';

type Row = { type: 'chapter'; id: string; title: string } | { type: 'memory'; id: string; entry: Entry };

const filters: { id: StoryFilter; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', title: 'All', icon: 'infinite-outline' },
  { id: 'media', title: 'Memories', icon: 'images-outline' },
  { id: 'milestone', title: 'Milestones', icon: 'trophy-outline' },
  { id: 'list', title: 'Dreams', icon: 'checkbox-outline' },
  { id: 'capsule', title: 'Capsules', icon: 'hourglass-outline' },
  { id: 'event', title: 'Dates', icon: 'calendar-outline' },
  { id: 'game', title: 'Play', icon: 'game-controller-outline' },
];

function kindIcon(kind: string): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'milestone': return 'trophy';
    case 'media': return 'image';
    case 'list': return 'checkmark-circle';
    case 'capsule': return 'hourglass';
    case 'event': return 'calendar';
    case 'game': return 'game-controller';
    default: return 'heart';
  }
}

function MemoryCard({ entry, timezone }: { entry: Entry; timezone: string }) {
  const { spacing, geometry, colors, surfaces, radius } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(0);

  const isMilestone = entry.kind === 'milestone';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}. ${expanded ? 'Collapse' : 'Expand'} memory`}
      accessibilityState={{ expanded }}
      onPress={() => {
        setExpanded(p => !p);
        if (isMilestone) setBurst(n => n + 1);
      }}
      style={{ minHeight: geometry.touch, width: '100%' }}
    >
      <Card
        variant="elevated"
        style={[
          styles.memoryCard,
          {
            borderColor: isMilestone ? colors.primary : surfaces.rimStrong,
            borderWidth: isMilestone ? 1.5 : geometry.hairline,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.kindPill,
              {
                backgroundColor: isMilestone ? colors.primary : surfaces.softPrimary,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Ionicons
              name={kindIcon(entry.kind)}
              size={12}
              color={isMilestone ? colors.primaryContrast : colors.primary}
            />
            <Text
              variant="caption"
              color={isMilestone ? 'primaryContrast' : 'primary'}
              style={{ textTransform: 'uppercase', fontWeight: '600' }}
            >
              {entry.kind}
            </Text>
          </View>
          <Text variant="caption" color="textSecondary">
            {new Date(entry.at).toLocaleDateString(undefined, {
              timeZone: timezone,
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>

        <Text variant="title/S" style={{ marginTop: 2 }}>{entry.title}</Text>

        {expanded && (
          <FadeInView style={{ gap: spacing.sm, marginTop: 4 }}>
            {entry.detail && (
              <Text color="textSecondary" variant="body/M">
                {entry.detail.includes('-') && entry.kind === 'game' ? 'A shared victory' : entry.detail}
              </Text>
            )}
            {entry.path && (
              <View style={[styles.imageContainer, { borderRadius: radius.md, overflow: 'hidden' }]}>
                <MemoryImage path={entry.path} />
              </View>
            )}
          </FadeInView>
        )}

        <View style={styles.expandRow}>
          <Text variant="caption" color="textSecondary">
            {expanded ? 'Show less' : 'Open this moment'}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textSecondary}
          />
        </View>

        {isMilestone && burst > 0 && (
          <View pointerEvents="none" style={styles.burstContainer}>
            <Burst trigger={burst} />
          </View>
        )}
      </Card>
    </PressableScale>
  );
}

export default function StoryScreen() {
  const params = useLocalSearchParams<{ wrapped?: string }>();
  const [filter, setFilter] = useState<StoryFilter>('all');
  const story = useStory(filter);
  const currentYear = Number(story.day.slice(0, 4));
  const requested = Number(params.wrapped);
  const [wrappedYear, setWrappedYear] = useState<number | undefined>(
    Number.isInteger(requested) && requested >= 1900 && requested <= currentYear ? requested : undefined
  );
  const [year, setYear] = useState(currentYear);
  const { spacing, geometry, colors, surfaces, radius } = useTheme();
  const scroll = useSharedValue(0);
  const boundedScroll = useDerivedValue(() => Math.min(scroll.value, geometry.touch));

  const rows = useMemo(() => {
    const result: Row[] = [];
    let last = '';
    for (const entry of story.entries) {
      const month = new Date(entry.at).toLocaleDateString('en', {
        timeZone: story.timezone,
        month: 'long',
        year: 'numeric',
      });
      if (month !== last) {
        result.push({ type: 'chapter', id: `chapter:${month}`, title: month });
        last = month;
      }
      result.push({ type: 'memory', id: entry.id, entry });
    }
    return result;
  }, [story.entries, story.timezone]);

  const refresh = () => {
    void story.stats.refetch();
    void story.today.refetch();
    if (filter !== 'milestone') void story.timeline.refetch();
  };

  const header = (
    <View style={[styles.headerContainer, { gap: spacing.lg, paddingBottom: spacing.lg }]}>
      {story.offline && (
        <View style={[styles.offlineCard, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
            You’re offline. Showing memories already loaded on this phone.
          </Text>
        </View>
      )}

      {story.notificationError && (
        <Text color="textSecondary" variant="caption">{story.notificationError}</Text>
      )}

      {/* Hero Title */}
      <View style={{ gap: 6 }}>
        <Text variant="display/M">Our little forever.</Text>
        <Text variant="body/M" color="textSecondary">
          The firsts, the ordinary days, the moments that became us.
        </Text>
      </View>

      {/* On this day Carousel */}
      <View style={{ gap: spacing.sm }}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text variant="title/M">On this day</Text>
        </View>
        {story.today.isPending ? (
          <Skeleton />
        ) : story.today.isError ? (
          <ErrorState description="Today’s memories could not load." onRetry={() => void story.today.refetch()} />
        ) : story.today.data?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {story.today.data.map(entry => (
              <View key={entry.id} style={{ width: 260 }}>
                <Text variant="caption" color="primary" style={{ marginBottom: 4 }}>
                  {Number(story.day.slice(0, 4)) -
                    Number(new Intl.DateTimeFormat('en', { timeZone: story.timezone, year: 'numeric' }).format(new Date(entry.at)))}{' '}
                  years ago today…
                </Text>
                <MemoryCard entry={entry} timezone={story.timezone} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text color="textSecondary" variant="body/S">
            No memories from this date in earlier years. You’re making tomorrow’s memories today.
          </Text>
        )}
      </View>

      {/* Milestones Carousel */}
      <View style={{ gap: spacing.sm }}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trophy-outline" size={18} color={colors.primary} />
          <Text variant="title/M">Milestones</Text>
        </View>
        {story.stats.isPending ? (
          <Skeleton />
        ) : story.stats.isError ? (
          <ErrorState description="Milestones could not load." onRetry={() => void story.stats.refetch()} />
        ) : story.unlocked.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {story.unlocked.map(entry => (
              <View key={entry.id} style={{ width: 260 }}>
                <MemoryCard entry={entry} timezone={story.timezone} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text color="textSecondary" variant="body/S">
            Your firsts are ahead of you. Set your anniversary in Settings to include your days together.
          </Text>
        )}
      </View>

      {/* Year Together Wrapped Card */}
      <Card variant="elevated" style={[styles.wrappedCard, { gap: spacing.md }]}>
        <View style={styles.wrappedHeader}>
          <View style={[styles.kindPill, { backgroundColor: colors.primary, borderRadius: radius.pill }]}>
            <Text variant="caption" color="primaryContrast">WRAPPED</Text>
          </View>
          <Text variant="display/M">Us in {year}</Text>
        </View>
        <Text color="textSecondary" variant="body/M">
          A few numbers. A thousand little feelings.
        </Text>

        <View style={styles.wrappedControls}>
          <View style={styles.yearStepper}>
            <PressableScale
              accessibilityRole="button"
              disabled={year <= 1900}
              onPress={() => setYear(y => y - 1)}
              style={[styles.yearButton, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}
            >
              <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
            </PressableScale>
            <Text variant="title/S">{year}</Text>
            <PressableScale
              accessibilityRole="button"
              disabled={year >= currentYear}
              onPress={() => setYear(y => y + 1)}
              style={[styles.yearButton, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
            </PressableScale>
          </View>

          <Button
            title="Open Wrapped ✦"
            disabled={!story.id}
            onPress={() => setWrappedYear(year)}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <SettingsSection />

      {/* Timeline Section & Filter Bar */}
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        <Text variant="title/M">Our story timeline</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {filters.map(f => {
            const isSelected = filter === f.id;
            return (
              <PressableScale
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setFilter(f.id)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                    borderRadius: radius.pill,
                  },
                ]}
              >
                <Ionicons
                  name={f.icon}
                  size={14}
                  color={isSelected ? colors.primaryContrast : colors.textPrimary}
                />
                <Text
                  variant="label"
                  color={isSelected ? 'primaryContrast' : 'textPrimary'}
                >
                  {f.title}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  if (story.profile.isError || story.couple.isError) {
    return (
      <Screen atmosphere gradient>
        <Header title="Story of Us" onBack={() => router.back()} />
        <ErrorState
          description="Your couple could not load. Check your connection."
          onRetry={() => {
            void story.profile.refetch();
            void story.couple.refetch();
          }}
        />
      </Screen>
    );
  }

  if (story.profile.isPending || (!!story.id && story.couple.isPending)) {
    return (
      <Screen atmosphere gradient>
        <Header title="Story of Us" />
        <Skeleton />
      </Screen>
    );
  }

  if (!story.id) {
    return (
      <Screen atmosphere gradient>
        <Header title="Story of Us" onBack={() => router.back()} />
        <EmptyState title="A story for two" description="Pair with your partner to begin your shared story." />
      </Screen>
    );
  }

  return (
    <Screen atmosphere gradient bottomInset>
      <Header
        title="Story of Us"
        subtitle="Every chapter, together"
        onBack={() => router.back()}
        right={<IconButton name="refresh-outline" accessibilityLabel="Refresh" onPress={refresh} />}
      />

      <FlashList
        data={rows}
        keyExtractor={row => row.id}
        getItemType={row => row.type}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        onScroll={event => {
          scroll.value = event.nativeEvent.contentOffset.y;
        }}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => {
          if (item.type === 'chapter') {
            return (
              <ParallaxHeader scrollY={boundedScroll} style={[styles.chapterHeader, { backgroundColor: colors.bg }]}>
                <View style={[styles.chapterPill, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
                  <Ionicons name="book-outline" size={14} color={colors.primary} />
                  <Text variant="title/S">{item.title}</Text>
                </View>
              </ParallaxHeader>
            );
          }

          const content = (
            <View style={[styles.timelineNode, { borderLeftColor: surfaces.rimStrong }]}>
              {/* Timeline dot */}
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: item.entry.kind === 'milestone' ? colors.primary : colors.accent,
                    borderColor: colors.bg,
                  },
                ]}
              />
              <MemoryCard key={item.id} entry={item.entry} timezone={story.timezone} />
            </View>
          );

          return index < geometry.firstScreenful ? <FadeInView>{content}</FadeInView> : content;
        }}
        ListEmptyComponent={
          filter !== 'milestone' && story.timeline.isPending ? (
            <Skeleton />
          ) : filter !== 'milestone' && story.timeline.isError ? (
            <ErrorState description="The timeline could not load." onRetry={() => void story.timeline.refetch()} />
          ) : (
            <EmptyState title="A chapter waiting to happen" description="Your shared memories will appear here." />
          )
        }
        ListFooterComponent={
          <View style={{ paddingVertical: spacing.lg, gap: spacing.sm }}>
            {story.timeline.isFetchNextPageError && (
              <ErrorState description="The next chapter could not load." onRetry={() => void story.timeline.fetchNextPage()} />
            )}
            {filter !== 'milestone' && story.timeline.hasNextPage && (
              <Button
                title={story.timeline.isFetchingNextPage ? 'Loading…' : 'Load older chapters'}
                disabled={story.timeline.isFetchingNextPage}
                variant="secondary"
                onPress={() => void story.timeline.fetchNextPage()}
              />
            )}
          </View>
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (
            filter !== 'milestone' &&
            story.timeline.hasNextPage &&
            !story.timeline.isFetching &&
            !story.timeline.isFetchNextPageError
          ) {
            void story.timeline.fetchNextPage();
          }
        }}
      />

      {wrappedYear !== undefined && story.id && (
        <Wrapped
          year={wrappedYear}
          timezone={story.timezone}
          couple={story.id}
          onClose={() => {
            setWrappedYear(undefined);
            if (params.wrapped) router.setParams({ wrapped: undefined });
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 8,
  },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memoryCard: {
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  imageContainer: {
    marginTop: 4,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  burstContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrappedCard: {
    padding: 20,
  },
  wrappedHeader: {
    gap: 8,
  },
  wrappedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  yearStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yearButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chapterHeader: {
    paddingVertical: 14,
  },
  chapterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timelineNode: {
    paddingLeft: 16,
    paddingBottom: 16,
    borderLeftWidth: 2,
    position: 'relative',
  },
  timelineDot: {
    position: 'absolute',
    left: -7,
    top: 20,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});

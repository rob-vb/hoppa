import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View, SectionListRenderItem } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HistorySessionCard } from '@/components/ui/history-session-card';
import { Colors } from '@/constants/theme';
import { WorkoutSession } from '@/db/types';
import * as db from '@/db/database';
import { getDateGroupTitle } from '@/utils/format';

interface SessionWithDetails {
  session: WorkoutSession;
  dayName: string;
  schemaName: string;
  exerciseCount: number;
  completedCount: number;
  totalReps: number;
  progressionCount: number;
}

interface SessionSection {
  title: string;
  data: SessionWithDetails[];
}

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get completed workout sessions from the last 30 days using batch query
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const sessionsWithDetails = await db.getCompletedSessionsWithDetails(
        thirtyDaysAgo,
        now
      );

      setSessions(sessionsWithDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  // Group sessions by date for SectionList - must be before early return
  const sections = useMemo(() => groupSessionsIntoSections(sessions), [sessions]);

  const handleSessionPress = useCallback(
    (sessionId: string) => {
      router.push(`/(history)/${sessionId}`);
    },
    [router]
  );

  const renderItem: SectionListRenderItem<SessionWithDetails, SessionSection> = useCallback(
    ({ item }) => (
      <HistorySessionCard
        session={item.session}
        dayName={item.dayName}
        schemaName={item.schemaName}
        exerciseCount={item.exerciseCount}
        completedCount={item.completedCount}
        totalReps={item.totalReps}
        progressionCount={item.progressionCount}
        onPress={() => handleSessionPress(item.session.id)}
      />
    ),
    [handleSessionPress]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SessionSection }) => (
      <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
    ),
    []
  );

  const keyExtractor = useCallback(
    (item: SessionWithDetails) => item.session.id,
    []
  );

  const ListHeaderComponent = useMemo(
    () =>
      error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null,
    [error]
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.placeholder}>
        <ThemedText style={styles.placeholderText}>
          No workouts in the last 30 days
        </ThemedText>
        <ThemedText style={styles.placeholderSubtext}>
          Complete a workout to see it here
        </ThemedText>
      </View>
    ),
    []
  );

  // Loading state - early return after all hooks
  if (isLoading && sessions.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ItemSeparatorComponent={ItemSeparator}
        SectionSeparatorComponent={SectionSeparator}
        stickySectionHeadersEnabled={false}
        removeClippedSubviews={true}
      />
    </ThemedView>
  );
}

function ItemSeparator() {
  return <View style={styles.itemSeparator} />;
}

function SectionSeparator() {
  return <View style={styles.sectionSeparator} />;
}

function groupSessionsIntoSections(sessions: SessionWithDetails[]): SessionSection[] {
  const groups: Map<string, SessionWithDetails[]> = new Map();

  for (const session of sessions) {
    const completedAt = session.session.completedAt ?? session.session.startedAt;
    const title = getDateGroupTitle(completedAt);

    if (!groups.has(title)) {
      groups.set(title, []);
    }
    groups.get(title)!.push(session);
  }

  // Convert map to array of sections maintaining order (most recent first)
  return Array.from(groups.entries()).map(([title, data]) => ({
    title,
    data,
  }));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  itemSeparator: {
    height: 12,
  },
  sectionSeparator: {
    height: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
  },
  placeholder: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  placeholderText: {
    opacity: 0.7,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  placeholderSubtext: {
    opacity: 0.5,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

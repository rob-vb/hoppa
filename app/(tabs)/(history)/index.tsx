import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HistorySessionCard } from '@/components/ui/history-session-card';
import { Colors } from '@/constants/theme';
import { WorkoutSession } from '@/db/types';
import * as db from '@/db/database';

interface SessionWithDetails {
  session: WorkoutSession;
  dayName: string;
  schemaName: string;
  exerciseCount: number;
  completedCount: number;
  totalReps: number;
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get all completed workout sessions
      const allSessions = await db.getWorkoutSessions();
      const completedSessions = allSessions.filter(
        (s) => s.status === 'completed'
      );

      const sessionsWithDetails: SessionWithDetails[] = [];

      for (const session of completedSessions) {
        // Get schema and day names
        const schema = await db.getSchemaById(session.schemaId);
        const day = await db.getWorkoutDayById(session.dayId);

        if (!schema || !day) continue;

        // Get exercise logs for this session
        const exerciseLogs = await db.getExerciseLogsBySession(session.id);

        // Calculate stats
        const exerciseCount = exerciseLogs.length;
        const completedCount = exerciseLogs.filter(
          (log) => log.status === 'completed'
        ).length;

        // Calculate total reps
        let totalReps = 0;
        for (const log of exerciseLogs) {
          const setLogs = await db.getSetLogsByExerciseLog(log.id);
          totalReps += setLogs.reduce(
            (sum, set) => sum + (set.completedReps ?? 0),
            0
          );
        }

        sessionsWithDetails.push({
          session,
          dayName: day.name,
          schemaName: schema.name,
          exerciseCount,
          completedCount,
          totalReps,
        });
      }

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

  if (isLoading && sessions.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </ThemedView>
    );
  }

  // Group sessions by date
  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {sessions.length === 0 ? (
          <View style={styles.placeholder}>
            <ThemedText style={styles.placeholderText}>
              No workouts completed yet
            </ThemedText>
            <ThemedText style={styles.placeholderSubtext}>
              Complete a workout to see it here
            </ThemedText>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {groupedSessions.map((group) => (
              <View key={group.title} style={styles.dateGroup}>
                <ThemedText style={styles.sectionTitle}>{group.title}</ThemedText>
                {group.sessions.map((item) => (
                  <HistorySessionCard
                    key={item.session.id}
                    session={item.session}
                    dayName={item.dayName}
                    schemaName={item.schemaName}
                    exerciseCount={item.exerciseCount}
                    completedCount={item.completedCount}
                    totalReps={item.totalReps}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

interface SessionGroup {
  title: string;
  sessions: SessionWithDetails[];
}

function groupSessionsByDate(sessions: SessionWithDetails[]): SessionGroup[] {
  const groups: Map<string, SessionWithDetails[]> = new Map();

  for (const session of sessions) {
    const completedAt = session.session.completedAt ?? session.session.startedAt;
    const title = getDateGroupTitle(completedAt);

    if (!groups.has(title)) {
      groups.set(title, []);
    }
    groups.get(title)!.push(session);
  }

  // Convert map to array maintaining order (most recent first)
  return Array.from(groups.entries()).map(([title, sessions]) => ({
    title,
    sessions,
  }));
}

function getDateGroupTitle(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Reset time to compare dates only
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diff = nowOnly.getTime() - dateOnly.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This Week';
  if (days < 14) return 'Last Week';
  if (days < 30) return 'This Month';

  // Return month and year for older entries
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
  listContainer: {
    gap: 20,
  },
  dateGroup: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

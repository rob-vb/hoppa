import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutCalendar } from '@/components/ui/workout-calendar';
import { HistorySessionCard } from '@/components/ui/history-session-card';
import { Colors } from '@/constants/theme';
import { WorkoutSession } from '@/db/types';
import * as db from '@/db/database';
import type { CalendarDay } from '@/db/database';

interface SessionWithDetails {
  session: WorkoutSession;
  dayName: string;
  schemaName: string;
  exerciseCount: number;
  completedCount: number;
  totalReps: number;
  progressionCount: number;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<SessionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const loadCalendarData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await db.getWorkoutCalendar(year, month);
      setCalendarDays(data);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  const loadSessionsForDate = useCallback(async (date: number) => {
    setIsLoadingSessions(true);
    try {
      // Get start and end of the selected day
      const selectedDay = new Date(date);
      const startOfDay = new Date(
        selectedDay.getFullYear(),
        selectedDay.getMonth(),
        selectedDay.getDate()
      ).getTime();
      const endOfDay = new Date(
        selectedDay.getFullYear(),
        selectedDay.getMonth(),
        selectedDay.getDate(),
        23,
        59,
        59,
        999
      ).getTime();

      const sessions = await db.getCompletedSessionsWithDetails(startOfDay, endOfDay);
      setSelectedSessions(sessions);
    } catch (err) {
      console.error('Failed to load sessions for date:', err);
      setSelectedSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // Load calendar data on mount and when month changes
  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCalendarData();
      // Also refresh selected date sessions if one is selected
      if (selectedDate) {
        loadSessionsForDate(selectedDate);
      }
    }, [loadCalendarData, selectedDate, loadSessionsForDate])
  );

  const handlePreviousMonth = useCallback(() => {
    setSelectedDate(null);
    setSelectedSessions([]);
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }, [year, month]);

  const handleNextMonth = useCallback(() => {
    setSelectedDate(null);
    setSelectedSessions([]);
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }, [year, month]);

  const handleDayPress = useCallback(
    (date: number) => {
      setSelectedDate(date);
      loadSessionsForDate(date);
    },
    [loadSessionsForDate]
  );

  const handleSessionPress = useCallback(
    (sessionId: string) => {
      router.push(`/(history)/${sessionId}`);
    },
    [router]
  );

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    const date = new Date(selectedDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  if (isLoading && calendarDays.length === 0) {
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <WorkoutCalendar
          year={year}
          month={month}
          calendarDays={calendarDays}
          onDayPress={handleDayPress}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
        />

        {selectedDate && (
          <View style={styles.sessionsSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              {formattedSelectedDate}
            </ThemedText>

            {isLoadingSessions ? (
              <View style={styles.sessionsLoading}>
                <ActivityIndicator size="small" color={Colors.dark.primary} />
              </View>
            ) : selectedSessions.length > 0 ? (
              <View style={styles.sessionsList}>
                {selectedSessions.map((item) => (
                  <HistorySessionCard
                    key={item.session.id}
                    session={item.session}
                    dayName={item.dayName}
                    schemaName={item.schemaName}
                    exerciseCount={item.exerciseCount}
                    completedCount={item.completedCount}
                    totalReps={item.totalReps}
                    progressionCount={item.progressionCount}
                    onPress={() => handleSessionPress(item.session.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.noWorkouts}>
                <ThemedText style={styles.noWorkoutsText}>
                  No completed workouts on this day
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
  },
  sessionsLoading: {
    padding: 24,
    alignItems: 'center',
  },
  sessionsList: {
    gap: 12,
  },
  noWorkouts: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  noWorkoutsText: {
    color: Colors.dark.textSecondary,
  },
});

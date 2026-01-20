import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import type { CalendarDay } from '@/db/database';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type WorkoutCalendarProps = {
  year: number;
  month: number;
  calendarDays: CalendarDay[];
  onDayPress?: (date: number) => void;
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
};

export const WorkoutCalendar = memo(function WorkoutCalendar({
  year,
  month,
  calendarDays,
  onDayPress,
  onPreviousMonth,
  onNextMonth,
}: WorkoutCalendarProps) {
  const monthName = useMemo(() => {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [year, month]);

  // Build the calendar grid
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay();

    // Create a map for quick lookup
    const dayMap = new Map<number, CalendarDay>();
    for (const day of calendarDays) {
      const date = new Date(day.date);
      dayMap.set(date.getDate(), day);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const grid: (CalendarDay | null)[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      grid.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const calendarDay = dayMap.get(day);
      if (calendarDay) {
        grid.push(calendarDay);
      } else {
        // Create empty day
        grid.push({
          date: new Date(year, month - 1, day).getTime(),
          hasWorkout: false,
          isCompleted: false,
          workoutCount: 0,
        });
      }
    }

    return grid;
  }, [year, month, calendarDays]);

  const today = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }, []);

  const handleDayPress = useCallback(
    (day: CalendarDay) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onDayPress?.(day.date);
    },
    [onDayPress]
  );

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (direction === 'prev') {
        onPreviousMonth?.();
      } else {
        onNextMonth?.();
      }
    },
    [onPreviousMonth, onNextMonth]
  );

  return (
    <View style={styles.container}>
      {/* Month header with navigation */}
      <View style={styles.header}>
        <Pressable
          onPress={() => handleNavigate('prev')}
          style={styles.navButton}
          hitSlop={8}
        >
          <IconSymbol name="chevron.left" size={20} color={Colors.dark.primary} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.monthTitle}>
          {monthName}
        </ThemedText>
        <Pressable
          onPress={() => handleNavigate('next')}
          style={styles.navButton}
          hitSlop={8}
        >
          <IconSymbol name="chevron.right" size={20} color={Colors.dark.primary} />
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <ThemedText style={styles.weekdayText}>{day}</ThemedText>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {calendarGrid.map((day, index) => {
          if (!day) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const date = new Date(day.date);
          const dayNumber = date.getDate();
          const isToday =
            today.year === year &&
            today.month === month &&
            today.day === dayNumber;

          return (
            <Pressable
              key={day.date}
              style={[
                styles.dayCell,
                isToday && styles.todayCell,
              ]}
              onPress={() => handleDayPress(day)}
            >
              <View
                style={[
                  styles.dayContent,
                  day.hasWorkout && styles.hasWorkout,
                  day.isCompleted && styles.completedWorkout,
                ]}
              >
                <ThemedText
                  style={[
                    styles.dayText,
                    day.hasWorkout && styles.hasWorkoutText,
                    day.isCompleted && styles.completedText,
                    isToday && !day.hasWorkout && styles.todayText,
                  ]}
                >
                  {dayNumber}
                </ThemedText>
              </View>
              {day.workoutCount > 1 && (
                <View style={styles.multipleIndicator}>
                  <ThemedText style={styles.multipleText}>
                    {day.workoutCount}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.completedWorkout]} />
          <ThemedText style={styles.legendText}>Completed</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.hasWorkout]} />
          <ThemedText style={styles.legendText}>In Progress</ThemedText>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  todayCell: {
    // Subtle highlight for today
  },
  dayContent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hasWorkout: {
    backgroundColor: Colors.dark.primary + '30',
  },
  completedWorkout: {
    backgroundColor: Colors.dark.primary,
  },
  dayText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  hasWorkoutText: {
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  completedText: {
    color: Colors.dark.text,
    fontWeight: '600',
  },
  todayText: {
    color: Colors.dark.text,
    fontWeight: '600',
  },
  multipleIndicator: {
    position: 'absolute',
    bottom: 0,
    right: '25%',
    backgroundColor: '#22C55E',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  multipleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});

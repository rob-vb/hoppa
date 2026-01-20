import { useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ExerciseCard } from '@/components/ui/exercise-card';
import { RepInput } from '@/components/ui/rep-input';
import { useWorkoutStore } from '@/stores/workout-store';
import { Colors } from '@/constants/theme';

export default function ActiveWorkoutScreen() {
  useLocalSearchParams<{ dayId: string }>();
  const router = useRouter();

  const {
    session,
    exerciseLogs,
    currentExerciseIndex,
    isLoading,
    error,
    setCurrentExercise,
    nextExercise,
    previousExercise,
    logReps,
    clearReps,
    completeExercise,
    skipExercise,
    completeWorkout,
    cancelWorkout,
    getCurrentExerciseLog,
    isExerciseComplete,
    getCompletedSetsCount,
  } = useWorkoutStore();

  const currentExerciseLog = getCurrentExerciseLog();

  const handleRepSelect = useCallback(
    async (reps: number, setId: string) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await logReps(setId, reps);
    },
    [logReps]
  );

  const handleClearReps = useCallback(
    async (setId: string) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await clearReps(setId);
    },
    [clearReps]
  );

  const handleCompleteExercise = useCallback(async () => {
    if (!currentExerciseLog) return;

    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    await completeExercise(currentExerciseLog.id);

    // Auto-advance to next exercise
    if (currentExerciseIndex < exerciseLogs.length - 1) {
      nextExercise();
    }
  }, [currentExerciseLog, completeExercise, currentExerciseIndex, exerciseLogs.length, nextExercise]);

  const handleSkipExercise = useCallback(async () => {
    if (!currentExerciseLog) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    await skipExercise(currentExerciseLog.id);

    // Auto-advance to next exercise
    if (currentExerciseIndex < exerciseLogs.length - 1) {
      nextExercise();
    }
  }, [currentExerciseLog, skipExercise, currentExerciseIndex, exerciseLogs.length, nextExercise]);

  const handleFinishWorkout = useCallback(async () => {
    Alert.alert(
      'Finish Workout',
      'Are you sure you want to finish this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            await completeWorkout();
            router.back();
          },
        },
      ]
    );
  }, [completeWorkout, router]);

  const handleCancelWorkout = useCallback(() => {
    Alert.alert(
      'Cancel Workout',
      'Are you sure you want to cancel? All progress will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: async () => {
            await cancelWorkout();
            router.back();
          },
        },
      ]
    );
  }, [cancelWorkout, router]);

  const handleClose = useCallback(() => {
    // If workout is in progress, ask to confirm
    if (session) {
      Alert.alert(
        'Leave Workout',
        'Your workout will remain active. You can resume it later.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [session, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session || !currentExerciseLog) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            {error || 'No active workout session'}
          </ThemedText>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const { exercise, sets, status, progressionEarned } = currentExerciseLog;
  const completedSets = getCompletedSetsCount(currentExerciseLog.id);
  const totalSets = sets.length;
  const isCurrentExerciseComplete = isExerciseComplete(currentExerciseLog.id);
  const allSetsCompleted = completedSets === totalSets;

  // Calculate overall workout progress
  const completedExercises = exerciseLogs.filter(
    (log) => log.status === 'completed' || log.status === 'skipped'
  ).length;
  const totalExercises = exerciseLogs.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} hitSlop={12}>
          <IconSymbol name="xmark" size={24} color={Colors.dark.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <ThemedText style={styles.headerProgress}>
            Exercise {currentExerciseIndex + 1} of {totalExercises}
          </ThemedText>
        </View>

        <Pressable onPress={handleCancelWorkout} hitSlop={12}>
          <ThemedText style={styles.cancelText}>Cancel</ThemedText>
        </Pressable>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            { width: `${(completedExercises / totalExercises) * 100}%` },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Exercise Card */}
        <ExerciseCard
          exercise={exercise}
          sets={sets}
          totalWeight={currentExerciseLog.totalWeight}
          status={status}
          progressionEarned={progressionEarned}
          completedSetsCount={completedSets}
        />

        {/* Rep Input - Quick Buttons for each Set */}
        {!isCurrentExerciseComplete && (
          <View style={styles.repInputSection}>
            {sets.map((set, index) => (
              <RepInput
                key={set.id}
                setNumber={index + 1}
                targetReps={`${exercise.targetRepsMin}-${exercise.targetRepsMax}`}
                completedReps={set.completedReps}
                onLogReps={(reps) => handleRepSelect(reps, set.id)}
                onClearReps={() => handleClearReps(set.id)}
                disabled={isCurrentExerciseComplete}
              />
            ))}
          </View>
        )}

        {/* Exercise Actions */}
        <View style={styles.exerciseActions}>
          {!isCurrentExerciseComplete ? (
            <>
              <Button
                title="Complete Exercise"
                onPress={handleCompleteExercise}
                disabled={!allSetsCompleted}
                fullWidth
              />
              <Button
                title="Skip Exercise"
                variant="ghost"
                onPress={handleSkipExercise}
                fullWidth
              />
            </>
          ) : (
            <View style={styles.completedBadge}>
              <IconSymbol
                name={status === 'skipped' ? 'forward.fill' : 'checkmark.circle.fill'}
                size={20}
                color={status === 'skipped' ? Colors.dark.textSecondary : '#22C55E'}
              />
              <ThemedText
                style={[
                  styles.completedText,
                  status === 'skipped' && styles.skippedText,
                ]}
              >
                {status === 'skipped' ? 'Exercise Skipped' : 'Exercise Completed'}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Exercise Navigation */}
        <View style={styles.exerciseNav}>
          {exerciseLogs.map((log, index) => (
            <Pressable
              key={log.id}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.selectionAsync();
                }
                setCurrentExercise(index);
              }}
              style={[
                styles.navDot,
                index === currentExerciseIndex && styles.navDotActive,
                (log.status === 'completed' || log.status === 'skipped') &&
                  styles.navDotCompleted,
              ]}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <SafeAreaView edges={['bottom']} style={styles.bottomNav}>
        <View style={styles.bottomNavContent}>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'ios') {
                Haptics.selectionAsync();
              }
              previousExercise();
            }}
            disabled={currentExerciseIndex === 0}
            style={({ pressed }) => [
              styles.navButton,
              currentExerciseIndex === 0 && styles.navButtonDisabled,
              pressed && styles.navButtonPressed,
            ]}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={
                currentExerciseIndex === 0
                  ? Colors.dark.textSecondary
                  : Colors.dark.text
              }
            />
            <ThemedText
              style={[
                styles.navButtonText,
                currentExerciseIndex === 0 && styles.navButtonTextDisabled,
              ]}
            >
              Previous
            </ThemedText>
          </Pressable>

          {completedExercises === totalExercises ? (
            <Button title="Finish Workout" onPress={handleFinishWorkout} />
          ) : (
            <Pressable
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.selectionAsync();
                }
                nextExercise();
              }}
              disabled={currentExerciseIndex === totalExercises - 1}
              style={({ pressed }) => [
                styles.navButton,
                currentExerciseIndex === totalExercises - 1 &&
                  styles.navButtonDisabled,
                pressed && styles.navButtonPressed,
              ]}
            >
              <ThemedText
                style={[
                  styles.navButtonText,
                  currentExerciseIndex === totalExercises - 1 &&
                    styles.navButtonTextDisabled,
                ]}
              >
                Next
              </ThemedText>
              <IconSymbol
                name="chevron.right"
                size={24}
                color={
                  currentExerciseIndex === totalExercises - 1
                    ? Colors.dark.textSecondary
                    : Colors.dark.text
                }
              />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerProgress: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  cancelText: {
    fontSize: 14,
    color: Colors.dark.error,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  repInputSection: {
    marginTop: 16,
    gap: 12,
  },
  exerciseActions: {
    gap: 12,
    marginBottom: 24,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.surface,
    paddingVertical: 16,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
  },
  skippedText: {
    color: Colors.dark.textSecondary,
  },
  exerciseNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  navDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.surface,
  },
  navDotActive: {
    backgroundColor: Colors.dark.primary,
    width: 24,
  },
  navDotCompleted: {
    backgroundColor: '#22C55E',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  bottomNavContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonPressed: {
    opacity: 0.7,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  navButtonTextDisabled: {
    color: Colors.dark.textSecondary,
  },
});

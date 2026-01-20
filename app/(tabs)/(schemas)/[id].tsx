import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { IncrementSelector } from '@/components/ui/increment-selector';
import { useSchemaStore } from '@/stores/schema-store';
import { Colors } from '@/constants/theme';
import { EquipmentType, Exercise, WorkoutDayWithExercises } from '@/db/types';

const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: 'plates', label: 'Barbell/Plates' },
  { value: 'machine', label: 'Machine' },
  { value: 'other', label: 'Other' },
];

export default function SchemaDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    currentSchema,
    loadSchemaWithDays,
    updateSchema,
    addWorkoutDay,
    updateWorkoutDay,
    deleteWorkoutDay,
    addExercise,
    updateExercise,
    deleteExercise,
    isLoading,
    clearCurrentSchema,
  } = useSchemaStore();

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [editingExercise, setEditingExercise] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadSchemaWithDays(id);
    }
    return () => {
      clearCurrentSchema();
    };
  }, [id, loadSchemaWithDays, clearCurrentSchema]);

  const toggleDay = (dayId: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
      }
      return next;
    });
  };

  const handleAddDay = async () => {
    if (!currentSchema) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const day = await addWorkoutDay(currentSchema.id, `Day ${currentSchema.days.length + 1}`);
      setExpandedDays((prev) => new Set(prev).add(day.id));
    } catch {
      Alert.alert('Error', 'Failed to add workout day');
    }
  };

  const handleDeleteDay = (dayId: string, dayName: string) => {
    Alert.alert(
      'Delete Day',
      `Are you sure you want to delete "${dayName}"? This will also delete all exercises in this day.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            try {
              await deleteWorkoutDay(dayId);
            } catch {
              Alert.alert('Error', 'Failed to delete workout day');
            }
          },
        },
      ]
    );
  };

  const handleUpdateDayName = async (dayId: string, name: string) => {
    try {
      await updateWorkoutDay(dayId, { name });
    } catch {
      Alert.alert('Error', 'Failed to update day name');
    }
  };

  const handleMoveDayUp = async (dayId: string) => {
    if (!currentSchema) return;

    const index = currentSchema.days.findIndex((d) => d.id === dayId);
    if (index <= 0) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const prevDay = currentSchema.days[index - 1];
      const currDay = currentSchema.days[index];
      await updateWorkoutDay(prevDay.id, { orderIndex: index });
      await updateWorkoutDay(currDay.id, { orderIndex: index - 1 });
      await loadSchemaWithDays(currentSchema.id);
    } catch {
      Alert.alert('Error', 'Failed to reorder days');
    }
  };

  const handleMoveDayDown = async (dayId: string) => {
    if (!currentSchema) return;

    const index = currentSchema.days.findIndex((d) => d.id === dayId);
    if (index < 0 || index >= currentSchema.days.length - 1) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const nextDay = currentSchema.days[index + 1];
      const currDay = currentSchema.days[index];
      await updateWorkoutDay(currDay.id, { orderIndex: index + 1 });
      await updateWorkoutDay(nextDay.id, { orderIndex: index });
      await loadSchemaWithDays(currentSchema.id);
    } catch {
      Alert.alert('Error', 'Failed to reorder days');
    }
  };

  const handleAddExercise = async (dayId: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const exercise = await addExercise(dayId, {
        name: 'New Exercise',
        equipmentType: 'plates',
        baseWeight: 0,
        targetSets: 3,
        targetRepsMin: 6,
        targetRepsMax: 8,
        progressiveLoadingEnabled: true,
        progressionIncrement: 2.5,
        currentWeight: 0,
      });
      setEditingExercise(exercise.id);
    } catch {
      Alert.alert('Error', 'Failed to add exercise');
    }
  };

  const handleDeleteExercise = (exerciseId: string, exerciseName: string) => {
    Alert.alert('Delete Exercise', `Are you sure you want to delete "${exerciseName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          try {
            await deleteExercise(exerciseId);
          } catch {
            Alert.alert('Error', 'Failed to delete exercise');
          }
        },
      },
    ]);
  };

  const handleUpdateExerciseField = async (
    exerciseId: string,
    field: keyof Omit<Exercise, 'id' | 'dayId'>,
    value: string | number | boolean
  ) => {
    // Find the exercise to get current values for validation
    const exercise = currentSchema?.days
      .flatMap((d) => d.exercises)
      .find((e) => e.id === exerciseId);

    if (!exercise) return;

    // Validate rep range constraints
    if (field === 'targetRepsMin' && typeof value === 'number') {
      if (value > exercise.targetRepsMax) {
        Alert.alert('Invalid Range', 'Min reps cannot be greater than max reps');
        return;
      }
    }
    if (field === 'targetRepsMax' && typeof value === 'number') {
      if (value < exercise.targetRepsMin) {
        Alert.alert('Invalid Range', 'Max reps cannot be less than min reps');
        return;
      }
    }

    // Validate progression increment must be positive
    if (field === 'progressionIncrement' && typeof value === 'number') {
      if (value <= 0) {
        Alert.alert('Invalid Increment', 'Progression increment must be greater than 0');
        return;
      }
    }

    try {
      await updateExercise(exerciseId, { [field]: value });
    } catch {
      Alert.alert('Error', 'Failed to update exercise');
    }
  };

  const handleMoveExerciseUp = async (dayId: string, exerciseId: string) => {
    if (!currentSchema) return;

    const day = currentSchema.days.find((d) => d.id === dayId);
    if (!day) return;

    const index = day.exercises.findIndex((e) => e.id === exerciseId);
    if (index <= 0) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const prevExercise = day.exercises[index - 1];
      const currExercise = day.exercises[index];
      await updateExercise(prevExercise.id, { orderIndex: index });
      await updateExercise(currExercise.id, { orderIndex: index - 1 });
      await loadSchemaWithDays(currentSchema.id);
    } catch {
      Alert.alert('Error', 'Failed to reorder exercises');
    }
  };

  const handleMoveExerciseDown = async (dayId: string, exerciseId: string) => {
    if (!currentSchema) return;

    const day = currentSchema.days.find((d) => d.id === dayId);
    if (!day) return;

    const index = day.exercises.findIndex((e) => e.id === exerciseId);
    if (index < 0 || index >= day.exercises.length - 1) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const nextExercise = day.exercises[index + 1];
      const currExercise = day.exercises[index];
      await updateExercise(currExercise.id, { orderIndex: index + 1 });
      await updateExercise(nextExercise.id, { orderIndex: index });
      await loadSchemaWithDays(currentSchema.id);
    } catch {
      Alert.alert('Error', 'Failed to reorder exercises');
    }
  };

  const renderExercise = (
    dayId: string,
    exercise: Exercise,
    index: number,
    totalExercises: number
  ) => {
    const isEditing = editingExercise === exercise.id;

    return (
      <View key={exercise.id} style={styles.exerciseContainer}>
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseReorderButtons}>
            <Pressable
              onPress={() => handleMoveExerciseUp(dayId, exercise.id)}
              hitSlop={8}
              style={[
                styles.exerciseReorderButton,
                index === 0 && styles.reorderButtonDisabled,
              ]}
              disabled={index === 0}
            >
              <IconSymbol
                name="chevron.up"
                size={14}
                color={index === 0 ? Colors.dark.border : Colors.dark.icon}
              />
            </Pressable>
            <Pressable
              onPress={() => handleMoveExerciseDown(dayId, exercise.id)}
              hitSlop={8}
              style={[
                styles.exerciseReorderButton,
                index === totalExercises - 1 && styles.reorderButtonDisabled,
              ]}
              disabled={index === totalExercises - 1}
            >
              <IconSymbol
                name="chevron.down"
                size={14}
                color={index === totalExercises - 1 ? Colors.dark.border : Colors.dark.icon}
              />
            </Pressable>
          </View>

          <Pressable
            style={styles.exerciseTitleRow}
            onPress={() => setEditingExercise(isEditing ? null : exercise.id)}
          >
            <IconSymbol
              name="chevron.right"
              size={14}
              color={Colors.dark.icon}
              style={{ transform: [{ rotate: isEditing ? '90deg' : '0deg' }] }}
            />
            <View style={styles.exerciseTitleContent}>
              <ThemedText type="defaultSemiBold" style={styles.exerciseName}>
                {exercise.name}
              </ThemedText>
              <ThemedText style={styles.exerciseMeta}>
                {exercise.targetSets} sets × {exercise.targetRepsMin}-{exercise.targetRepsMax} reps
                {exercise.currentWeight > 0 ? ` @ ${exercise.currentWeight}kg` : ''}
              </ThemedText>
            </View>
          </Pressable>

          <Pressable
            onPress={() => handleDeleteExercise(exercise.id, exercise.name)}
            hitSlop={8}
          >
            <IconSymbol name="trash" size={18} color={Colors.dark.error} />
          </Pressable>
        </View>

        {isEditing && (
          <View style={styles.exerciseForm}>
            <Input
              label="Name"
              placeholder="e.g., Bench Press"
              value={exercise.name}
              onChangeText={(text) => handleUpdateExerciseField(exercise.id, 'name', text)}
            />

            <View style={styles.equipmentRow}>
              <ThemedText style={styles.fieldLabel}>Equipment</ThemedText>
              <View style={styles.equipmentButtons}>
                {EQUIPMENT_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    onPress={() => {
                      if (Platform.OS === 'ios') {
                        Haptics.selectionAsync();
                      }
                      handleUpdateExerciseField(exercise.id, 'equipmentType', type.value);
                    }}
                    style={[
                      styles.equipmentButton,
                      exercise.equipmentType === type.value && styles.equipmentButtonActive,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.equipmentButtonText,
                        exercise.equipmentType === type.value &&
                          styles.equipmentButtonTextActive,
                      ]}
                    >
                      {type.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.rowInputItem}>
                <Input
                  label="Sets"
                  placeholder="3"
                  value={String(exercise.targetSets)}
                  onChangeText={(text) => {
                    const val = parseInt(text, 10);
                    if (!isNaN(val) && val > 0) {
                      handleUpdateExerciseField(exercise.id, 'targetSets', val);
                    }
                  }}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.rowInputItem}>
                <Input
                  label="Min Reps"
                  placeholder="6"
                  value={String(exercise.targetRepsMin)}
                  onChangeText={(text) => {
                    const val = parseInt(text, 10);
                    if (!isNaN(val) && val > 0) {
                      handleUpdateExerciseField(exercise.id, 'targetRepsMin', val);
                    }
                  }}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.rowInputItem}>
                <Input
                  label="Max Reps"
                  placeholder="8"
                  value={String(exercise.targetRepsMax)}
                  onChangeText={(text) => {
                    const val = parseInt(text, 10);
                    if (!isNaN(val) && val > 0) {
                      handleUpdateExerciseField(exercise.id, 'targetRepsMax', val);
                    }
                  }}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.rowInputItemWide}>
                <Input
                  label="Base Weight (kg)"
                  placeholder="0"
                  value={String(exercise.baseWeight)}
                  onChangeText={(text) => {
                    const val = parseFloat(text);
                    if (!isNaN(val) && val >= 0) {
                      handleUpdateExerciseField(exercise.id, 'baseWeight', val);
                    }
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.rowInputItemWide}>
                <Input
                  label="Current Weight (kg)"
                  placeholder="0"
                  value={String(exercise.currentWeight)}
                  onChangeText={(text) => {
                    const val = parseFloat(text);
                    if (!isNaN(val) && val >= 0) {
                      handleUpdateExerciseField(exercise.id, 'currentWeight', val);
                    }
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <IncrementSelector
              label="Progression Increment"
              value={String(exercise.progressionIncrement)}
              onValueChange={(text) => {
                const val = parseFloat(text);
                if (!isNaN(val) && val > 0) {
                  handleUpdateExerciseField(exercise.id, 'progressionIncrement', val);
                }
              }}
            />

            {currentSchema?.progressiveLoadingEnabled && (
              <View style={styles.switchRow}>
                <ThemedText style={styles.switchLabel}>Progressive Overload</ThemedText>
                <Switch
                  value={exercise.progressiveLoadingEnabled}
                  onValueChange={(value) =>
                    handleUpdateExerciseField(exercise.id, 'progressiveLoadingEnabled', value)
                  }
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderDay = (day: WorkoutDayWithExercises, index: number) => {
    const isExpanded = expandedDays.has(day.id);

    return (
      <Card key={day.id} style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <View style={styles.reorderButtons}>
            <Pressable
              onPress={() => handleMoveDayUp(day.id)}
              hitSlop={8}
              style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
              disabled={index === 0}
            >
              <IconSymbol
                name="chevron.up"
                size={16}
                color={index === 0 ? Colors.dark.border : Colors.dark.icon}
              />
            </Pressable>
            <Pressable
              onPress={() => handleMoveDayDown(day.id)}
              hitSlop={8}
              style={[
                styles.reorderButton,
                index === (currentSchema?.days.length ?? 0) - 1 && styles.reorderButtonDisabled,
              ]}
              disabled={index === (currentSchema?.days.length ?? 0) - 1}
            >
              <IconSymbol
                name="chevron.down"
                size={16}
                color={
                  index === (currentSchema?.days.length ?? 0) - 1
                    ? Colors.dark.border
                    : Colors.dark.icon
                }
              />
            </Pressable>
          </View>

          <Pressable onPress={() => toggleDay(day.id)} style={styles.dayHeaderMain}>
            <View style={styles.dayHeaderLeft}>
              <IconSymbol
                name="chevron.right"
                size={16}
                color={Colors.dark.icon}
                style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
              />
              <ThemedText type="defaultSemiBold" style={styles.dayTitle}>
                {day.name}
              </ThemedText>
            </View>
            <View style={styles.dayHeaderRight}>
              <ThemedText style={styles.exerciseCount}>
                {day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          </Pressable>

          <Pressable
            onPress={() => handleDeleteDay(day.id, day.name)}
            hitSlop={8}
            style={styles.removeDayButton}
          >
            <IconSymbol name="xmark.circle.fill" size={20} color={Colors.dark.error} />
          </Pressable>
        </View>

        {isExpanded && (
          <View style={styles.dayContent}>
            <Input
              label="Day Name"
              placeholder="e.g., Push Day"
              value={day.name}
              onChangeText={(text) => handleUpdateDayName(day.id, text)}
            />

            {day.exercises.length === 0 && (
              <ThemedText style={styles.noExercisesText}>
                No exercises yet. Add your first exercise below.
              </ThemedText>
            )}

            {day.exercises.map((exercise, exerciseIndex) =>
              renderExercise(day.id, exercise, exerciseIndex, day.exercises.length)
            )}

            <Button
              title="Add Exercise"
              variant="secondary"
              onPress={() => handleAddExercise(day.id)}
              fullWidth
            />
          </View>
        )}
      </Card>
    );
  };

  if (isLoading && !currentSchema) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText>Loading...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!currentSchema) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText>Schema not found</ThemedText>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Schema Details
            </ThemedText>
            <Input
              label="Name"
              placeholder="e.g., Push/Pull/Legs"
              value={currentSchema.name}
              onChangeText={(text) => updateSchema(currentSchema.id, { name: text })}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <ThemedText style={styles.switchLabel}>Progressive Overload</ThemedText>
                <ThemedText style={styles.switchHint}>
                  Automatically increase weights when you hit your rep targets
                </ThemedText>
              </View>
              <Switch
                value={currentSchema.progressiveLoadingEnabled}
                onValueChange={(value) =>
                  updateSchema(currentSchema.id, { progressiveLoadingEnabled: value })
                }
                trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Workout Days
            </ThemedText>

            {currentSchema.days.length === 0 && (
              <ThemedText style={styles.noExercisesText}>
                No workout days yet. Add your first day below.
              </ThemedText>
            )}

            {currentSchema.days.map((day, index) => renderDay(day, index))}

            <Button
              title="Add Workout Day"
              variant="secondary"
              onPress={handleAddDay}
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  section: {
    marginBottom: 24,
    gap: 16,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
  },
  switchHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  dayCard: {
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  reorderButtons: {
    flexDirection: 'column',
    gap: 2,
  },
  reorderButton: {
    padding: 4,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  dayHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTitle: {
    fontSize: 16,
  },
  exerciseCount: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  removeDayButton: {
    padding: 4,
  },
  dayContent: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  noExercisesText: {
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  exerciseContainer: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseReorderButtons: {
    flexDirection: 'column',
    gap: 0,
  },
  exerciseReorderButton: {
    padding: 2,
  },
  exerciseTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseTitleContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
  },
  exerciseMeta: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  exerciseForm: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  equipmentRow: {
    gap: 6,
  },
  equipmentButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  equipmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    backgroundColor: Colors.dark.inputBackground,
    alignItems: 'center',
  },
  equipmentButtonActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '20',
  },
  equipmentButtonText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  equipmentButtonTextActive: {
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  rowInputItem: {
    flex: 1,
  },
  rowInputItemWide: {
    flex: 1,
  },
});

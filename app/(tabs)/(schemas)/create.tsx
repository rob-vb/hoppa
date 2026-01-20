import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { IncrementSelector } from '@/components/ui/increment-selector';
import { ExerciseSelectorModal } from '@/components/ui/exercise-selector-modal';
import { useSchemaStore } from '@/stores/schema-store';
import { Colors } from '@/constants/theme';
import { EquipmentType } from '@/db/types';
import type { ExerciseTemplate } from '@/constants/exercise-library';

interface LocalExercise {
  id: string;
  name: string;
  equipmentType: EquipmentType;
  baseWeight: string;
  targetSets: string;
  targetRepsMin: string;
  targetRepsMax: string;
  progressiveLoadingEnabled: boolean;
  progressionIncrement: string;
}

interface LocalWorkoutDay {
  id: string;
  name: string;
  exercises: LocalExercise[];
  isExpanded: boolean;
}

const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: 'plates', label: 'Barbell/Plates' },
  { value: 'machine', label: 'Machine' },
  { value: 'other', label: 'Other' },
];

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function createEmptyExercise(): LocalExercise {
  return {
    id: generateId(),
    name: '',
    equipmentType: 'plates',
    baseWeight: '0',
    targetSets: '3',
    targetRepsMin: '6',
    targetRepsMax: '8',
    progressiveLoadingEnabled: true,
    progressionIncrement: '2.5',
  };
}

function createEmptyDay(): LocalWorkoutDay {
  return {
    id: generateId(),
    name: '',
    exercises: [],
    isExpanded: true,
  };
}

export default function CreateSchemaScreen() {
  const router = useRouter();
  const { createSchema, addWorkoutDay, addExercise, isLoading, error, clearError } =
    useSchemaStore();

  const [schemaName, setSchemaName] = useState('');
  const [progressiveLoadingEnabled, setProgressiveLoadingEnabled] = useState(true);
  const [days, setDays] = useState<LocalWorkoutDay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [exerciseSelectorDayId, setExerciseSelectorDayId] = useState<string | null>(null);

  const handleAddDay = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setDays([...days, createEmptyDay()]);
  };

  const handleRemoveDay = (dayId: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setDays(days.filter((d) => d.id !== dayId));
  };

  const handleUpdateDayName = (dayId: string, name: string) => {
    setDays(days.map((d) => (d.id === dayId ? { ...d, name } : d)));
    // Clear validation error for this field
    if (validationErrors[`day_${dayId}_name`]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[`day_${dayId}_name`];
        return next;
      });
    }
  };

  const handleToggleDay = (dayId: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setDays(days.map((d) => (d.id === dayId ? { ...d, isExpanded: !d.isExpanded } : d)));
  };

  const handleMoveDayUp = (dayId: string) => {
    const index = days.findIndex((d) => d.id === dayId);
    if (index <= 0) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newDays = [...days];
    [newDays[index - 1], newDays[index]] = [newDays[index], newDays[index - 1]];
    setDays(newDays);
  };

  const handleMoveDayDown = (dayId: string) => {
    const index = days.findIndex((d) => d.id === dayId);
    if (index < 0 || index >= days.length - 1) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newDays = [...days];
    [newDays[index], newDays[index + 1]] = [newDays[index + 1], newDays[index]];
    setDays(newDays);
  };

  const handleAddExercise = (dayId: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setDays(
      days.map((d) =>
        d.id === dayId ? { ...d, exercises: [...d.exercises, createEmptyExercise()] } : d
      )
    );
  };

  const handleOpenExerciseSelector = (dayId: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExerciseSelectorDayId(dayId);
  };

  const handleSelectExerciseFromLibrary = (exercise: ExerciseTemplate) => {
    if (!exerciseSelectorDayId) return;

    const newExercise: LocalExercise = {
      id: generateId(),
      name: exercise.name,
      equipmentType: exercise.equipmentType,
      baseWeight: exercise.defaultWeight.toString(),
      targetSets: exercise.defaultSets.toString(),
      targetRepsMin: exercise.defaultRepsMin.toString(),
      targetRepsMax: exercise.defaultRepsMax.toString(),
      progressiveLoadingEnabled: true,
      progressionIncrement: exercise.defaultProgressionIncrement.toString(),
    };

    setDays(
      days.map((d) =>
        d.id === exerciseSelectorDayId
          ? { ...d, exercises: [...d.exercises, newExercise] }
          : d
      )
    );
  };

  const handleRemoveExercise = (dayId: string, exerciseId: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setDays(
      days.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== exerciseId) }
          : d
      )
    );
  };

  const handleUpdateExercise = (
    dayId: string,
    exerciseId: string,
    updates: Partial<LocalExercise>
  ) => {
    setDays(
      days.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseId ? { ...e, ...updates } : e
              ),
            }
          : d
      )
    );
    // Clear validation errors for updated fields
    Object.keys(updates).forEach((key) => {
      const errorKey = `exercise_${exerciseId}_${key}`;
      if (validationErrors[errorKey]) {
        setValidationErrors((prev) => {
          const next = { ...prev };
          delete next[errorKey];
          return next;
        });
      }
    });
  };

  const handleMoveExerciseUp = (dayId: string, exerciseId: string) => {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;

    const index = day.exercises.findIndex((e) => e.id === exerciseId);
    if (index <= 0) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setDays(
      days.map((d) => {
        if (d.id !== dayId) return d;
        const newExercises = [...d.exercises];
        [newExercises[index - 1], newExercises[index]] = [
          newExercises[index],
          newExercises[index - 1],
        ];
        return { ...d, exercises: newExercises };
      })
    );
  };

  const handleMoveExerciseDown = (dayId: string, exerciseId: string) => {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;

    const index = day.exercises.findIndex((e) => e.id === exerciseId);
    if (index < 0 || index >= day.exercises.length - 1) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setDays(
      days.map((d) => {
        if (d.id !== dayId) return d;
        const newExercises = [...d.exercises];
        [newExercises[index], newExercises[index + 1]] = [
          newExercises[index + 1],
          newExercises[index],
        ];
        return { ...d, exercises: newExercises };
      })
    );
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!schemaName.trim()) {
      errors.schemaName = 'Schema name is required';
    }

    if (days.length === 0) {
      errors.days = 'Add at least one workout day';
    }

    days.forEach((day) => {
      if (!day.name.trim()) {
        errors[`day_${day.id}_name`] = 'Day name is required';
      }

      if (day.exercises.length === 0) {
        errors[`day_${day.id}_exercises`] = 'Add at least one exercise';
      }

      day.exercises.forEach((exercise) => {
        if (!exercise.name.trim()) {
          errors[`exercise_${exercise.id}_name`] = 'Exercise name is required';
        }
        const sets = parseInt(exercise.targetSets, 10);
        if (isNaN(sets) || sets < 1) {
          errors[`exercise_${exercise.id}_targetSets`] = 'Invalid sets';
        }
        const repsMin = parseInt(exercise.targetRepsMin, 10);
        const repsMax = parseInt(exercise.targetRepsMax, 10);
        if (isNaN(repsMin) || repsMin < 1) {
          errors[`exercise_${exercise.id}_targetRepsMin`] = 'Invalid min reps';
        }
        if (isNaN(repsMax) || repsMax < repsMin) {
          errors[`exercise_${exercise.id}_targetRepsMax`] = 'Invalid max reps';
        }
      });
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setIsSaving(true);
    clearError();

    try {
      // Create the schema first
      const schema = await createSchema(schemaName.trim(), progressiveLoadingEnabled);

      // Add each day and its exercises
      for (const day of days) {
        const workoutDay = await addWorkoutDay(schema.id, day.name.trim());

        for (const exercise of day.exercises) {
          await addExercise(workoutDay.id, {
            name: exercise.name.trim(),
            equipmentType: exercise.equipmentType,
            baseWeight: parseFloat(exercise.baseWeight) || 0,
            targetSets: parseInt(exercise.targetSets, 10) || 3,
            targetRepsMin: parseInt(exercise.targetRepsMin, 10) || 6,
            targetRepsMax: parseInt(exercise.targetRepsMax, 10) || 8,
            progressiveLoadingEnabled: exercise.progressiveLoadingEnabled,
            progressionIncrement: parseFloat(exercise.progressionIncrement) || 2.5,
            currentWeight: parseFloat(exercise.baseWeight) || 0,
          });
        }
      }

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      router.back();
    } catch {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', 'Failed to create schema. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderExercise = (
    dayId: string,
    exercise: LocalExercise,
    index: number,
    totalExercises: number
  ) => (
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
        <ThemedText type="defaultSemiBold" style={styles.exerciseNumber}>
          Exercise {index + 1}
        </ThemedText>
        <Pressable
          onPress={() => handleRemoveExercise(dayId, exercise.id)}
          hitSlop={8}
        >
          <IconSymbol name="trash" size={18} color={Colors.dark.error} />
        </Pressable>
      </View>

      <Input
        label="Name"
        placeholder="e.g., Bench Press"
        value={exercise.name}
        onChangeText={(text) =>
          handleUpdateExercise(dayId, exercise.id, { name: text })
        }
        error={validationErrors[`exercise_${exercise.id}_name`]}
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
                handleUpdateExercise(dayId, exercise.id, {
                  equipmentType: type.value,
                });
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
            value={exercise.targetSets}
            onChangeText={(text) =>
              handleUpdateExercise(dayId, exercise.id, { targetSets: text })
            }
            keyboardType="number-pad"
            error={validationErrors[`exercise_${exercise.id}_targetSets`]}
          />
        </View>
        <View style={styles.rowInputItem}>
          <Input
            label="Min Reps"
            placeholder="6"
            value={exercise.targetRepsMin}
            onChangeText={(text) =>
              handleUpdateExercise(dayId, exercise.id, { targetRepsMin: text })
            }
            keyboardType="number-pad"
            error={validationErrors[`exercise_${exercise.id}_targetRepsMin`]}
          />
        </View>
        <View style={styles.rowInputItem}>
          <Input
            label="Max Reps"
            placeholder="8"
            value={exercise.targetRepsMax}
            onChangeText={(text) =>
              handleUpdateExercise(dayId, exercise.id, { targetRepsMax: text })
            }
            keyboardType="number-pad"
            error={validationErrors[`exercise_${exercise.id}_targetRepsMax`]}
          />
        </View>
      </View>

      <Input
        label="Starting Weight (kg)"
        placeholder="0"
        value={exercise.baseWeight}
        onChangeText={(text) =>
          handleUpdateExercise(dayId, exercise.id, { baseWeight: text })
        }
        keyboardType="decimal-pad"
      />

      <IncrementSelector
        label="Progression Increment"
        value={exercise.progressionIncrement}
        onValueChange={(text) =>
          handleUpdateExercise(dayId, exercise.id, {
            progressionIncrement: text,
          })
        }
      />

      {progressiveLoadingEnabled && (
        <View style={styles.switchRow}>
          <ThemedText style={styles.switchLabel}>Progressive Overload</ThemedText>
          <Switch
            value={exercise.progressiveLoadingEnabled}
            onValueChange={(value) =>
              handleUpdateExercise(dayId, exercise.id, {
                progressiveLoadingEnabled: value,
              })
            }
            trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      )}
    </View>
  );

  const renderDay = (day: LocalWorkoutDay, index: number) => (
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
              index === days.length - 1 && styles.reorderButtonDisabled,
            ]}
            disabled={index === days.length - 1}
          >
            <IconSymbol
              name="chevron.down"
              size={16}
              color={index === days.length - 1 ? Colors.dark.border : Colors.dark.icon}
            />
          </Pressable>
        </View>
        <Pressable
          onPress={() => handleToggleDay(day.id)}
          style={styles.dayHeaderMain}
        >
          <View style={styles.dayHeaderLeft}>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={Colors.dark.icon}
              style={{ transform: [{ rotate: day.isExpanded ? '90deg' : '0deg' }] }}
            />
            <ThemedText type="defaultSemiBold" style={styles.dayTitle}>
              Day {index + 1}
              {day.name ? `: ${day.name}` : ''}
            </ThemedText>
          </View>
          <View style={styles.dayHeaderRight}>
            <ThemedText style={styles.exerciseCount}>
              {day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}
            </ThemedText>
          </View>
        </Pressable>
        <Pressable
          onPress={() => handleRemoveDay(day.id)}
          hitSlop={8}
          style={styles.removeDayButton}
        >
          <IconSymbol name="xmark.circle.fill" size={20} color={Colors.dark.error} />
        </Pressable>
      </View>

      {day.isExpanded && (
        <View style={styles.dayContent}>
          <Input
            label="Day Name"
            placeholder="e.g., Push Day, Leg Day"
            value={day.name}
            onChangeText={(text) => handleUpdateDayName(day.id, text)}
            error={validationErrors[`day_${day.id}_name`]}
          />

          {validationErrors[`day_${day.id}_exercises`] && day.exercises.length === 0 && (
            <ThemedText style={styles.errorText}>
              {validationErrors[`day_${day.id}_exercises`]}
            </ThemedText>
          )}

          {day.exercises.map((exercise, exerciseIndex) =>
            renderExercise(day.id, exercise, exerciseIndex, day.exercises.length)
          )}

          <View style={styles.addExerciseButtons}>
            <Pressable
              style={styles.addExerciseButton}
              onPress={() => handleOpenExerciseSelector(day.id)}
            >
              <IconSymbol name="list.bullet" size={18} color={Colors.dark.primary} />
              <ThemedText style={styles.addExerciseButtonText}>
                From Library
              </ThemedText>
            </Pressable>
            <Pressable
              style={styles.addExerciseButton}
              onPress={() => handleAddExercise(day.id)}
            >
              <IconSymbol name="plus" size={18} color={Colors.dark.primary} />
              <ThemedText style={styles.addExerciseButtonText}>
                Custom
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );

  return (
    <ThemedView style={styles.container}>
      <ExerciseSelectorModal
        visible={exerciseSelectorDayId !== null}
        onClose={() => setExerciseSelectorDayId(null)}
        onSelect={handleSelectExerciseFromLibrary}
      />
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
          {error && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Schema Details
            </ThemedText>
            <Input
              label="Name"
              placeholder="e.g., Push/Pull/Legs"
              value={schemaName}
              onChangeText={(text) => {
                setSchemaName(text);
                if (validationErrors.schemaName) {
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.schemaName;
                    return next;
                  });
                }
              }}
              error={validationErrors.schemaName}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <ThemedText style={styles.switchLabel}>Progressive Overload</ThemedText>
                <ThemedText style={styles.switchHint}>
                  Automatically increase weights when you hit your rep targets
                </ThemedText>
              </View>
              <Switch
                value={progressiveLoadingEnabled}
                onValueChange={setProgressiveLoadingEnabled}
                trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Workout Days
              </ThemedText>
              {validationErrors.days && days.length === 0 && (
                <ThemedText style={styles.errorText}>{validationErrors.days}</ThemedText>
              )}
            </View>

            {days.map((day, index) => renderDay(day, index))}

            <Button
              title="Add Workout Day"
              variant="secondary"
              onPress={handleAddDay}
              fullWidth
            />
          </View>

          <View style={styles.bottomActions}>
            <Button
              title="Create Schema"
              onPress={handleSave}
              loading={isSaving || isLoading}
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
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
    gap: 16,
  },
  sectionHeader: {
    gap: 4,
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
  exerciseContainer: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  exerciseReorderButtons: {
    flexDirection: 'column',
    gap: 0,
  },
  exerciseReorderButton: {
    padding: 2,
  },
  exerciseNumber: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    flex: 1,
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
  bottomActions: {
    marginTop: 8,
  },
  addExerciseButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addExerciseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
  },
  addExerciseButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.primary,
  },
});

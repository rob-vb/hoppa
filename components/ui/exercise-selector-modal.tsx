import { useState, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import {
  EXERCISE_LIBRARY,
  searchExercises,
  type ExerciseTemplate,
} from '@/constants/exercise-library';

interface ExerciseSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseTemplate) => void;
  onCreateCustom?: () => void;
}

export function ExerciseSelectorModal({
  visible,
  onClose,
  onSelect,
  onCreateCustom,
}: ExerciseSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const searchResults = useMemo(() => {
    if (searchQuery.trim()) {
      return searchExercises(searchQuery);
    }
    return null;
  }, [searchQuery]);

  const handleSelect = (exercise: ExerciseTemplate) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(exercise);
    setSearchQuery('');
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const toggleCategory = (categoryName: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const renderExerciseItem = (exercise: ExerciseTemplate) => (
    <Pressable
      key={exercise.name}
      style={({ pressed }) => [
        styles.exerciseItem,
        pressed && styles.exerciseItemPressed,
      ]}
      onPress={() => handleSelect(exercise)}
    >
      <View style={styles.exerciseInfo}>
        <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
        <View style={styles.exerciseMeta}>
          <View style={styles.equipmentBadge}>
            <ThemedText style={styles.equipmentText}>
              {exercise.equipmentType === 'plates'
                ? 'Barbell'
                : exercise.equipmentType === 'machine'
                  ? 'Machine'
                  : 'Other'}
            </ThemedText>
          </View>
          <ThemedText style={styles.exerciseDefaults}>
            {exercise.defaultSets}×{exercise.defaultRepsMin}-
            {exercise.defaultRepsMax}
          </ThemedText>
        </View>
      </View>
      <IconSymbol name="plus.circle" size={24} color={Colors.dark.primary} />
    </Pressable>
  );

  const renderSearchResults = () => {
    if (!searchResults || searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <IconSymbol
            name="magnifyingglass"
            size={48}
            color={Colors.dark.textSecondary}
          />
          <ThemedText style={styles.emptyText}>
            {searchQuery.trim()
              ? 'No exercises found'
              : 'Start typing to search'}
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.searchResults}>
        <ThemedText style={styles.resultCount}>
          {searchResults.length} exercise{searchResults.length !== 1 ? 's' : ''}{' '}
          found
        </ThemedText>
        {searchResults.map(renderExerciseItem)}
      </View>
    );
  };

  const renderCategories = () => (
    <View style={styles.categories}>
      {EXERCISE_LIBRARY.map((category) => {
        const isExpanded = expandedCategories.has(category.name);
        return (
          <View key={category.name} style={styles.categoryContainer}>
            <Pressable
              style={styles.categoryHeader}
              onPress={() => toggleCategory(category.name)}
            >
              <View style={styles.categoryHeaderLeft}>
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={Colors.dark.icon}
                  style={{
                    transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
                  }}
                />
                <ThemedText type="defaultSemiBold" style={styles.categoryName}>
                  {category.name}
                </ThemedText>
              </View>
              <ThemedText style={styles.categoryCount}>
                {category.exercises.length}
              </ThemedText>
            </Pressable>
            {isExpanded && (
              <View style={styles.categoryExercises}>
                {category.exercises.map(renderExerciseItem)}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>
            Select Exercise
          </ThemedText>
          <Pressable onPress={handleClose} hitSlop={8} style={styles.closeButton}>
            <IconSymbol
              name="xmark.circle.fill"
              size={28}
              color={Colors.dark.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <IconSymbol
              name="magnifyingglass"
              size={20}
              color={Colors.dark.placeholder}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={Colors.dark.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && Platform.OS !== 'ios' && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <IconSymbol
                  name="xmark.circle.fill"
                  size={18}
                  color={Colors.dark.placeholder}
                />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {onCreateCustom && (
            <Pressable
              style={({ pressed }) => [
                styles.createCustomButton,
                pressed && styles.createCustomButtonPressed,
              ]}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                onCreateCustom();
              }}
            >
              <View style={styles.createCustomLeft}>
                <IconSymbol name="plus.circle.fill" size={24} color={Colors.dark.primary} />
                <View>
                  <ThemedText type="defaultSemiBold" style={styles.createCustomTitle}>
                    Create Custom Exercise
                  </ThemedText>
                  <ThemedText style={styles.createCustomSubtitle}>
                    Add an exercise not in the library
                  </ThemedText>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color={Colors.dark.icon} />
            </Pressable>
          )}
          {searchQuery.trim() ? renderSearchResults() : renderCategories()}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  title: {
    fontSize: 20,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.dark.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  createCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.primary + '40',
    borderStyle: 'dashed',
  },
  createCustomButtonPressed: {
    backgroundColor: Colors.dark.border,
  },
  createCustomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createCustomTitle: {
    fontSize: 16,
  },
  createCustomSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  searchResults: {
    paddingHorizontal: 16,
    gap: 8,
  },
  resultCount: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  categories: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryName: {
    fontSize: 16,
  },
  categoryCount: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  categoryExercises: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.dark.surface,
  },
  exerciseItemPressed: {
    backgroundColor: Colors.dark.border,
  },
  exerciseInfo: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    fontSize: 16,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  equipmentBadge: {
    backgroundColor: Colors.dark.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  equipmentText: {
    fontSize: 12,
    color: Colors.dark.primary,
  },
  exerciseDefaults: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});

import { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import {
  EXERCISE_LIBRARY,
  searchExercises,
  type ExerciseTemplate,
} from '@/constants/exercise-library';

export default function ExerciseLibraryScreen() {
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

  const totalExercises = useMemo(
    () => EXERCISE_LIBRARY.reduce((sum, cat) => sum + cat.exercises.length, 0),
    []
  );

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

  const handleExpandAll = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (expandedCategories.size === EXERCISE_LIBRARY.length) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(EXERCISE_LIBRARY.map((cat) => cat.name)));
    }
  };

  const renderExerciseItem = (exercise: ExerciseTemplate, index: number, isLast: boolean) => (
    <View
      key={exercise.name}
      style={[
        styles.exerciseItem,
        !isLast && styles.exerciseItemBorder,
      ]}
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
            {exercise.defaultRepsMax} reps
          </ThemedText>
          {exercise.defaultWeight > 0 && (
            <ThemedText style={styles.exerciseDefaults}>
              · {exercise.defaultWeight} kg
            </ThemedText>
          )}
        </View>
      </View>
    </View>
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

    // Group search results by category for better organization
    const groupedResults = searchResults.reduce((acc, exercise) => {
      if (!acc[exercise.category]) {
        acc[exercise.category] = [];
      }
      acc[exercise.category].push(exercise);
      return acc;
    }, {} as Record<string, ExerciseTemplate[]>);

    return (
      <View style={styles.searchResults}>
        <ThemedText style={styles.resultCount}>
          {searchResults.length} exercise{searchResults.length !== 1 ? 's' : ''}{' '}
          found
        </ThemedText>
        {Object.entries(groupedResults).map(([category, exercises]) => (
          <View key={category} style={styles.searchCategoryContainer}>
            <ThemedText style={styles.searchCategoryLabel}>{category}</ThemedText>
            <View style={styles.searchCategoryExercises}>
              {exercises.map((exercise, index) =>
                renderExerciseItem(exercise, index, index === exercises.length - 1)
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderCategories = () => (
    <View style={styles.categories}>
      <View style={styles.categoriesHeader}>
        <ThemedText style={styles.categoriesTitle}>
          {totalExercises} exercises in {EXERCISE_LIBRARY.length} categories
        </ThemedText>
        <Pressable onPress={handleExpandAll} hitSlop={8}>
          <ThemedText style={styles.expandAllText}>
            {expandedCategories.size === EXERCISE_LIBRARY.length
              ? 'Collapse all'
              : 'Expand all'}
          </ThemedText>
        </Pressable>
      </View>
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
                {category.exercises.length} exercise{category.exercises.length !== 1 ? 's' : ''}
              </ThemedText>
            </Pressable>
            {isExpanded && (
              <View style={styles.categoryExercises}>
                {category.exercises.map((exercise, index) =>
                  renderExerciseItem(exercise, index, index === category.exercises.length - 1)
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
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
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searchQuery.trim() ? renderSearchResults() : renderCategories()}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
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
    paddingTop: 16,
    gap: 16,
  },
  resultCount: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  searchCategoryContainer: {
    gap: 8,
  },
  searchCategoryLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchCategoryExercises: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categories: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoriesTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  expandAllText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '500',
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
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  exerciseItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  exerciseInfo: {
    gap: 4,
  },
  exerciseName: {
    fontSize: 16,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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

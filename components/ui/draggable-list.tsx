import React, { useCallback, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface DraggableItemProps<T> {
  item: T;
  index: number;
  itemHeight: number;
  isDragging: boolean;
  activeIndex: SharedValue<number>;
  translateY: SharedValue<number>;
  itemsLength: number;
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
}

function DraggableItem<T>({
  item,
  index,
  itemHeight,
  isDragging,
  activeIndex,
  translateY,
  itemsLength,
  renderItem,
  onDragEnd,
}: DraggableItemProps<T>) {
  const isActive = useSharedValue(false);
  const startY = useSharedValue(0);
  const currentTranslateY = useSharedValue(0);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      onDragEnd(fromIndex, toIndex);
    },
    [onDragEnd]
  );

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart(() => {
      isActive.value = true;
      activeIndex.value = index;
      startY.value = 0;
      runOnJS(triggerHaptic)();
    })
    .onUpdate((event) => {
      currentTranslateY.value = event.translationY;
      translateY.value = event.translationY;

      // Calculate new position
      const newIndex = Math.round(
        Math.max(0, Math.min(itemsLength - 1, index + event.translationY / itemHeight))
      );

      if (newIndex !== activeIndex.value && newIndex !== index) {
        activeIndex.value = newIndex;
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      const toIndex = Math.round(
        Math.max(0, Math.min(itemsLength - 1, index + currentTranslateY.value / itemHeight))
      );

      isActive.value = false;
      currentTranslateY.value = 0;
      translateY.value = 0;

      if (toIndex !== index) {
        runOnJS(handleDragEnd)(index, toIndex);
      }

      activeIndex.value = -1;
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isBeingDragged = isActive.value;
    const activeIdx = activeIndex.value;

    if (isBeingDragged) {
      return {
        transform: [{ translateY: currentTranslateY.value }, { scale: 1.02 }],
        zIndex: 1000,
        shadowOpacity: withSpring(0.3),
        elevation: 10,
      };
    }

    // Calculate offset when another item is being dragged
    let offset = 0;
    if (activeIdx >= 0 && activeIdx !== index) {
      const draggedPosition = activeIdx + translateY.value / itemHeight;
      if (index > activeIdx && index <= draggedPosition) {
        offset = -itemHeight;
      } else if (index < activeIdx && index >= draggedPosition) {
        offset = itemHeight;
      }
    }

    return {
      transform: [{ translateY: withSpring(offset, { damping: 20, stiffness: 200 }) }, { scale: 1 }],
      zIndex: 0,
      shadowOpacity: withTiming(0),
      elevation: 0,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.itemContainer, animatedStyle]}>
        {renderItem(item, index, isDragging)}
      </Animated.View>
    </GestureDetector>
  );
}

interface DraggableListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
  onReorder: (items: T[]) => void;
  itemHeight: number;
  style?: ViewStyle;
}

export function DraggableList<T>({
  items,
  keyExtractor,
  renderItem,
  onReorder,
  itemHeight,
  style,
}: DraggableListProps<T>) {
  const activeIndex = useSharedValue(-1);
  const translateY = useSharedValue(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newItems = [...itemsRef.current];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      onReorder(newItems);
    },
    [onReorder]
  );

  const memoizedItems = useMemo(() => {
    return items.map((item, index) => ({
      item,
      key: keyExtractor(item),
      index,
    }));
  }, [items, keyExtractor]);

  return (
    <View style={[styles.container, style]}>
      {memoizedItems.map(({ item, key, index }) => (
        <DraggableItem
          key={key}
          item={item}
          index={index}
          itemHeight={itemHeight}
          isDragging={false}
          activeIndex={activeIndex}
          translateY={translateY}
          itemsLength={items.length}
          renderItem={renderItem}
          onDragEnd={handleDragEnd}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  itemContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    backgroundColor: 'transparent',
  },
});

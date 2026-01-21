import { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const SIDEBAR_WIDTH = 280;

export type SidebarItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  items: SidebarItem[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export function Sidebar({ isOpen, onClose, items, header, footer }: SidebarProps) {
  const router = useRouter();
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const backgroundColor = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, translateX, overlayOpacity]);

  const handleItemPress = (href: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
    router.push(href as never);
  };

  const handleOverlayPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.overlay,
          { opacity: overlayOpacity },
        ]}
      >
        <Pressable style={styles.overlayPressable} onPress={handleOverlayPress} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sidebar,
          {
            backgroundColor,
            borderRightColor: borderColor,
            transform: [{ translateX }],
          },
        ]}
      >
        {header && (
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            {header}
          </View>
        )}

        <View style={styles.content}>
          {items.map((item, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.item,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => handleItemPress(item.href)}
            >
              {item.icon && <View style={styles.itemIcon}>{item.icon}</View>}
              <ThemedText style={[styles.itemLabel, { color: textColor }]}>
                {item.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {footer && (
          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            {footer}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayPressable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemIcon: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
});

import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type CardProps = ViewProps & {
  onPress?: () => void;
  variant?: 'default' | 'outlined';
};

export function Card({
  children,
  onPress,
  variant = 'default',
  style,
  ...rest
}: CardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: variant === 'outlined' ? colors.border : 'transparent',
      borderWidth: variant === 'outlined' ? 1 : 0,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          ...cardStyle,
          pressed && { opacity: 0.8 },
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
  },
});

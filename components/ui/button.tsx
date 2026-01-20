import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const handlePress = (event: any) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(event);
  };

  const getBackgroundColor = (pressed: boolean) => {
    if (disabled || loading) {
      return variant === 'primary' ? colors.primary + '80' : 'transparent';
    }
    switch (variant) {
      case 'primary':
        return pressed ? colors.primary + 'CC' : colors.primary;
      case 'secondary':
        return pressed ? colors.surface : 'transparent';
      case 'ghost':
        return pressed ? colors.surface : 'transparent';
      default:
        return colors.primary;
    }
  };

  const getBorderColor = () => {
    if (variant === 'secondary') {
      return disabled ? colors.border + '80' : colors.border;
    }
    return 'transparent';
  };

  const getTextColor = () => {
    if (variant === 'primary') {
      return '#FFFFFF';
    }
    return disabled ? colors.textSecondary : colors.text;
  };

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 },
    md: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 16 },
    lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 18 },
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: getBackgroundColor(pressed),
          borderColor: getBorderColor(),
          borderWidth: variant === 'secondary' ? 1 : 0,
          paddingVertical: sizeStyles[size].paddingVertical,
          paddingHorizontal: sizeStyles[size].paddingHorizontal,
        },
        fullWidth && styles.fullWidth,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : colors.primary}
        />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: getTextColor(),
              fontSize: sizeStyles[size].fontSize,
            },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontWeight: '600',
  },
});

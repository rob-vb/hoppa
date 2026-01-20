import { Stack, useRouter, usePathname } from 'expo-router';
import { Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

export default function HistoryLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const isCalendarView = pathname === '/(history)/calendar';

  const handleToggleView = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isCalendarView) {
      router.replace('/(history)');
    } else {
      router.push('/(history)/calendar');
    }
  };

  const headerRight = () => (
    <Pressable onPress={handleToggleView} hitSlop={8} style={{ padding: 4 }}>
      <IconSymbol
        name={isCalendarView ? 'list.bullet' : 'calendar'}
        size={22}
        color={Colors.dark.primary}
      />
    </Pressable>
  );

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1C1C1E',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: '#1C1C1E',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'History',
          headerRight,
        }}
      />
      <Stack.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerRight,
        }}
      />
      <Stack.Screen
        name="[sessionId]"
        options={{
          title: 'Workout Details',
        }}
      />
    </Stack>
  );
}

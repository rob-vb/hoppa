import { Stack } from 'expo-router';

export default function HistoryLayout() {
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
        }}
      />
    </Stack>
  );
}

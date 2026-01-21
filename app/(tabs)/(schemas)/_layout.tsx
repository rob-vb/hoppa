import { Stack } from 'expo-router';

export default function SchemasLayout() {
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
          title: 'Schemas',
        }}
      />
      <Stack.Screen
        name="create"
        options={{
          title: 'Create Schema',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Schema Details',
        }}
      />
      <Stack.Screen
        name="ai-import"
        options={{
          title: 'Import Schema',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="ai-review"
        options={{
          title: 'Review Imported Schema',
        }}
      />
      <Stack.Screen
        name="library"
        options={{
          title: 'Exercise Library',
        }}
      />
    </Stack>
  );
}

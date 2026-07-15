import { Stack } from 'expo-router';
import { CC } from '@/components/coiffeur/theme';

export default function CoiffeurLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: CC.cream },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="planning" />
      <Stack.Screen name="prestations" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="equipe" />
      <Stack.Screen name="avis" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="parametres" />
    </Stack>
  );
}

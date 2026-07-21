import { Stack, useSegments } from 'expo-router';
import { CC } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';
import CoiffeurIPadLayout from '@/components/coiffeur/CoiffeurIPadLayout';
import { CoiffeurRoute } from '@/components/coiffeur/CoiffeurDrawer';
import { CoiffeurProfileProvider } from '@/contexts/CoiffeurProfileContext';

const NAV_ROUTES: CoiffeurRoute[] = [
  'dashboard',
  'planning',
  'prestations',
  'clients',
  'equipe',
  'avis',
  'notifications',
  'parametres',
];

export default function CoiffeurLayout() {
  const isTablet = useIsTablet();
  const segments = useSegments();
  const lastSegment = segments[segments.length - 1];
  const active = NAV_ROUTES.includes(lastSegment as CoiffeurRoute) ? (lastSegment as CoiffeurRoute) : null;

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: CC.cream },
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          presentation: 'transparentModal',
          headerShown: false,
          animation: 'fade',
        }}
      />
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

  if (!isTablet || !active) {
    return <CoiffeurProfileProvider>{stack}</CoiffeurProfileProvider>;
  }

  return (
    <CoiffeurProfileProvider>
      <CoiffeurIPadLayout active={active}>{stack}</CoiffeurIPadLayout>
    </CoiffeurProfileProvider>
  );
}

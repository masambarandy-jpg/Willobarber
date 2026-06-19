import { Platform } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants';

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name="login"
        options={Platform.OS === 'web'
          ? {
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
            }
          : {
              presentation: 'transparentModal',
              animation: 'none',
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }
        }
      />
      <Stack.Screen name="register" />
    </Stack>
  );
}

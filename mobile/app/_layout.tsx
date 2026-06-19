import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  CormorantGaramond_300Light,
  CormorantGaramond_300Light_Italic,
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import { Platform } from 'react-native';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import { Colors } from '@/constants';

SplashScreen.preventAutoHideAsync();

function RootNavigation() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="(auth)/login"
          options={Platform.OS === 'web'
            ? { headerShown: false }
            : { presentation: 'transparentModal', animation: 'slide_from_bottom', headerShown: false }
          }
        />
        <Stack.Screen name="(tabs)" options={{ title: 'WilloBarber' }} />
        <Stack.Screen name="(booking)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_300Light_Italic,
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
    CormorantGaramond_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AuthModalProvider>
          <RootNavigation />
        </AuthModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

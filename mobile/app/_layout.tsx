import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import { CartProvider } from '@/contexts/CartContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StripeWrapper } from '@/components/booking/StripeWrapper';
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
        <Stack.Screen name="(tabs)" options={{ title: 'WilloBarber' }} />
        <Stack.Screen name="(booking)" />
        <Stack.Screen name="cart" options={{ headerShown: false }} />
        <Stack.Screen
          name="coiffeur"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            animation: 'fade',
          }}
        />
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
    // SafeAreaProvider doit englober l'app pour que SafeAreaView /
    // useSafeAreaInsets (CoiffeurTopBar, book.tsx, catalogue.tsx) mesurent de
    // vrais insets — sans lui, ils retombent silencieusement sur 0 partout.
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StripeWrapper>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <AuthModalProvider>
                  <RootNavigation />
                </AuthModalProvider>
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </StripeWrapper>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

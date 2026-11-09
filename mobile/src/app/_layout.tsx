
import { useEffect, useState } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { restoreSession, subscribeAuthState } from '@/api/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const [sessionChecked, setSessionChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeAuthState(setAuthenticated);

    restoreSession()
      .then(setAuthenticated)
      .catch((error) => {
        console.error('Не удалось восстановить сессию:', error);
        setAuthenticated(false);
      })
      .finally(() => setSessionChecked(true));

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!sessionChecked || !navigationState?.key) {
      return;
    }

    const currentRoute = segments[0];

    // Экраны, доступные без авторизации.
    const isPublicAuthScreen =
      currentRoute === 'login' ||
      currentRoute === 'register' ||
      currentRoute === 'register-coach';

    if (!authenticated && !isPublicAuthScreen) {
      router.replace('/login');
      return;
    }

    // Авторизованному пользователю не нужны экраны авторизации.
    if (authenticated && isPublicAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [
    authenticated,
    navigationState?.key,
    router,
    segments,
    sessionChecked,
  ]);

  useEffect(() => {
    if (sessionChecked) {
      void SplashScreen.hideAsync();
    }
  }, [sessionChecked]);

  if (!sessionChecked) {
    return null;
  }

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <AnimatedSplashOverlay />

      <Stack>
        <Stack.Screen
          name="login"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="register"
          options={{
            title: 'Регистрация',
            headerBackTitle: 'Назад',
          }}
        />

        <Stack.Screen
          name="register-coach"
          options={{
            title: 'Регистрация тренера',
            headerBackTitle: 'Назад',
          }}
        />

        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="training-details"
          options={{ title: 'Тренировка' }}
        />
      </Stack>
    </ThemeProvider>
  );
}

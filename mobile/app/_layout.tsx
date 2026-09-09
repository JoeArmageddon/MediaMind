import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setClerkTokenGetter, setCurrentUserIdGetter } from '../lib/supabase';
import { useMediaStore } from '../store/mediaStore';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';

// Clerk's documented Expo token-cache interface (getToken/saveToken) backed
// by SecureStore - hand-rolled rather than relying on a specific package
// export existing, since that's shifted across Clerk Expo SDK versions.
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore
    }
  },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY - check mobile/.env');
}

// Wires Clerk's auth state into the Supabase client's accessToken/user-id
// bridges (see lib/supabase.ts - React Native has no window.Clerk global
// the way the web app reads from) and redirects between the (auth) and
// (tabs) route groups based on sign-in state - the Expo Router equivalent
// of the web app's middleware.ts route protection.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    setClerkTokenGetter(isSignedIn ? () => getToken() : async () => null);
    setCurrentUserIdGetter(() => userId ?? undefined);
  }, [isSignedIn, userId, getToken]);

  // Chunk B: drain the offline sync queue and re-fetch the moment
  // connectivity actually comes back, rather than only ever syncing on
  // the next manual pull-to-refresh/screen open - a queued add/update/
  // delete otherwise sits queued indefinitely if the app stays foregrounded
  // through a reconnect. Edge-triggered (offline -> online only) via a
  // ref, not every emission NetInfo happens to fire.
  const wasOffline = useRef(false);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      if (online && wasOffline.current && isSignedIn) {
        useMediaStore.getState().fetchMedia();
      }
      wasOffline.current = !online;
    });
    return unsubscribe;
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (isSignedIn && inAuthGroup) {
      router.replace('/');
    }
  }, [isLoaded, isSignedIn, segments, router]);

  if (!isLoaded) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return <>{children}</>;
}

function ThemedStack() {
  const { theme, mode } = useTheme();

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="media/[id]" options={{ title: '' }} />
      </Stack>
      <StatusBar style={mode === 'manga' ? 'dark' : 'light'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeProvider>
        <SafeAreaProvider>
          <AuthGate>
            <ThemedStack />
          </AuthGate>
        </SafeAreaProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}

import { useEffect, useRef, useState } from 'react';
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
import { checkBetaStatus } from '../lib/betaStatus';

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

  // Beta approval gate - the mobile equivalent of web's middleware.ts +
  // /pending redirect, same Clerk publicMetadata.betaApproved flag (see
  // lib/betaStatus.ts). Checked once per sign-in, not on every
  // navigation - /pending itself polls for a live approval while the
  // user is actually sitting there waiting (see app/pending.tsx); this
  // effect only decides where a freshly-signed-in session lands.
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    if (!isSignedIn) {
      setApprovalChecked(false);
      setApproved(false);
      return;
    }
    let cancelled = false;
    checkBetaStatus().then((status) => {
      if (!cancelled) {
        setApproved(status.approved);
        setApprovalChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

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
    const onPending = segments[0] === 'pending';

    if (!isSignedIn) {
      if (!inAuthGroup) router.replace('/sign-in');
      return;
    }

    if (inAuthGroup) {
      router.replace('/');
      return;
    }

    if (!approvalChecked) return; // wait for the check below before deciding

    if (!approved && !onPending) {
      router.replace('/pending');
    } else if (approved && onPending) {
      router.replace('/');
    }
  }, [isLoaded, isSignedIn, approvalChecked, approved, segments, router]);

  if (!isLoaded || (isSignedIn && !approvalChecked)) {
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
        <Stack.Screen name="pending" options={{ headerShown: false, gestureEnabled: false }} />
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

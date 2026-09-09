import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/ThemeContext';
import { checkBetaStatus } from '../lib/betaStatus';
import type { ThemePalette } from '../lib/theme';

// Waiting-room screen for a signed-in-but-not-yet-approved account - the
// mobile equivalent of web's /pending (see src/app/pending/page.tsx).
// AuthGate (app/_layout.tsx) redirects here; this screen redirects itself
// back out to '/' the moment an approval check comes back true, either
// from the user tapping "Check again" or the 30s background poll below.
const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_API_URL?.trim();

export default function PendingScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { signOut } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [hasApplied, setHasApplied] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const status = await checkBetaStatus();
      setHasApplied(status.hasApplied ?? null);
      if (status.approved) {
        router.replace('/');
      }
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're on the list</Text>
      <Text style={styles.body}>
        MediaMind is in a small, invite-only beta right now. Your account is signed in but not yet
        approved.
      </Text>

      {hasApplied === false && (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            We don't see an application for this email yet - apply on the web to get reviewed.
          </Text>
        </View>
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => WEB_ORIGIN && Linking.openURL(`${WEB_ORIGIN}/apply`)}
      >
        <Text style={styles.primaryButtonText}>Apply for beta access</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={check} disabled={checking}>
        {checking ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <Text style={styles.secondaryButtonText}>Check again</Text>
        )}
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 16,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '900',
      textAlign: 'center',
    },
    body: {
      color: theme.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    noticeCard: {
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      padding: 14,
    },
    noticeText: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 24,
      width: '100%',
      alignItems: 'center',
      marginTop: 8,
    },
    primaryButtonText: {
      color: theme.primaryText,
      fontSize: 14,
      fontWeight: '700',
    },
    secondaryButton: {
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 24,
      width: '100%',
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    signOutButton: {
      paddingVertical: 10,
    },
    signOutText: {
      color: theme.danger,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}

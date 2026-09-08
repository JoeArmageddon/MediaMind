import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { useSSO } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useWarmUpBrowser } from '../lib/useWarmUpBrowser';
import { useTheme } from '../lib/ThemeContext';
import type { ThemePalette } from '../lib/theme';

// Shared by both sign-in and sign-up (OAuth doesn't distinguish the two -
// Clerk creates the account automatically on first sign-in with a new
// provider identity). Only Apple is gated to iOS; Google shows everywhere.
export function OAuthButtons() {
  useWarmUpBrowser();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { startSSOFlow } = useSSO();
  const [loadingStrategy, setLoadingStrategy] = useState<'oauth_google' | 'oauth_apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (strategy: 'oauth_google' | 'oauth_apple') => {
    setError(null);
    setLoadingStrategy(strategy);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
      // No createdSessionId with no error thrown usually means the flow
      // needs another step (e.g. MFA) - not handled in this build yet.
    } catch (err: any) {
      console.error('OAuth error:', err);
      setError(err?.errors?.[0]?.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoadingStrategy(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.button}
        onPress={() => handleOAuth('oauth_google')}
        disabled={loadingStrategy !== null}
      >
        {loadingStrategy === 'oauth_google' ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color={theme.text} />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </>
        )}
      </Pressable>

      {Platform.OS === 'ios' && (
        <Pressable
          style={styles.button}
          onPress={() => handleOAuth('oauth_apple')}
          disabled={loadingStrategy !== null}
        >
          {loadingStrategy === 'oauth_apple' ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <>
              <Ionicons name="logo-apple" size={18} color={theme.text} />
              <Text style={styles.buttonText}>Continue with Apple</Text>
            </>
          )}
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      gap: 10,
      marginBottom: 8,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingVertical: 13,
    },
    buttonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    error: {
      color: theme.danger,
      fontSize: 13,
      textAlign: 'center',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 6,
    },
    dividerLine: {
      flex: 1,
      height: theme.borderWidth,
      backgroundColor: theme.cardBorder,
    },
    dividerText: {
      color: theme.textFaint,
      fontSize: 12,
    },
  });
}

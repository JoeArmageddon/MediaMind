import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
// This @clerk/expo version's default export moved useSignIn/useSignUp to a
// new Signals-based ("Future") API - the classic {isLoaded, signIn,
// setActive} shape this file uses lives under the /legacy subpath now.
import { useSignIn } from '@clerk/expo/legacy';
import { OAuthButtons } from '../../components/OAuthButtons';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';

export default function SignInScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!isLoaded) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        // Chunk A supports the email+password happy path only - 2FA/other
        // strategies would need handling result.status here.
        setError('Additional verification is required - not supported in this build yet.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message || e?.message || 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>MEDIA MIND</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <OAuthButtons />

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.textFaint}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.textFaint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={isSubmitting || !email || !password}
        >
          {isSubmitting ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>

        <Link href="/sign-up" style={styles.link}>
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    title: {
      color: theme.text,
      fontSize: 36,
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: -1,
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 32,
    },
    form: {
      gap: 12,
    },
    input: {
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: theme.text,
      fontSize: 15,
    },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: theme.primaryText,
      fontSize: 15,
      fontWeight: '700',
    },
    error: {
      color: theme.danger,
      fontSize: 13,
    },
    link: {
      marginTop: 16,
      alignSelf: 'center',
    },
    linkText: {
      color: theme.primary,
      fontSize: 13,
    },
  });
}

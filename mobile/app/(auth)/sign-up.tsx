import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
// See sign-in.tsx's comment - the classic {isLoaded, signUp, setActive}
// shape lives under /legacy in this @clerk/expo version.
import { useSignUp } from '@clerk/expo/legacy';
import { OAuthButtons } from '../../components/OAuthButtons';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';

export default function SignUpScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    if (!isLoaded) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (e: any) {
      setError(e?.errors?.[0]?.message || e?.message || 'Sign up failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        setError('Verification incomplete - double-check the code.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message || e?.message || 'Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>CHECK YOUR EMAIL</Text>
        <Text style={styles.subtitle}>Enter the code we sent to {email}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Verification code"
            placeholderTextColor={theme.textFaint}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={isSubmitting || !code}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.primaryText} />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>MEDIA MIND</Text>
      <Text style={styles.subtitle}>Create your account</Text>

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
          autoComplete="password-new"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={isSubmitting || !email || !password}
        >
          {isSubmitting ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </Pressable>

        <Link href="/sign-in" style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
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

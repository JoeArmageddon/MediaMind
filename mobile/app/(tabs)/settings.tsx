import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { useAuth, useUser } from '@clerk/expo';
import { getStoredApiKey, saveApiKey } from '../../lib/apiKeys';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';

export default function SettingsScreen() {
  const { theme, mode, toggleMode } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { signOut } = useAuth();
  const { user } = useUser();

  const [tmdbKey, setTmdbKey] = useState('');
  const [rawgKey, setRawgKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  useEffect(() => {
    getStoredApiKey('tmdb_key').then(setTmdbKey);
    getStoredApiKey('rawg_key').then(setRawgKey);
    getStoredApiKey('groq_key').then(setGroqKey);
    getStoredApiKey('gemini_key').then(setGeminiKey);
  }, []);

  const handleSaveKeys = async () => {
    await saveApiKey('tmdb_key', tmdbKey);
    await saveApiKey('rawg_key', rawgKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveAIKeys = async () => {
    await saveApiKey('groq_key', groqKey);
    await saveApiKey('gemini_key', geminiKey);
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 2000);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account</Text>
        <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress}</Text>
        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Appearance</Text>
        <View style={styles.mangaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mangaTitle}>Manga Mode</Text>
            <Text style={styles.cardHint}>Paper-white, bold ink borders, single accent color.</Text>
          </View>
          <Switch
            value={mode === 'manga'}
            onValueChange={toggleMode}
            trackColor={{ false: theme.cardBorder, true: theme.primary }}
            thumbColor={theme.isManga ? theme.primaryText : '#fff'}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>API Keys</Text>
        <Text style={styles.cardHint}>
          Optional - only needed if you want your own rate limits instead of the app's bundled defaults.
        </Text>

        <Text style={styles.fieldLabel}>TMDB API Key</Text>
        <TextInput
          style={styles.input}
          value={tmdbKey}
          onChangeText={setTmdbKey}
          placeholder="Leave blank to use the default"
          placeholderTextColor={theme.textFaint}
          autoCapitalize="none"
        />

        <Text style={styles.fieldLabel}>RAWG API Key</Text>
        <TextInput
          style={styles.input}
          value={rawgKey}
          onChangeText={setRawgKey}
          placeholder="Leave blank to use the default"
          placeholderTextColor={theme.textFaint}
          autoCapitalize="none"
        />

        <Pressable style={styles.saveButton} onPress={handleSaveKeys}>
          <Text style={styles.saveButtonText}>{saved ? 'Saved' : 'Save Keys'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>AI (Groq / Gemini)</Text>
        <Text style={styles.cardHint}>
          Powers recommendations, burnout check, AI collections, and title analysis. A bundled Gemini
          key is included by default - add your own for higher rate limits, or a Groq key (used first
          when set) for faster responses.
        </Text>

        <Text style={styles.fieldLabel}>Groq API Key</Text>
        <TextInput
          style={styles.input}
          value={groqKey}
          onChangeText={setGroqKey}
          placeholder="Optional - no bundled default"
          placeholderTextColor={theme.textFaint}
          autoCapitalize="none"
        />

        <Text style={styles.fieldLabel}>Gemini API Key</Text>
        <TextInput
          style={styles.input}
          value={geminiKey}
          onChangeText={setGeminiKey}
          placeholder="Leave blank to use the default"
          placeholderTextColor={theme.textFaint}
          autoCapitalize="none"
        />

        <Pressable style={styles.saveButton} onPress={handleSaveAIKeys}>
          <Text style={styles.saveButtonText}>{aiSaved ? 'Saved' : 'Save AI Keys'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      padding: 16,
      gap: 16,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      padding: 16,
      gap: 8,
    },
    cardLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardHint: {
      color: theme.textFaint,
      fontSize: 12,
      marginBottom: 4,
    },
    email: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
    },
    signOutButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.isManga ? 'rgba(176,0,32,0.08)' : 'rgba(239,68,68,0.15)',
    },
    signOutText: {
      color: theme.danger,
      fontSize: 13,
      fontWeight: '700',
    },
    mangaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    mangaTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    fieldLabel: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 8,
    },
    input: {
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    saveButton: {
      marginTop: 12,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    saveButtonText: {
      color: theme.primaryText,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}

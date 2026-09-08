import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMediaStore } from '../store/mediaStore';
import { supabase, getCurrentUserId } from '../lib/supabase';
import { getAIClient } from '../lib/ai';
import { useTheme } from '../lib/ThemeContext';
import type { ThemePalette } from '../lib/theme';
import type { AIRecommendation, AIBurnoutResult, HistoryEntry } from '../lib/types';

const RISK_COLORS: Record<AIBurnoutResult['risk_level'], 'success' | 'primary' | 'danger'> = {
  low: 'success',
  medium: 'primary',
  high: 'danger',
};

// Combines web's DiscoverDialog (Random + AI Pick tabs) and the Burnout
// Check section from src/app/analytics/page.tsx into one screen - mobile
// doesn't have a full charts-based Analytics screen yet (that's its own
// chunk, not part of this AI-features pass), so burnout detection - the
// one AI feature that lived there - gets a home here instead of being
// left unported.
export default function DiscoverScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { media } = useMediaStore();

  const [tab, setTab] = useState<'random' | 'ai' | 'burnout'>('random');

  const planned = media.filter((m) => m.status === 'planned');

  // --- Random ---
  const pickRandom = () => {
    if (planned.length === 0) return;
    const pick = planned[Math.floor(Math.random() * planned.length)];
    router.push(`/media/${pick.id}`);
  };

  // --- AI Pick ---
  const [mood, setMood] = useState('');
  const [minutes, setMinutes] = useState('');
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<AIRecommendation[] | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setIsRecommending(true);
    setRecError(null);
    try {
      const currentWatching = media.filter((m) => m.status === 'watching');
      const recentlyCompleted = media
        .filter((m) => m.status === 'completed' && m.completed_at)
        .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
        .slice(0, 10);

      const genreCounts = new Map<string, number>();
      for (const m of media) {
        for (const g of m.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
      const topGenres = Array.from(genreCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([g]) => g);

      const result = await getAIClient().getRecommendations(
        currentWatching,
        planned,
        recentlyCompleted,
        topGenres,
        mood.trim() || undefined,
        minutes ? Number(minutes) : undefined
      );

      if (result) {
        setRecommendations(result);
      } else {
        setRecError('AI recommendations are unavailable right now - check that a Groq or Gemini API key is set in Settings.');
      }
    } catch (e: any) {
      setRecError(e?.message || 'Failed to get recommendations.');
    } finally {
      setIsRecommending(false);
    }
  };

  // --- Burnout ---
  const [isCheckingBurnout, setIsCheckingBurnout] = useState(false);
  const [burnout, setBurnout] = useState<AIBurnoutResult | null>(null);
  const [burnoutError, setBurnoutError] = useState<string | null>(null);

  const checkBurnout = async () => {
    setIsCheckingBurnout(true);
    setBurnoutError(null);
    try {
      const currentUserId = getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('history')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;

      const genreCounts: Record<string, number> = {};
      for (const m of media) {
        for (const g of m.genres) genreCounts[g] = (genreCounts[g] ?? 0) + 1;
      }

      const result = await getAIClient().detectBurnout((data ?? []) as HistoryEntry[], genreCounts);
      if (result) {
        setBurnout(result);
      } else {
        setBurnoutError('Burnout detection is unavailable right now - check that a Groq or Gemini API key is set in Settings.');
      }
    } catch (e: any) {
      setBurnoutError(e?.message || 'Failed to check for burnout.');
    } finally {
      setIsCheckingBurnout(false);
    }
  };

  const riskColor = burnout ? theme[RISK_COLORS[burnout.risk_level]] : theme.primary;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Discover' }} />

      <View style={styles.segmentRow}>
        <Pressable style={[styles.segment, tab === 'random' && styles.segmentActive]} onPress={() => setTab('random')}>
          <Ionicons name="shuffle" size={14} color={tab === 'random' ? theme.primaryText : theme.textMuted} />
          <Text style={[styles.segmentText, tab === 'random' && styles.segmentTextActive]}>Random</Text>
        </Pressable>
        <Pressable style={[styles.segment, tab === 'ai' && styles.segmentActive]} onPress={() => setTab('ai')}>
          <Ionicons name="sparkles" size={14} color={tab === 'ai' ? theme.primaryText : theme.textMuted} />
          <Text style={[styles.segmentText, tab === 'ai' && styles.segmentTextActive]}>AI Pick</Text>
        </Pressable>
        <Pressable style={[styles.segment, tab === 'burnout' && styles.segmentActive]} onPress={() => setTab('burnout')}>
          <Ionicons name="flame" size={14} color={tab === 'burnout' ? theme.primaryText : theme.textMuted} />
          <Text style={[styles.segmentText, tab === 'burnout' && styles.segmentTextActive]}>Burnout</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'random' && (
          <View style={styles.card}>
            <Text style={styles.cardHint}>{planned.length} items available in your Planned list</Text>
            <Pressable
              style={[styles.primaryButton, planned.length === 0 && styles.primaryButtonDisabled]}
              onPress={pickRandom}
              disabled={planned.length === 0}
            >
              <Ionicons name="shuffle" size={16} color={theme.primaryText} />
              <Text style={styles.primaryButtonText}>Pick Random</Text>
            </Pressable>
          </View>
        )}

        {tab === 'ai' && (
          <View style={{ gap: 10 }}>
            <TextInput
              style={styles.input}
              value={mood}
              onChangeText={setMood}
              placeholder="Mood (optional, e.g. 'something light')"
              placeholderTextColor={theme.textFaint}
            />
            <TextInput
              style={styles.input}
              value={minutes}
              onChangeText={setMinutes}
              placeholder="Minutes available (optional)"
              placeholderTextColor={theme.textFaint}
              keyboardType="number-pad"
            />
            <Pressable
              style={[styles.primaryButton, styles.aiButton, isRecommending && styles.primaryButtonDisabled]}
              onPress={fetchRecommendations}
              disabled={isRecommending}
            >
              {isRecommending ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <Ionicons name="sparkles" size={16} color={theme.primaryText} />
              )}
              <Text style={styles.primaryButtonText}>Get Recommendations</Text>
            </Pressable>

            {recError && <Text style={styles.errorText}>{recError}</Text>}

            {recommendations?.map((rec, i) => (
              <View key={i} style={styles.resultCard}>
                <View style={styles.resultTopRow}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {rec.title}
                  </Text>
                  <Text style={styles.resultScore}>{Math.round(rec.fit_score)}% fit</Text>
                </View>
                <Text style={styles.resultReason}>{rec.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {tab === 'burnout' && (
          <View style={{ gap: 10 }}>
            <View style={styles.card}>
              <Text style={styles.cardHint}>
                Checks your last 30 library actions and genre spread for signs of burnout or repetitive tone.
              </Text>
              <Pressable
                style={[styles.primaryButton, styles.aiButton, isCheckingBurnout && styles.primaryButtonDisabled]}
                onPress={checkBurnout}
                disabled={isCheckingBurnout}
              >
                {isCheckingBurnout ? (
                  <ActivityIndicator color={theme.primaryText} />
                ) : (
                  <Ionicons name="flame" size={16} color={theme.primaryText} />
                )}
                <Text style={styles.primaryButtonText}>Check for Burnout</Text>
              </Pressable>
            </View>

            {burnoutError && <Text style={styles.errorText}>{burnoutError}</Text>}

            {burnout && (
              <View style={styles.card}>
                <View style={[styles.riskRow, { borderColor: riskColor, backgroundColor: `${riskColor}1A` }]}>
                  <Text style={[styles.riskLabel, { color: riskColor }]}>{burnout.risk_level} risk</Text>
                  <Text style={[styles.riskLabel, { color: riskColor }]}>
                    {burnout.burnout_detected ? 'Burnout detected' : 'No burnout detected'}
                  </Text>
                </View>
                <Text style={styles.burnoutLine}>
                  <Text style={styles.burnoutLineLabel}>Pattern: </Text>
                  {burnout.dominant_pattern}
                </Text>
                <Text style={styles.burnoutLine}>
                  <Text style={styles.burnoutLineLabel}>Suggested shift: </Text>
                  {burnout.suggested_shift}
                </Text>
                <Text style={styles.burnoutLine}>
                  <Text style={styles.burnoutLineLabel}>Try: </Text>
                  {burnout.recommended_genre_direction}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    segmentRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      borderRadius: 9,
    },
    segmentActive: {
      backgroundColor: theme.primary,
    },
    segmentText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: theme.primaryText,
    },
    content: {
      padding: 16,
      gap: 10,
    },
    card: {
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    cardHint: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    input: {
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: theme.text,
      fontSize: 14,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 13,
    },
    aiButton: {
      backgroundColor: theme.isManga ? theme.primary : theme.accent,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      color: theme.primaryText,
      fontSize: 14,
      fontWeight: '700',
    },
    errorText: {
      color: theme.danger,
      fontSize: 12,
      textAlign: 'center',
    },
    resultCard: {
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      padding: 12,
    },
    resultTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    resultTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    resultScore: {
      color: theme.isManga ? theme.primary : theme.accent,
      fontSize: 10,
      fontWeight: '700',
    },
    resultReason: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 4,
      lineHeight: 17,
    },
    riskRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    riskLabel: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    burnoutLine: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    burnoutLineLabel: {
      color: theme.text,
      fontWeight: '700',
    },
  });
}

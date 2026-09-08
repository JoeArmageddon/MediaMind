import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMediaStore } from '../../store/mediaStore';
import { getAIClient } from '../../lib/ai';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';
import type { MediaStatus } from '../../lib/types';

const STATUS_OPTIONS: { value: MediaStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'rewatching', label: 'Rewatching' },
];

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { media, updateMedia, deleteMedia } = useMediaStore();

  const item = useMemo(() => media.find((m) => m.id === id), [media, id]);

  const [progress, setProgress] = useState(item ? String(item.progress) : '0');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Not found.</Text>
      </View>
    );
  }

  const handleStatusChange = async (status: MediaStatus) => {
    try {
      await updateMedia(item.id, { status });
    } catch (e: any) {
      Alert.alert('Failed to update', e?.message || 'Something went wrong.');
    }
  };

  const handleToggleFavorite = async () => {
    try {
      await updateMedia(item.id, { is_favorite: !item.is_favorite });
    } catch (e: any) {
      Alert.alert('Failed to update', e?.message || 'Something went wrong.');
    }
  };

  const handleSaveProgress = async () => {
    const parsed = parseInt(progress, 10);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setIsSaving(true);
    try {
      const completion_percent =
        item.total_units > 0 ? Math.min(100, (parsed / item.total_units) * 100) : item.completion_percent;
      await updateMedia(item.id, { progress: parsed, completion_percent, notes: notes || null });
    } catch (e: any) {
      Alert.alert('Failed to save', e?.message || 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  const analyzeTone = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const analysis = await getAIClient().analyzeMedia({
        title: item.title,
        description: item.description,
        genres: item.genres,
      });
      if (analysis) {
        await updateMedia(item.id, {
          ai_primary_tone: analysis.primary_tone,
          ai_secondary_tone: analysis.secondary_tone,
          ai_core_themes: analysis.core_themes,
          ai_emotional_intensity: analysis.emotional_intensity,
          ai_pacing: analysis.pacing,
          ai_darkness_level: analysis.darkness_level,
          ai_intellectual_depth: analysis.intellectual_depth,
        });
      } else {
        setAnalysisError('Analysis is unavailable right now - check that a Groq or Gemini API key is set in Settings.');
      }
    } catch (e: any) {
      setAnalysisError(e?.message || 'Failed to analyze this title.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete this title?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            await deleteMedia(item.id);
            router.back();
          } catch (e: any) {
            setIsDeleting(false);
            Alert.alert('Failed to delete', e?.message || 'Something went wrong.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <Stack.Screen options={{ title: item.title }} />

      <View style={styles.header}>
        {item.poster_url ? (
          <Image source={{ uri: item.poster_url }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Text style={{ color: theme.textFaint, fontSize: 40, fontWeight: '900' }}>
              {item.title.charAt(0)}
            </Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{item.title}</Text>
          {item.release_year != null && <Text style={styles.meta}>{item.release_year}</Text>}
          <Text style={styles.meta}>{item.type.toUpperCase()}</Text>
          <Pressable style={styles.favoriteButton} onPress={handleToggleFavorite}>
            <Ionicons
              name={item.is_favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={item.is_favorite ? theme.danger : theme.textMuted}
            />
          </Pressable>
        </View>
      </View>

      {item.genres.length > 0 && (
        <View style={styles.chipRow}>
          {item.genres.map((g) => (
            <View key={g} style={styles.chip}>
              <Text style={styles.chipText}>{g}</Text>
            </View>
          ))}
        </View>
      )}

      {item.description && <Text style={styles.description}>{item.description}</Text>}

      <Text style={styles.sectionLabel}>AI Analysis</Text>
      {item.ai_primary_tone ? (
        <View style={styles.analysisBox}>
          <View style={styles.chipRow}>
            <View style={[styles.chip, styles.toneChip]}>
              <Text style={styles.toneChipText}>{item.ai_primary_tone}</Text>
            </View>
            {item.ai_secondary_tone && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{item.ai_secondary_tone}</Text>
              </View>
            )}
            {item.ai_pacing && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{item.ai_pacing} pacing</Text>
              </View>
            )}
          </View>
          {item.ai_core_themes.length > 0 && (
            <Text style={styles.analysisThemes}>{item.ai_core_themes.join(' · ')}</Text>
          )}
          <View style={styles.metricRow}>
            {item.ai_emotional_intensity != null && (
              <AnalysisMeter label="Emotional intensity" value={item.ai_emotional_intensity} theme={theme} />
            )}
            {item.ai_darkness_level != null && (
              <AnalysisMeter label="Darkness" value={item.ai_darkness_level} theme={theme} />
            )}
            {item.ai_intellectual_depth != null && (
              <AnalysisMeter label="Intellectual depth" value={item.ai_intellectual_depth} theme={theme} />
            )}
          </View>
          <Pressable style={styles.reanalyzeButton} onPress={analyzeTone} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <ActivityIndicator size="small" color={theme.textMuted} />
            ) : (
              <Text style={styles.reanalyzeButtonText}>Re-analyze</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.analyzeButton} onPress={analyzeTone} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color={theme.primaryText} />
              <Text style={styles.analyzeButtonText}>Analyze Tone &amp; Themes</Text>
            </>
          )}
        </Pressable>
      )}
      {analysisError && <Text style={styles.analysisErrorText}>{analysisError}</Text>}

      <Text style={styles.sectionLabel}>Status</Text>
      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.statusChip, item.status === opt.value && styles.statusChipActive]}
            onPress={() => handleStatusChange(opt.value)}
          >
            <Text style={[styles.statusChipText, item.status === opt.value && styles.statusChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>
        Progress {item.total_units > 0 ? `(of ${item.total_units})` : ''}
      </Text>
      <TextInput
        style={styles.input}
        value={progress}
        onChangeText={setProgress}
        keyboardType="number-pad"
      />

      <Text style={styles.sectionLabel}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Your notes..."
        placeholderTextColor={theme.textFaint}
      />

      <Pressable style={styles.saveButton} onPress={handleSaveProgress} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color={theme.primaryText} /> : <Text style={styles.saveButtonText}>Save</Text>}
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isDeleting}>
        {isDeleting ? (
          <ActivityIndicator color={theme.danger} />
        ) : (
          <Text style={styles.deleteButtonText}>Delete from Library</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// A single 0-100 metric as a labeled bar - used for the AI analysis's
// emotional intensity / darkness / intellectual depth scores.
function AnalysisMeter({ label, value, theme }: { label: string; value: number; theme: ThemePalette }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: theme.textMuted, fontSize: 10 }}>{label}</Text>
        <Text style={{ color: theme.textFaint, fontSize: 10 }}>{Math.round(clamped)}</Text>
      </View>
      <View
        style={{
          height: 5,
          borderRadius: 3,
          backgroundColor: theme.isManga ? 'rgba(22,19,17,0.1)' : 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: theme.primary, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    center: {
      flex: 1,
      backgroundColor: theme.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notFound: {
      color: theme.textMuted,
    },
    content: {
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      gap: 14,
    },
    poster: {
      width: 110,
      height: 156,
      borderRadius: 14,
    },
    posterFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
    },
    headerInfo: {
      flex: 1,
      justifyContent: 'center',
      gap: 4,
    },
    title: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    meta: {
      color: theme.textMuted,
      fontSize: 12,
    },
    favoriteButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 16,
    },
    chip: {
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: {
      color: theme.textMuted,
      fontSize: 11,
    },
    description: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 14,
    },
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 20,
      marginBottom: 8,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statusChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
    },
    statusChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    statusChipText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    statusChipTextActive: {
      color: theme.primaryText,
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
    notesInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    saveButton: {
      marginTop: 24,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButtonText: {
      color: theme.primaryText,
      fontSize: 15,
      fontWeight: '700',
    },
    deleteButton: {
      marginTop: 12,
      alignItems: 'center',
      paddingVertical: 12,
    },
    deleteButtonText: {
      color: theme.danger,
      fontSize: 13,
      fontWeight: '600',
    },
    analyzeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.isManga ? theme.primary : theme.accent,
      borderRadius: 12,
      paddingVertical: 13,
    },
    analyzeButtonText: {
      color: theme.primaryText,
      fontSize: 13,
      fontWeight: '700',
    },
    analysisBox: {
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 14,
      padding: 14,
    },
    toneChip: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    toneChipText: {
      color: theme.primaryText,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    analysisThemes: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 10,
      fontStyle: 'italic',
    },
    metricRow: {
      marginTop: 14,
    },
    reanalyzeButton: {
      marginTop: 6,
      alignSelf: 'flex-start',
    },
    reanalyzeButtonText: {
      color: theme.textFaint,
      fontSize: 11,
      textDecorationLine: 'underline',
    },
    analysisErrorText: {
      color: theme.danger,
      fontSize: 12,
      marginTop: 8,
    },
  });
}

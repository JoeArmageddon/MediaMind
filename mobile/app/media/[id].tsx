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
  });
}

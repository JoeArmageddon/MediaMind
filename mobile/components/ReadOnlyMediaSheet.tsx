import { useState } from 'react';
import { View, Text, Image, Pressable, Modal, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMediaStore } from '../store/mediaStore';
import { useTheme } from '../lib/ThemeContext';
import type { ThemePalette } from '../lib/theme';
import type { Media } from '../lib/types';

// The actual read-only detail content for someone else's media row (a
// friend's library, or another owner's item inside a shared collection) -
// no edit controls at all, unlike the full media/[id] screen, which only
// ever makes sense for your own media. Optionally offers "Add to My
// Library" to copy the title into your own tracking, resetting personal
// state. Exported unwrapped (no <Modal> of its own) so a caller that's
// already inside its own open <Modal> (the collections screen's detail
// sheet) can render this as an internal sub-view instead of nesting a
// second native Modal - React Native doesn't reliably support two <Modal>s
// open at once (the outer one can swallow touches meant for the inner
// one), unlike stacked web dialogs.
export function ReadOnlyMediaSheetContent({
  media,
  onClose,
  showAddToLibrary = true,
}: {
  media: Media;
  onClose: () => void;
  showAddToLibrary?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { media: myMedia, addMedia } = useMediaStore();

  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

  const alreadyMine = (item: Media) =>
    myMedia.some(
      (m) => m.type === item.type && m.title.trim().toLowerCase() === item.title.trim().toLowerCase()
    );

  const handleAdd = async (item: Media) => {
    setIsAdding(true);
    try {
      await addMedia({
        title: item.title,
        type: item.type,
        poster_url: item.poster_url,
        backdrop_url: item.backdrop_url,
        description: item.description,
        release_year: item.release_year,
        api_rating: item.api_rating,
        genres: item.genres,
        tags: item.tags,
        studios: item.studios,
        total_units: item.total_units,
        // Personal tracking state resets - starting fresh, not inheriting
        // someone else's progress/status/rating/notes.
        progress: 0,
        completion_percent: 0,
        status: 'planned',
        is_favorite: false,
        is_archived: false,
        notes: null,
        user_rating: null,
        completed_at: null,
        streaming_platforms: item.streaming_platforms,
        ai_primary_tone: item.ai_primary_tone,
        ai_secondary_tone: item.ai_secondary_tone,
        ai_core_themes: item.ai_core_themes,
        ai_emotional_intensity: item.ai_emotional_intensity,
        ai_pacing: item.ai_pacing,
        ai_darkness_level: item.ai_darkness_level,
        ai_intellectual_depth: item.ai_intellectual_depth,
        tmdb_id: item.tmdb_id,
        mal_id: item.mal_id,
        rawg_id: item.rawg_id,
        google_books_id: item.google_books_id,
      });
      setJustAdded((prev) => new Set(prev).add(item.id));
    } catch (e: any) {
      // 23505 = already have this title+type (the unique constraint is
      // per-user - see supabase/schema.sql) - that's the end state "add"
      // was going for anyway, so treat it as success.
      if (e?.code === '23505') {
        setJustAdded((prev) => new Set(prev).add(item.id));
      } else {
        Alert.alert('Failed to add', e?.message || 'Something went wrong.');
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Pressable style={styles.close} onPress={onClose}>
        <Ionicons name="close" size={20} color={theme.text} />
      </Pressable>

      <View style={styles.header}>
        {media.poster_url ? (
          <Image source={{ uri: media.poster_url }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Text style={{ color: theme.textFaint, fontSize: 36, fontWeight: '900' }}>
              {media.title.charAt(0)}
            </Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{media.title}</Text>
          {media.release_year != null && <Text style={styles.meta}>{media.release_year}</Text>}
          <Text style={styles.meta}>{media.type.toUpperCase()}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{media.status.replace('_', ' ')}</Text>
          </View>
        </View>
      </View>

      {media.genres.length > 0 && (
        <View style={styles.chipRow}>
          {media.genres.map((g) => (
            <View key={g} style={styles.chip}>
              <Text style={styles.chipText}>{g}</Text>
            </View>
          ))}
        </View>
      )}

      {media.description && <Text style={styles.description}>{media.description}</Text>}

      {media.total_units > 0 && (
        <Text style={styles.progress}>
          Progress: {media.progress} / {media.total_units}
        </Text>
      )}

      {(media.user_rating != null || media.notes) && (
        <View style={styles.reviewBox}>
          {media.user_rating != null && (
            <View style={styles.starRow}>
              {[2, 4, 6, 8, 10].map((value) => (
                <Ionicons
                  key={value}
                  name={media.user_rating! >= value ? 'star' : 'star-outline'}
                  size={16}
                  color={theme.primary}
                />
              ))}
              <Text style={styles.starValue}>{(media.user_rating / 2).toFixed(1)} / 5</Text>
            </View>
          )}
          {media.notes && <Text style={styles.reviewNote}>{media.notes}</Text>}
        </View>
      )}

      {showAddToLibrary &&
        (() => {
          const inMine = justAdded.has(media.id) || alreadyMine(media);
          return (
            <Pressable
              style={[styles.addButton, inMine && styles.addButtonDone]}
              onPress={() => !inMine && handleAdd(media)}
              disabled={inMine || isAdding}
            >
              {isAdding ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <>
                  <Ionicons name={inMine ? 'checkmark' : 'add'} size={16} color={theme.primaryText} />
                  <Text style={styles.addButtonText}>{inMine ? 'In Your Library' : 'Add to My Library'}</Text>
                </>
              )}
            </Pressable>
          );
        })()}
    </ScrollView>
  );
}

// Standalone version wrapped in its own <Modal> - for callers that aren't
// already inside another open Modal (the friend-library screen's grid).
export function ReadOnlyMediaSheet({
  media,
  onClose,
  showAddToLibrary = true,
}: {
  media: Media | null;
  onClose: () => void;
  showAddToLibrary?: boolean;
}) {
  return (
    <Modal visible={!!media} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {media && <ReadOnlyMediaSheetContent media={media} onClose={onClose} showAddToLibrary={showAddToLibrary} />}
    </Modal>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    close: {
      alignSelf: 'flex-end',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      gap: 14,
    },
    poster: {
      width: 100,
      height: 142,
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
      fontSize: 19,
      fontWeight: '800',
    },
    meta: {
      color: theme.textMuted,
      fontSize: 12,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 8,
    },
    statusBadgeText: {
      color: theme.primaryText,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
    progress: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 16,
    },
    reviewBox: {
      marginTop: 16,
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    starRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    starValue: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 6,
    },
    reviewNote: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 20,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
    },
    addButtonDone: {
      backgroundColor: theme.success,
    },
    addButtonText: {
      color: theme.primaryText,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}

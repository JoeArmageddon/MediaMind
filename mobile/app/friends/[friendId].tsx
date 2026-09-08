import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useFriendStore } from '../../store/friendStore';
import { useMediaStore } from '../../store/mediaStore';
import { MediaCard } from '../../components/MediaCard';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';
import type { Media } from '../../lib/types';

// Mirrors the web app's src/app/friends/[friendId]/page.tsx - a friend's
// library, read-only. RLS ("select friends media" in supabase/schema.sql)
// does the actual access control: this query only ever returns rows if an
// accepted friendship exists between the caller and this user_id, so an
// unfriended/revoked id just comes back empty rather than erroring.
export default function FriendLibraryScreen() {
  const insets = useSafeAreaInsets();
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { friends, fetchFriends } = useFriendStore();
  const { media: myMedia, fetchMedia, addMedia } = useMediaStore();

  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Media | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set());
  const cancelledRef = useRef(false);

  // Title+type match against your own already-fetched library - the same
  // check search.tsx relies on before hitting the (now correctly
  // per-user-scoped) unique constraint, so this can show "In Your Library"
  // up front instead of only after a failed add attempt.
  const alreadyMine = useCallback(
    (item: Media) =>
      myMedia.some(
        (m) => m.type === item.type && m.title.trim().toLowerCase() === item.title.trim().toLowerCase()
      ),
    [myMedia]
  );

  const handleAddToMyLibrary = async (item: Media) => {
    setAddingId(item.id);
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
        // Personal tracking state resets - you're starting fresh, not
        // inheriting your friend's progress/status/rating/notes.
        progress: 0,
        completion_percent: 0,
        status: 'planned',
        is_favorite: false,
        is_archived: false,
        notes: null,
        user_rating: null,
        completed_at: null,
        // Factual/content fields (where to stream it, AI content analysis,
        // external ids) describe the title itself, not your relationship
        // to it - worth carrying over so it doesn't need re-resolving.
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
      setJustAddedIds((prev) => new Set(prev).add(item.id));
    } catch (e: any) {
      // 23505 = already have this title+type in your own library (the
      // unique constraint is per-user - see supabase/schema.sql) - treat
      // that as success rather than an error, since the end state (it's in
      // your library) is exactly what "add" was trying to achieve.
      if (e?.code === '23505') {
        setJustAddedIds((prev) => new Set(prev).add(item.id));
      } else {
        Alert.alert('Failed to add', e?.message || 'Something went wrong.');
      }
    } finally {
      setAddingId(null);
    }
  };

  // The friends list is usually already loaded from the Friends tab, but a
  // direct navigation here could land with an empty store - load it either
  // way rather than assuming.
  useEffect(() => {
    fetchFriends();
    // Needed for the "In Your Library" / already-added check below - this
    // screen can be reached without ever visiting the dashboard/library
    // first, which is normally what populates it.
    fetchMedia();
  }, [fetchFriends, fetchMedia]);

  const friendship = useMemo(
    () => friends.find((f) => f.otherUser?.id === friendId),
    [friends, friendId]
  );

  const loadLibrary = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!friendId) return;
      if (opts.silent) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await (supabase as any)
          .from('media')
          .select('*')
          .eq('user_id', friendId)
          .order('updated_at', { ascending: false });

        if (cancelledRef.current) return;
        if (fetchError) throw fetchError;
        setMedia((data ?? []) as Media[]);
      } catch (e) {
        if (cancelledRef.current) return;
        console.error('Failed to load friend library:', e);
        setError(e instanceof Error ? e.message : 'Failed to load library.');
      } finally {
        if (!cancelledRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [friendId]
  );

  useEffect(() => {
    cancelledRef.current = false;
    loadLibrary();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadLibrary]);

  const filteredMedia = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return media;
    return media.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.genres.some((g) => g.toLowerCase().includes(q)) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [media, search]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: friendship?.otherUser?.name ?? "Friend's Library" }} />

      <View style={styles.header}>
        {friendship?.otherUser?.imageUrl ? (
          <Image source={{ uri: friendship.otherUser.imageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>
              {friendship?.otherUser?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {friendship?.otherUser?.name ?? "Friend's Library"}
          </Text>
          <Text style={styles.headerCount}>
            {media.length} {media.length === 1 ? 'title' : 'titles'}
          </Text>
        </View>
        <Pressable onPress={() => loadLibrary({ silent: true })} style={styles.refreshButton}>
          <Ionicons name="refresh" size={18} color={theme.textMuted} />
        </Pressable>
      </View>

      {media.length > 0 && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={theme.textFaint} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${friendship?.otherUser?.name ?? 'their'} library...`}
            placeholderTextColor={theme.textFaint}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : media.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="library-outline" size={40} color={theme.textFaint} />
          <Text style={styles.emptyText}>
            Nothing to show - either their library is empty, or you&apos;re not friends (yet).
          </Text>
        </View>
      ) : filteredMedia.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search" size={40} color={theme.textFaint} />
          <Text style={styles.emptyText}>No matches for &quot;{search}&quot;.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMedia}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadLibrary({ silent: true })}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <MediaCard media={item} onPress={() => setSelected(item)} />
            </View>
          )}
        />
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <ScrollView
            style={{ backgroundColor: theme.bg }}
            contentContainerStyle={[styles.sheetContent, { paddingTop: insets.top + 16 }]}
          >
            <Pressable style={styles.sheetClose} onPress={() => setSelected(null)}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
            <View style={styles.sheetHeader}>
              {selected.poster_url ? (
                <Image source={{ uri: selected.poster_url }} style={styles.sheetPoster} />
              ) : (
                <View style={[styles.sheetPoster, styles.avatarFallback]}>
                  <Text style={{ color: theme.textFaint, fontSize: 36, fontWeight: '900' }}>
                    {selected.title.charAt(0)}
                  </Text>
                </View>
              )}
              <View style={styles.sheetHeaderInfo}>
                <Text style={styles.sheetTitle}>{selected.title}</Text>
                {selected.release_year != null && <Text style={styles.sheetMeta}>{selected.release_year}</Text>}
                <Text style={styles.sheetMeta}>{selected.type.toUpperCase()}</Text>
                <View style={styles.sheetStatusBadge}>
                  <Text style={styles.sheetStatusBadgeText}>{selected.status.replace('_', ' ')}</Text>
                </View>
              </View>
            </View>

            {selected.genres.length > 0 && (
              <View style={styles.chipRow}>
                {selected.genres.map((g) => (
                  <View key={g} style={styles.chip}>
                    <Text style={styles.chipText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {selected.description && <Text style={styles.sheetDescription}>{selected.description}</Text>}

            {selected.total_units > 0 && (
              <Text style={styles.sheetProgress}>
                Progress: {selected.progress} / {selected.total_units}
              </Text>
            )}

            {(() => {
              const inMine = justAddedIds.has(selected.id) || alreadyMine(selected);
              return (
                <Pressable
                  style={[styles.addToMineButton, inMine && styles.addToMineButtonDone]}
                  onPress={() => !inMine && handleAddToMyLibrary(selected)}
                  disabled={inMine || addingId === selected.id}
                >
                  {addingId === selected.id ? (
                    <ActivityIndicator color={theme.primaryText} />
                  ) : (
                    <>
                      <Ionicons
                        name={inMine ? 'checkmark' : 'add'}
                        size={16}
                        color={theme.primaryText}
                      />
                      <Text style={styles.addToMineButtonText}>
                        {inMine ? 'In Your Library' : 'Add to My Library'}
                      </Text>
                    </>
                  )}
                </Pressable>
              );
            })()}
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 16,
      paddingBottom: 8,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarFallback: {
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      color: theme.textFaint,
      fontWeight: '800',
    },
    headerName: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
    },
    headerCount: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    refreshButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 11,
      color: theme.text,
      fontSize: 14,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyText: {
      color: theme.textMuted,
      textAlign: 'center',
      fontSize: 14,
    },
    list: {
      padding: 12,
    },
    row: {
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    cell: {
      width: '31%',
    },
    sheetContent: {
      padding: 20,
      paddingBottom: 40,
    },
    sheetClose: {
      alignSelf: 'flex-end',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    sheetHeader: {
      flexDirection: 'row',
      gap: 14,
    },
    sheetPoster: {
      width: 100,
      height: 142,
      borderRadius: 14,
    },
    sheetHeaderInfo: {
      flex: 1,
      justifyContent: 'center',
      gap: 4,
    },
    sheetTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: '800',
    },
    sheetMeta: {
      color: theme.textMuted,
      fontSize: 12,
    },
    sheetStatusBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 8,
    },
    sheetStatusBadgeText: {
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
    sheetDescription: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 14,
    },
    sheetProgress: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 16,
    },
    addToMineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 20,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
    },
    addToMineButtonDone: {
      backgroundColor: theme.success,
    },
    addToMineButtonText: {
      color: theme.primaryText,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}

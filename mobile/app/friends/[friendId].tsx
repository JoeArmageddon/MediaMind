import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useFriendStore } from '../../store/friendStore';
import { MediaCard } from '../../components/MediaCard';
import { ReadOnlyMediaSheet } from '../../components/ReadOnlyMediaSheet';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';
import type { Media } from '../../lib/types';

// Mirrors the web app's src/app/friends/[friendId]/page.tsx - a friend's
// library, read-only. RLS ("select friends media" in supabase/schema.sql)
// does the actual access control: this query only ever returns rows if an
// accepted friendship exists between the caller and this user_id, so an
// unfriended/revoked id just comes back empty rather than erroring.
export default function FriendLibraryScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { friends, fetchFriends } = useFriendStore();

  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Media | null>(null);
  const cancelledRef = useRef(false);

  // The friends list is usually already loaded from the Friends tab, but a
  // direct navigation here could land with an empty store - load it either
  // way rather than assuming.
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

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

      <ReadOnlyMediaSheet media={selected} onClose={() => setSelected(null)} />
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
  });
}

import { useEffect, useCallback, useState, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMediaStore } from '../store/mediaStore';
import { MediaCard } from '../components/MediaCard';
import { useTheme } from '../lib/ThemeContext';
import type { ThemePalette } from '../lib/theme';
import type { Media } from '../lib/types';

// The full library grid, moved here from (tabs)/index.tsx (now the
// dashboard) - matches web's separate /library page. Search here filters
// your own already-added media by title/genre/tag; it's a different thing
// from the Search tab, which searches external sources to add new titles.
export default function LibraryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { media, isLoading, error, fetchMedia } = useMediaStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

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

  const renderItem = useCallback(
    ({ item }: { item: Media }) => (
      <View style={styles.cell}>
        <MediaCard media={item} onPress={() => router.push(`/media/${item.id}`)} />
      </View>
    ),
    [router, styles]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Library' }} />

      {media.length > 0 && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={theme.textFaint} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your library..."
            placeholderTextColor={theme.textFaint}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      {isLoading && media.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : !isLoading && media.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="film-outline" size={40} color={theme.textFaint} />
          <Text style={styles.emptyText}>{error ? error : 'Nothing here yet - add a title from Search.'}</Text>
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
          renderItem={renderItem}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchMedia} tintColor={theme.primary} />
          }
        />
      )}
    </View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 12,
      marginBottom: 0,
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    searchIcon: {
      marginRight: 8,
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

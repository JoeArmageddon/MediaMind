import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useCollectionStore } from '../../store/collectionStore';
import { MediaCard } from '../../components/MediaCard';
import { ReadOnlyMediaSheet } from '../../components/ReadOnlyMediaSheet';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';
import type { Media, SmartCollection } from '../../lib/types';

// Mirrors web's src/app/collections/public/[id]/page.tsx - reachable via
// the "View a public collection" link/id entry on the collections screen
// (no universal-link deep-linking set up on mobile yet, unlike web's
// shareable /collections/public/[id] URL). RLS ("select public
// collections" + "select collection-shared media" in supabase/schema.sql)
// is the actual access control: fetchPublicCollection only ever returns a
// row if is_public = true, and the media query only returns rows the
// policy permits - no owner attribution shown, same as web, since a
// public collection's viewer and owner aren't necessarily connected.
export default function PublicCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { fetchPublicCollection } = useCollectionStore();

  const [collection, setCollection] = useState<SmartCollection | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Media | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!id) return;
      if (opts.silent) setIsRefreshing(true);
      else setIsLoading(true);
      setNotFound(false);
      try {
        const found = await fetchPublicCollection(id);
        if (cancelledRef.current) return;
        if (!found) {
          setNotFound(true);
          setCollection(null);
          setMedia([]);
          return;
        }
        setCollection(found);

        if (found.media_ids.length === 0) {
          setMedia([]);
          return;
        }
        const { data, error } = await (supabase as any).from('media').select('*').in('id', found.media_ids);
        if (cancelledRef.current) return;
        if (error) throw error;
        setMedia((data ?? []) as Media[]);
      } catch (e) {
        if (!cancelledRef.current) console.error('Failed to load public collection:', e);
      } finally {
        if (!cancelledRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [id, fetchPublicCollection]
  );

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: collection?.title ?? 'Collection' }} />

      {collection && (
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {collection.title}
          </Text>
          {collection.description && (
            <Text style={styles.headerDescription} numberOfLines={2}>
              {collection.description}
            </Text>
          )}
          <Text style={styles.headerCount}>
            {media.length} {media.length === 1 ? 'title' : 'titles'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : notFound ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={theme.textFaint} />
          <Text style={styles.emptyText}>
            This collection isn&apos;t public, or doesn&apos;t exist.
          </Text>
        </View>
      ) : media.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={40} color={theme.textFaint} />
          <Text style={styles.emptyText}>This collection is empty.</Text>
        </View>
      ) : (
        <FlatList
          data={media}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => load({ silent: true })} tintColor={theme.primary} />
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
      padding: 16,
      paddingBottom: 8,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    headerDescription: {
      color: theme.textMuted,
      fontSize: 13,
      marginTop: 4,
    },
    headerCount: {
      color: theme.textFaint,
      fontSize: 12,
      marginTop: 6,
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

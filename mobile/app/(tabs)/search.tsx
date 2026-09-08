import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSearchOrchestrator } from '../../lib/api/search';
import { mapExternalIds } from '../../lib/api/externalId';
import { useMediaStore } from '../../store/mediaStore';
import { Toast } from '../../components/Toast';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';
import type { SearchResult, MediaType } from '../../lib/types';

const TYPE_OPTIONS: { value: MediaType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV' },
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'game', label: 'Games' },
  { value: 'book', label: 'Books' },
];

export default function SearchScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { addMedia } = useMediaStore();
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MediaType | 'all'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  // Tapping a result's row (not its add button) toggles its synopsis open
  // inline, so you can actually read what something's about before adding
  // it - previously there was no way to see the description at all here.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setError(null);
    try {
      const orchestrator = getSearchOrchestrator();
      const found = await orchestrator.search(
        query.trim(),
        selectedType === 'all' ? undefined : selectedType,
        controller.signal
      );
      if (abortRef.current !== controller) return;
      setResults(found);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'Search failed.');
    } finally {
      if (abortRef.current === controller) {
        setIsSearching(false);
        abortRef.current = null;
      }
    }
  }, [query, selectedType]);

  const handleAdd = useCallback(
    async (result: SearchResult) => {
      const key = `${result.type}:${result.title}`;
      try {
        await addMedia({
          title: result.title,
          type: result.type,
          poster_url: result.poster_url,
          backdrop_url: null,
          description: result.description,
          release_year: result.release_year,
          api_rating: result.api_rating,
          genres: result.genres,
          tags: [],
          studios: [],
          total_units: result.total_units || 0,
          progress: 0,
          completion_percent: 0,
          status: 'planned',
          is_favorite: false,
          is_archived: false,
          notes: null,
          user_rating: null,
          streaming_platforms: [],
          ai_primary_tone: null,
          ai_secondary_tone: null,
          ai_core_themes: [],
          ai_emotional_intensity: null,
          ai_pacing: null,
          ai_darkness_level: null,
          ai_intellectual_depth: null,
          completed_at: null,
          ...mapExternalIds(result),
        });
        setAddedKeys((prev) => new Set(prev).add(key));
      } catch (e: any) {
        // 23505 = Postgres unique_violation - here specifically the
        // (normalized_title, type) constraint, meaning something with
        // this exact title+type already exists in the library (possibly
        // added earlier via a different source/external id). Translate
        // it rather than surface the raw constraint name.
        if (e?.code === '23505') {
          setError('Already in your library.');
        } else {
          setError(e?.message || 'Failed to add to library.');
        }
      }
    },
    [addMedia]
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search for a title..."
          placeholderTextColor={theme.textFaint}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable style={styles.searchButton} onPress={handleSearch} disabled={isSearching}>
          {isSearching ? (
            <ActivityIndicator color={theme.primaryText} size="small" />
          ) : (
            <Ionicons name="search" size={18} color={theme.primaryText} />
          )}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow} contentContainerStyle={{ gap: 8 }}>
        {TYPE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.typeChip, selectedType === opt.value && styles.typeChipActive]}
            onPress={() => setSelectedType(opt.value)}
          >
            <Text style={[styles.typeChipText, selectedType === opt.value && styles.typeChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={(item, idx) => `${item.type}-${item.external_id}-${idx}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const key = `${item.type}:${item.title}`;
          const added = addedKeys.has(key);
          const expanded = expandedKeys.has(key);
          const toggleExpanded = () => {
            if (!item.description) return;
            setExpandedKeys((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          };
          return (
            <Pressable
              style={styles.resultRow}
              onPress={toggleExpanded}
              disabled={!item.description}
            >
              <View style={styles.resultMainRow}>
                {item.poster_url ? (
                  <Image source={{ uri: item.poster_url }} style={styles.resultPoster} resizeMode="cover" />
                ) : (
                  <View style={[styles.resultPoster, styles.resultPosterFallback]}>
                    <Text style={{ color: theme.textFaint, fontWeight: '900' }}>{item.title.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.resultMeta}>
                    {item.type.toUpperCase()}
                    {item.release_year ? ` · ${item.release_year}` : ''}
                  </Text>
                </View>
                {item.description && (
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.textFaint}
                  />
                )}
                <Pressable
                  style={[styles.addButton, added && styles.addButtonDone]}
                  onPress={() => !added && handleAdd(item)}
                  disabled={added}
                >
                  <Ionicons name={added ? 'checkmark' : 'add'} size={18} color={theme.primaryText} />
                </Pressable>
              </View>
              {expanded && item.description && (
                <Text style={styles.resultSynopsis}>{item.description}</Text>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !isSearching ? (
            <Text style={styles.hint}>Search movies, TV, anime, manga, games, and books.</Text>
          ) : null
        }
      />

      <Toast message={error} />
    </View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      paddingTop: 12,
    },
    searchBar: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
    },
    input: {
      flex: 1,
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
    },
    searchButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeRow: {
      marginTop: 12,
      paddingHorizontal: 16,
      flexGrow: 0,
    },
    typeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
    },
    typeChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    typeChipText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    typeChipTextActive: {
      color: theme.primaryText,
    },
    hint: {
      color: theme.textFaint,
      textAlign: 'center',
      marginTop: 40,
      fontSize: 13,
    },
    list: {
      padding: 16,
      gap: 10,
    },
    resultRow: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      padding: 10,
      marginBottom: 10,
    },
    resultMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    resultSynopsis: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: theme.borderWidth,
      borderTopColor: theme.cardBorder,
    },
    resultPoster: {
      width: 44,
      height: 62,
      borderRadius: 8,
    },
    resultPosterFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.input,
    },
    resultInfo: {
      flex: 1,
    },
    resultTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    resultMeta: {
      color: theme.textMuted,
      fontSize: 11,
      marginTop: 3,
    },
    addButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDone: {
      backgroundColor: theme.success,
    },
  });
}

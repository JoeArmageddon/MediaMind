import { useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Media } from '../lib/types';
import { useTheme } from '../lib/ThemeContext';
import type { ThemePalette } from '../lib/theme';

export function MediaCard({ media, onPress }: { media: Media; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isCompleted = media.status === 'completed';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.posterWrap}>
        {media.poster_url ? (
          <Image source={{ uri: media.poster_url }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Text style={styles.posterFallbackText}>{media.title.charAt(0)}</Text>
          </View>
        )}
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark" size={12} color={theme.isManga ? '#fff' : '#000'} />
          </View>
        )}
        {media.api_rating != null && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={9} color="#facc15" />
            <Text style={styles.ratingText}>{media.api_rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={2}>
        {media.title}
      </Text>
      {media.release_year != null && <Text style={styles.year}>{media.release_year}</Text>}
    </Pressable>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    card: {
      // No width here - the grid's cell wrapper already sets the column
      // width; setting it again here compounded (31% of a 31%-wide
      // parent), cramming posters/titles into a tiny sliver of each cell.
      width: '100%',
    },
    posterWrap: {
      aspectRatio: 2 / 3,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
    },
    poster: {
      width: '100%',
      height: '100%',
    },
    posterFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    posterFallbackText: {
      color: theme.textFaint,
      fontSize: 32,
      fontWeight: '900',
    },
    completedBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ratingBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.isManga ? 'rgba(255,253,247,0.85)' : 'rgba(0,0,0,0.65)',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    ratingText: {
      color: theme.isManga ? theme.text : '#fff',
      fontSize: 10,
      fontWeight: '700',
    },
    title: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 6,
    },
    titleCompleted: {
      opacity: 0.5,
      textDecorationLine: 'line-through',
    },
    year: {
      color: theme.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
  });
}

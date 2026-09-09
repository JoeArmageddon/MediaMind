import { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMediaStore } from '../../store/mediaStore';
import { useFriendStore } from '../../store/friendStore';
import { MediaCard } from '../../components/MediaCard';
import { MangaHatch } from '../../components/MangaHatch';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';
import { getTypeLabel } from '../../lib/utils';

// Mirrors the web app's FriendsActivityFeed describe() - a short verb
// phrase for a friend's history entry.
function describeActivity(entry: { action_type: string; value: unknown }): string {
  if (entry.action_type === 'status_change') {
    const status = (entry.value as { status?: string } | null)?.status;
    if (status === 'completed') return 'finished';
    if (status) return `marked as ${status.replace('_', ' ')}`;
  }
  const verbs: Record<string, string> = {
    added: 'added',
    progress_update: 'made progress on',
    favorited: 'favorited',
    archived: 'archived',
  };
  return verbs[entry.action_type] ?? 'updated';
}

// Mirrors the web app's src/app/(dashboard)/page.tsx bento-grid home
// screen. Dark mode gets a "liquid glass" treatment (BlurView + gradient
// wash on the bento cards, matching Apple's current material language as
// closely as Expo Go allows - the actual native iOS 26 glass APIs aren't
// exposed to JS yet, this is the closest approximation available without
// a custom native module). Manga mode is deliberately flat instead - bold
// ink borders and a halftone dot wash, no blur/translucency at all.
export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { media, fetchMedia } = useMediaStore();
  const { friends, activity, isLoadingActivity, fetchFriendsActivity } = useFriendStore();

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  useEffect(() => {
    fetchFriendsActivity();
  }, [fetchFriendsActivity]);

  const totalCount = media.length;
  const completedCount = media.filter((m) => m.status === 'completed').length;
  const posterFill = media.slice(0, 8);
  const recent = useMemo(
    () => [...media].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 9),
    [media]
  );


  const CardGlass = ({ children, style }: { children: React.ReactNode; style?: object }) =>
    theme.isManga ? (
      <View style={[styles.mangaCard, style]}>
        <MangaHatch color={theme.text} />
        {children}
      </View>
    ) : (
      <View style={[styles.glassCardWrap, style]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        {children}
      </View>
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      {/* Background wash - manga gets a subtle halftone-style dot texture
          feel via a radial gradient burst; dark mode gets the brand
          gradient glow (matches the web hero's blurred glow blob). */}
      <LinearGradient
        colors={
          theme.isManga
            ? ['rgba(217,30,54,0.10)', 'rgba(217,30,54,0)']
            : ['rgba(124,92,255,0.25)', 'rgba(124,92,255,0)']
        }
        style={styles.heroGlow}
      />

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>MEDIA{'\n'}MIND</Text>
        <View style={styles.heroTagRow}>
          <Text style={styles.heroTagText}>v2.0</Text>
          <View style={styles.heroTagLine} />
          <Text style={styles.heroTagText}>{theme.isManga ? 'MANGA MODE' : 'INTELLIGENCE'}</Text>
        </View>
      </View>

      <OfflineBanner />

      {/* Stats ticker */}
      <View style={styles.statsRow}>
        <CardGlass style={styles.statCard}>
          <View style={[styles.statDot, { backgroundColor: theme.success }]} />
          <View>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{totalCount}</Text>
          </View>
        </CardGlass>
        <CardGlass style={styles.statCard}>
          <View style={[styles.statDot, { backgroundColor: theme.primary }]} />
          <View>
            <Text style={styles.statLabel}>Watched</Text>
            <Text style={styles.statValue}>{completedCount}</Text>
          </View>
        </CardGlass>
      </View>

      {/* Library card */}
      <Pressable
        style={({ pressed }) => [styles.libraryCard, pressed && styles.pressedCard]}
        onPress={() => router.push('/library')}
      >
        <View style={styles.posterCollage}>
          {Array.from({ length: 8 }).map((_, i) => {
            const item = posterFill[i];
            return (
              <View key={i} style={styles.posterCell}>
                {item?.poster_url ? (
                  <Image source={{ uri: item.poster_url }} style={styles.posterCellImg} />
                ) : (
                  <View style={styles.posterCellEmpty}>
                    <Ionicons name="film-outline" size={18} color={theme.textFaint} />
                  </View>
                )}
                {/* Per-cell darkening, matching the web card (which never
                    blurs the posters - individual opacity + a dark wash
                    per cell, crisper than a heavy blur over everything). */}
                <View style={styles.posterCellShade} />
              </View>
            );
          })}
        </View>
        {theme.isManga && (
          <>
            <View style={styles.libraryCardOverlayManga} />
            <MangaHatch color={theme.text} opacity={0.14} />
          </>
        )}
        {/* Three-stop gradient (matches the web card's from-black
            via-black/60 to-transparent) - a single hard stop looked flatter
            than this smoother fade. */}
        <LinearGradient
          colors={
            theme.isManga
              ? ['transparent', 'rgba(22,19,17,0.6)', '#161311']
              : ['transparent', 'rgba(0,0,0,0.6)', '#000000']
          }
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Bottom-anchored (not flex-stretched to fill the card) so it's
            only ever as tall as its own content, sized independently of
            the card's rounded-corner clipping - a flex:1 + align:flex-end
            version of this had the arrow circle clipped by the card's own
            bottom-right corner curve. */}
        <View style={styles.libraryCardContent}>
          <View>
            <View style={styles.libraryCardBadge}>
              <Text style={styles.libraryCardBadgeText}>
                {totalCount} {totalCount === 1 ? 'Title' : 'Titles'}
              </Text>
            </View>
            <Text style={styles.libraryCardTitle}>LIBRARY</Text>
            <Text style={styles.libraryCardSubtitle}>コレクション</Text>
          </View>
          <View style={styles.libraryCardArrow}>
            <Ionicons name="arrow-forward" size={20} color={theme.isManga ? theme.bg : theme.text} />
          </View>
        </View>
      </Pressable>

      {/* Bento row: Collections + Add */}
      <View style={styles.bentoRow}>
        <Pressable
          onPress={() => router.push('/collections')}
          style={({ pressed }) => [styles.aiCardOuter, pressed && styles.pressedCard]}
        >
          <LinearGradient
            colors={theme.isManga ? [theme.card, theme.card] : ['rgba(232,121,249,0.16)', 'rgba(124,92,255,0.10)']}
            style={styles.aiCard}
          >
            {theme.isManga && <MangaHatch color={theme.primary} opacity={0.18} spacing={6} />}
            <Ionicons name="sparkles" size={20} color={theme.isManga ? theme.primary : theme.accent} />
            <Text style={styles.aiCardTitle}>COLLECTIONS</Text>
            <Text style={styles.aiCardSub}>MANUAL + SHARED</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.addCard, pressed && styles.pressedCard]}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="add" size={36} color={theme.isManga ? theme.primaryText : '#000'} />
          <Text style={styles.addCardText}>ADD</Text>
        </Pressable>
      </View>

      {/* Discover */}
      <CardGlass style={styles.rowCard}>
        <Pressable
          style={({ pressed }) => [styles.rowCardPressable, pressed && styles.pressedRow]}
          onPress={() => router.push('/discover')}
        >
          <View style={[styles.rowCardStripe, { backgroundColor: theme.primary }]} />
          <View style={styles.rowCardIcon}>
            <Ionicons name="shuffle" size={16} color={theme.primary} />
          </View>
          <View style={styles.rowCardText}>
            <Text style={styles.rowCardTitle}>DISCOVER</Text>
            <Text style={styles.rowCardSub}>RANDOM PICK OR AI RECOMMENDATIONS</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={theme.textMuted} />
        </Pressable>
      </CardGlass>

      {/* Settings */}
      <CardGlass style={styles.rowCard}>
        <Pressable
          style={({ pressed }) => [styles.rowCardPressable, pressed && styles.pressedRow]}
          onPress={() => router.push('/settings')}
        >
          <View style={[styles.rowCardStripe, { backgroundColor: theme.primary }]} />
          <View style={styles.rowCardIconBox}>
            <Text style={styles.rowCardIconBoxText}>ID</Text>
          </View>
          <View style={styles.rowCardText}>
            <Text style={styles.rowCardTitle}>SYSTEM CONFIG</Text>
            <Text style={styles.rowCardSub}>STATUS: ONLINE</Text>
          </View>
          <Ionicons name="settings-outline" size={16} color={theme.textMuted} />
        </Pressable>
      </CardGlass>

      {/* Friends' Activity - nothing to show for someone with no friends
          yet (the add-a-friend flow lives on the Friends tab, no need to
          duplicate an empty-state prompt here), same as the web version. */}
      {!isLoadingActivity && friends.length > 0 && activity.length > 0 && (
        <View style={styles.friendsSection}>
          <View style={styles.friendsSectionHeader}>
            <View style={styles.friendsSectionTitleRow}>
              <Ionicons name="people-outline" size={16} color={theme.textMuted} />
              <Text style={styles.friendsSectionTitle}>Friends&apos; Activity</Text>
            </View>
            <Pressable onPress={() => router.push('/friends')}>
              <Text style={styles.recentSeeAll}>View all</Text>
            </Pressable>
          </View>
          <CardGlass style={styles.friendsCard}>
            {activity.slice(0, 8).map((entry, idx) => (
              <Pressable
                key={entry.id}
                style={({ pressed }) => [
                  styles.friendsRow,
                  idx > 0 && styles.friendsRowDivider,
                  pressed && styles.pressedRow,
                ]}
                onPress={() => router.push(`/friends/${entry.friend.id}`)}
              >
                {entry.friend.imageUrl ? (
                  <Image source={{ uri: entry.friend.imageUrl }} style={styles.friendsAvatar} />
                ) : (
                  <View style={[styles.friendsAvatar, styles.friendsAvatarFallback]}>
                    <Text style={styles.friendsAvatarFallbackText}>
                      {entry.friend.name[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.friendsRowText}>
                  <Text style={styles.friendsRowLine} numberOfLines={2}>
                    <Text style={styles.friendsRowName}>{entry.friend.name}</Text>{' '}
                    <Text style={styles.friendsRowVerb}>{describeActivity(entry)}</Text>{' '}
                    <Text style={styles.friendsRowMediaTitle}>{entry.media?.title ?? 'a title'}</Text>
                  </Text>
                  {entry.media && (
                    <Text style={styles.friendsRowType}>{getTypeLabel(entry.media.type)}</Text>
                  )}
                </View>
                {entry.media?.poster_url && (
                  <Image source={{ uri: entry.media.poster_url }} style={styles.friendsRowPoster} />
                )}
              </Pressable>
            ))}
          </CardGlass>
        </View>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent</Text>
            <Pressable onPress={() => router.push('/library')}>
              <Text style={styles.recentSeeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.recentGrid}>
            {recent.map((item) => (
              <View key={item.id} style={styles.recentCell}>
                <MediaCard media={item} onPress={() => router.push(`/media/${item.id}`)} />
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      padding: 16,
    },
    heroGlow: {
      position: 'absolute',
      top: -40,
      left: -60,
      width: 260,
      height: 260,
      borderRadius: 130,
    },
    hero: {
      marginBottom: 20,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 44,
      fontWeight: '900',
      letterSpacing: -1.5,
      lineHeight: 40,
    },
    heroTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 10,
    },
    heroTagText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2,
    },
    heroTagLine: {
      height: theme.borderWidth,
      width: 40,
      backgroundColor: theme.primary,
      opacity: theme.isManga ? 1 : 0.5,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 18,
    },
    glassCardWrap: {
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
    },
    mangaCard: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
    },
    statCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    statDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statLabel: {
      color: theme.textMuted,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '700',
    },
    libraryCard: {
      height: 200,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      backgroundColor: theme.isManga ? theme.card : '#0a0a0a',
      marginBottom: 12,
    },
    posterCollage: {
      // StyleSheet.absoluteFillObject was removed from this RN version
      // (still typed/exists in older RN) - inlined equivalent.
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 2,
    },
    posterCell: {
      width: '25%',
      height: '50%',
      padding: 2,
    },
    posterCellImg: {
      width: '100%',
      height: '100%',
      borderRadius: 6,
      opacity: theme.isManga ? 0.5 : 0.75,
    },
    posterCellShade: {
      // StyleSheet.absoluteFillObject was removed from this RN version
      // (still typed/exists in older RN) - inlined equivalent.
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      margin: 2,
      borderRadius: 6,
      backgroundColor: theme.isManga ? 'rgba(22,19,17,0.15)' : 'rgba(0,0,0,0.35)',
    },
    posterCellEmpty: {
      width: '100%',
      height: '100%',
      borderRadius: 6,
      backgroundColor: theme.isManga ? 'rgba(22,19,17,0.04)' : 'rgba(255,255,255,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    libraryCardOverlayManga: {
      // StyleSheet.absoluteFillObject was removed from this RN version
      // (still typed/exists in older RN) - inlined equivalent.
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: 'rgba(242,239,228,0.4)',
    },
    // Absolutely positioned and bottom-anchored (not flex:1 + align:
    // flex-end) so its height is only ever as tall as its own content,
    // independent of the card's own rounded-corner clipping - that
    // combination previously let the arrow circle get clipped by the
    // card's bottom-right corner curve.
    libraryCardContent: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    libraryCardBadge: {
      backgroundColor: theme.isManga ? theme.primary : theme.text,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    libraryCardBadgeText: {
      color: theme.isManga ? theme.primaryText : '#000',
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    libraryCardTitle: {
      color: theme.isManga ? theme.text : '#fff',
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -1,
    },
    libraryCardSubtitle: {
      color: theme.isManga ? theme.textMuted : 'rgba(255,255,255,0.55)',
      fontSize: 12,
      marginTop: 2,
    },
    libraryCardArrow: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.isManga ? 'rgba(22,19,17,0.08)' : 'rgba(255,255,255,0.14)',
      borderWidth: theme.borderWidth,
      borderColor: theme.isManga ? theme.cardBorder : 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bentoRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    aiCardOuter: {
      flex: 7,
      height: 130,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
    },
    aiCard: {
      flex: 1,
      padding: 16,
      justifyContent: 'space-between',
    },
    aiCardTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 20,
    },
    aiCardSub: {
      color: theme.isManga ? theme.primary : theme.accent,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 4,
    },
    addCard: {
      flex: 5,
      height: 130,
      backgroundColor: theme.isManga ? theme.primary : theme.text,
      borderRadius: 24,
      borderWidth: theme.isManga ? theme.borderWidth : 0,
      borderColor: theme.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      shadowColor: theme.isManga ? theme.primary : '#fff',
      shadowOpacity: theme.isManga ? 0.35 : 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    addCardText: {
      color: theme.isManga ? theme.primaryText : '#000',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 1.5,
    },
    rowCard: {
      marginBottom: 12,
    },
    rowCardPressable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      overflow: 'hidden',
    },
    rowCardStripe: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: theme.borderWidth + 1,
    },
    rowCardIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.isManga ? 'rgba(217,30,54,0.10)' : 'rgba(124,92,255,0.15)',
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCardIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.isManga ? theme.card : '#27272a',
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCardIconBoxText: {
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
    },
    rowCardText: {
      flex: 1,
    },
    rowCardTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    rowCardSub: {
      color: theme.textFaint,
      fontSize: 9,
      marginTop: 2,
    },
    friendsSection: {
      marginBottom: 4,
    },
    friendsSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    friendsSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    friendsSectionTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    friendsCard: {
      marginBottom: 12,
    },
    friendsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
    },
    friendsRowDivider: {
      borderTopWidth: theme.borderWidth,
      borderTopColor: theme.cardBorder,
    },
    friendsAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    friendsAvatarFallback: {
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendsAvatarFallbackText: {
      color: theme.primaryText,
      fontSize: 12,
      fontWeight: '800',
    },
    friendsRowText: {
      flex: 1,
      minWidth: 0,
    },
    friendsRowLine: {
      fontSize: 13,
      lineHeight: 18,
    },
    friendsRowName: {
      color: theme.text,
      fontWeight: '700',
    },
    friendsRowVerb: {
      color: theme.textMuted,
    },
    friendsRowMediaTitle: {
      color: theme.text,
      fontWeight: '600',
    },
    friendsRowType: {
      color: theme.textFaint,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    friendsRowPoster: {
      width: 30,
      height: 42,
      borderRadius: 6,
    },
    recentSection: {
      marginTop: 8,
    },
    recentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    recentTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    recentSeeAll: {
      color: theme.primary,
      fontSize: 12,
    },
    recentGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    recentCell: {
      width: '31%',
      marginBottom: 16,
    },
    // Press feedback - every bento button was a flat tap-target with zero
    // visual response before this. Big block buttons (library/AI/add) get
    // a slight scale+dim; row buttons (discover/settings, already narrow
    // and full-width) just dim, since scaling a full-width row looks odd.
    pressedCard: {
      opacity: 0.88,
      transform: [{ scale: 0.97 }],
    },
    pressedRow: {
      opacity: 0.6,
    },
  });
}

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFriendStore } from '../../store/friendStore';
import { useRecommendationStore } from '../../store/recommendationStore';
import { useMediaStore } from '../../store/mediaStore';
import { useTheme } from '../../lib/ThemeContext';
import type { ThemePalette } from '../../lib/theme';
import type { FriendshipWithProfile, RecommendationWithProfile } from '../../lib/types';

// Mirrors the web app's /friends page: add-by-email, a friends list, and
// incoming/outgoing requests - condensed into one scrollable native screen
// (segmented toggle instead of web's Tabs component) rather than the web's
// two separate tab panels.
export default function FriendsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    myInviteCode,
    isLoading,
    isLoadingCode,
    fetchFriends,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    fetchMyInviteCode,
    regenerateInviteCode,
    redeemInviteCode,
  } = useFriendStore();
  const { inbox, sent, fetchInbox, fetchSent, markRead, dismiss } = useRecommendationStore();
  const { media: myMedia, addMedia } = useMediaStore();

  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'foryou'>('friends');
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFriends();
    fetchMyInviteCode();
    fetchInbox();
    fetchSent();
  }, [fetchFriends, fetchMyInviteCode, fetchInbox, fetchSent]);

  // Marked read only once the tab is actually opened, not on page load -
  // same as web's "For You" tab, so the unread badge stays accurate until
  // the user actually looks.
  useEffect(() => {
    if (activeTab !== 'foryou') return;
    inbox.filter((r) => !r.is_read).forEach((r) => markRead(r.id));
  }, [activeTab, inbox, markRead]);

  const unreadCount = inbox.filter((r) => !r.is_read).length;

  const alreadyMine = (rec: RecommendationWithProfile) =>
    myMedia.some(
      (m) => m.type === rec.type && m.title.trim().toLowerCase() === rec.title.trim().toLowerCase()
    );

  const handleAddRecommendation = async (rec: RecommendationWithProfile) => {
    setAddingId(rec.id);
    try {
      await addMedia({
        title: rec.title,
        type: rec.type,
        poster_url: rec.poster_url,
        backdrop_url: null,
        description: rec.description,
        release_year: rec.release_year,
        api_rating: rec.api_rating,
        genres: rec.genres,
        tags: [],
        studios: [],
        total_units: 0,
        progress: 0,
        completion_percent: 0,
        status: 'planned',
        is_favorite: false,
        is_archived: false,
        notes: null,
        user_rating: null,
        completed_at: null,
        streaming_platforms: [],
        ai_primary_tone: null,
        ai_secondary_tone: null,
        ai_core_themes: [],
        ai_emotional_intensity: null,
        ai_pacing: null,
        ai_darkness_level: null,
        ai_intellectual_depth: null,
        tmdb_id: rec.tmdb_id,
        mal_id: rec.mal_id,
        rawg_id: rec.rawg_id,
        google_books_id: rec.google_books_id,
      });
    } catch (e: any) {
      if (e?.code !== '23505') {
        Alert.alert('Failed to add', e?.message || 'Something went wrong.');
      }
    } finally {
      setAddingId(null);
    }
  };

  const handleSend = async () => {
    if (!email.trim()) return;
    setIsSending(true);
    setFeedback(null);
    const result = await sendRequest(email.trim());
    setFeedback({ ok: result.success, text: result.message });
    if (result.success) setEmail('');
    setIsSending(false);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setIsJoining(true);
    setJoinFeedback(null);
    const result = await redeemInviteCode(joinCode.trim().toUpperCase());
    setJoinFeedback({ ok: result.success, text: result.message });
    if (result.success) setJoinCode('');
    setIsJoining(false);
  };

  const Avatar = ({ user, size = 44 }: { user: FriendshipWithProfile['otherUser']; size?: number }) => {
    const initial = user?.name?.[0]?.toUpperCase() || '?';
    if (user?.imageUrl) {
      return (
        <Image
          source={{ uri: user.imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      );
    }
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.avatarFallbackText}>{initial}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FRIENDS</Text>
        <Text style={styles.headerSub}>友達</Text>
      </View>

      <View style={styles.addCard}>
        <View style={styles.addCardLabelRow}>
          <Ionicons name="person-add-outline" size={14} color={theme.textMuted} />
          <Text style={styles.addCardLabel}>Add a friend</Text>
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={handleSend}
            placeholder="Their email address"
            placeholderTextColor={theme.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="send"
          />
          <Pressable style={styles.sendButton} onPress={handleSend} disabled={isSending || !email.trim()}>
            {isSending ? (
              <ActivityIndicator color={theme.primaryText} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </Pressable>
        </View>
        {feedback && (
          <Text style={[styles.feedback, { color: feedback.ok ? theme.success : theme.danger }]}>
            {feedback.text}
          </Text>
        )}
      </View>

      <View style={styles.addCard}>
        <View style={styles.addCardLabelRow}>
          <Ionicons name="qr-code-outline" size={14} color={theme.textMuted} />
          <Text style={styles.addCardLabel}>Your invite code</Text>
        </View>
        {isLoadingCode && !myInviteCode ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <View style={styles.codeRow}>
            <Text style={styles.codeText} selectable>
              {myInviteCode ?? '--------'}
            </Text>
            <Pressable style={styles.regenButton} onPress={regenerateInviteCode} disabled={isLoadingCode}>
              <Ionicons name="refresh" size={15} color={theme.textMuted} />
            </Pressable>
          </View>
        )}
        <Text style={styles.codeHint}>Tap and hold the code to copy it, or share it out loud.</Text>

        <View style={[styles.addCardLabelRow, { marginTop: 14 }]}>
          <Ionicons name="enter-outline" size={14} color={theme.textMuted} />
          <Text style={styles.addCardLabel}>Join with a code</Text>
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={joinCode}
            onChangeText={setJoinCode}
            onSubmitEditing={handleJoin}
            placeholder="Their invite code"
            placeholderTextColor={theme.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="join"
          />
          <Pressable style={styles.sendButton} onPress={handleJoin} disabled={isJoining || !joinCode.trim()}>
            {isJoining ? (
              <ActivityIndicator color={theme.primaryText} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Join</Text>
            )}
          </Pressable>
        </View>
        {joinFeedback && (
          <Text style={[styles.feedback, { color: joinFeedback.ok ? theme.success : theme.danger }]}>
            {joinFeedback.text}
          </Text>
        )}
      </View>

      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segment, activeTab === 'friends' && styles.segmentActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.segmentText, activeTab === 'friends' && styles.segmentTextActive]}>
            Friends ({friends.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'requests' && styles.segmentActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.segmentText, activeTab === 'requests' && styles.segmentTextActive]}>
            Requests
          </Text>
          {incomingRequests.length > 0 && (
            <View style={styles.segmentBadge}>
              <Text style={styles.segmentBadgeText}>{incomingRequests.length}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'foryou' && styles.segmentActive]}
          onPress={() => setActiveTab('foryou')}
        >
          <Text style={[styles.segmentText, activeTab === 'foryou' && styles.segmentTextActive]}>
            For You
          </Text>
          {unreadCount > 0 && (
            <View style={styles.segmentBadge}>
              <Text style={styles.segmentBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {activeTab === 'foryou' ? (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={{ gap: 20 }}>
            <View>
              <Text style={styles.sectionLabel}>Recommended to you ({inbox.length})</Text>
              {inbox.length === 0 ? (
                <Text style={styles.emptyInline}>No recommendations yet.</Text>
              ) : (
                inbox.map((rec) => {
                  const inMine = alreadyMine(rec);
                  const isAdding = addingId === rec.id;
                  return (
                    <View key={rec.id} style={styles.row}>
                      <View style={styles.rowMain}>
                        {rec.poster_url ? (
                          <Image source={{ uri: rec.poster_url }} style={styles.recPoster} />
                        ) : (
                          <View style={[styles.recPoster, styles.avatarFallback]}>
                            <Text style={styles.avatarFallbackText}>{rec.title.charAt(0)}</Text>
                          </View>
                        )}
                        <View style={styles.rowInfo}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {rec.title}
                          </Text>
                          <Text style={styles.rowEmail} numberOfLines={1}>
                            from {rec.otherUser?.name ?? 'a friend'}
                          </Text>
                          {rec.message && (
                            <Text style={styles.recMessage} numberOfLines={2}>
                              &quot;{rec.message}&quot;
                            </Text>
                          )}
                        </View>
                      </View>
                      <Pressable
                        style={[styles.iconButton, styles.acceptButton, inMine && styles.addedButton]}
                        disabled={inMine || isAdding}
                        onPress={() => handleAddRecommendation(rec)}
                      >
                        {isAdding ? (
                          <ActivityIndicator size="small" color={theme.primaryText} />
                        ) : (
                          <Ionicons name={inMine ? 'checkmark' : 'add'} size={16} color={theme.primaryText} />
                        )}
                      </Pressable>
                      <Pressable style={styles.iconButton} onPress={() => dismiss(rec.id)}>
                        <Ionicons name="close" size={16} color={theme.danger} />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>

            <View>
              <Text style={styles.sectionLabel}>Sent by you ({sent.length})</Text>
              {sent.length === 0 ? (
                <Text style={styles.emptyInline}>You haven&apos;t recommended anything yet.</Text>
              ) : (
                sent.map((rec) => (
                  <View key={rec.id} style={styles.row}>
                    <View style={styles.rowMain}>
                      {rec.poster_url ? (
                        <Image source={{ uri: rec.poster_url }} style={styles.recPoster} />
                      ) : (
                        <View style={[styles.recPoster, styles.avatarFallback]}>
                          <Text style={styles.avatarFallbackText}>{rec.title.charAt(0)}</Text>
                        </View>
                      )}
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {rec.title}
                        </Text>
                        <Text style={styles.rowEmail} numberOfLines={1}>
                          to {rec.otherUser?.name ?? 'a friend'}
                        </Text>
                      </View>
                    </View>
                    <Pressable style={styles.iconButton} onPress={() => dismiss(rec.id)}>
                      <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      ) : activeTab === 'friends' ? (
        isLoading && friends.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={40} color={theme.textFaint} />
            <Text style={styles.emptyText}>No friends yet. Add someone by email above.</Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: f }) => (
              <View style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => f.otherUser?.id && router.push(`/friends/${f.otherUser.id}`)}
                >
                  <Avatar user={f.otherUser} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {f.otherUser?.name ?? 'Unknown user'}
                    </Text>
                    {f.otherUser?.email && (
                      <Text style={styles.rowEmail} numberOfLines={1}>
                        {f.otherUser.email}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="library-outline" size={18} color={theme.textMuted} />
                </Pressable>
                <Pressable style={styles.iconButton} onPress={() => removeFriend(f.id)}>
                  <Ionicons name="trash-outline" size={16} color={theme.danger} />
                </Pressable>
              </View>
            )}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={{ gap: 20 }}>
              <View>
                <Text style={styles.sectionLabel}>Incoming ({incomingRequests.length})</Text>
                {incomingRequests.length === 0 ? (
                  <Text style={styles.emptyInline}>No incoming requests.</Text>
                ) : (
                  incomingRequests.map((f) => (
                    <View key={f.id} style={styles.row}>
                      <View style={styles.rowMain}>
                        <Avatar user={f.otherUser} />
                        <View style={styles.rowInfo}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {f.otherUser?.name ?? 'Unknown user'}
                          </Text>
                          {f.otherUser?.email && (
                            <Text style={styles.rowEmail} numberOfLines={1}>
                              {f.otherUser.email}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Pressable
                        style={[styles.iconButton, styles.acceptButton]}
                        onPress={() => acceptRequest(f.id)}
                      >
                        <Ionicons name="checkmark" size={16} color={theme.primaryText} />
                      </Pressable>
                      <Pressable style={styles.iconButton} onPress={() => declineRequest(f.id)}>
                        <Ionicons name="close" size={16} color={theme.danger} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>

              <View>
                <Text style={styles.sectionLabel}>Sent ({outgoingRequests.length})</Text>
                {outgoingRequests.length === 0 ? (
                  <Text style={styles.emptyInline}>No outgoing requests.</Text>
                ) : (
                  outgoingRequests.map((f) => (
                    <View key={f.id} style={styles.row}>
                      <View style={styles.rowMain}>
                        <Avatar user={f.otherUser} />
                        <View style={styles.rowInfo}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {f.otherUser?.name ?? 'Unknown user'}
                          </Text>
                          <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>Pending</Text>
                          </View>
                        </View>
                      </View>
                      <Pressable style={styles.iconButton} onPress={() => removeFriend(f.id)}>
                        <Ionicons name="trash-outline" size={16} color={theme.danger} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
          </View>
        </ScrollView>
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
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    headerSub: {
      color: theme.textFaint,
      fontSize: 12,
      marginTop: 2,
    },
    addCard: {
      margin: 16,
      marginBottom: 12,
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      padding: 14,
    },
    addCardLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    addCardLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    addRow: {
      flexDirection: 'row',
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    sendButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonText: {
      color: theme.primaryText,
      fontSize: 13,
      fontWeight: '700',
    },
    feedback: {
      fontSize: 12,
      marginTop: 8,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    codeText: {
      flex: 1,
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: 2,
    },
    regenButton: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
    },
    codeHint: {
      color: theme.textFaint,
      fontSize: 11,
      marginTop: 6,
    },
    segmentRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      padding: 3,
      gap: 3,
      marginBottom: 12,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 9,
    },
    segmentActive: {
      backgroundColor: theme.primary,
    },
    segmentText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: theme.primaryText,
    },
    segmentBadge: {
      backgroundColor: theme.danger,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    segmentBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '800',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 32,
    },
    emptyText: {
      color: theme.textMuted,
      textAlign: 'center',
      fontSize: 14,
    },
    emptyInline: {
      color: theme.textFaint,
      fontSize: 13,
    },
    list: {
      padding: 16,
      paddingTop: 0,
      gap: 10,
    },
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      padding: 12,
      marginBottom: 10,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    rowInfo: {
      flex: 1,
      minWidth: 0,
    },
    rowName: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    rowEmail: {
      color: theme.textFaint,
      fontSize: 11,
      marginTop: 2,
    },
    avatarFallback: {
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      color: theme.primaryText,
      fontWeight: '800',
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isManga ? 'rgba(176,0,32,0.08)' : 'rgba(239,68,68,0.12)',
    },
    acceptButton: {
      backgroundColor: theme.success,
    },
    addedButton: {
      backgroundColor: theme.card,
    },
    recPoster: {
      width: 44,
      height: 60,
      borderRadius: 8,
    },
    recMessage: {
      color: theme.textFaint,
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: 2,
    },
    pendingBadge: {
      alignSelf: 'flex-start',
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 4,
    },
    pendingBadgeText: {
      color: theme.textMuted,
      fontSize: 9,
      fontWeight: '700',
    },
  });
}

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  FlatList,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, getCurrentUserId } from '../lib/supabase';
import { useMediaStore } from '../store/mediaStore';
import { useCollectionStore } from '../store/collectionStore';
import { useFriendStore } from '../store/friendStore';
import { getAIClient } from '../lib/ai';
import { ReadOnlyMediaSheetContent } from '../components/ReadOnlyMediaSheet';
import { useTheme } from '../lib/ThemeContext';
import type { ThemePalette } from '../lib/theme';
import { getTypeLabel } from '../lib/utils';
import type {
  SmartCollection,
  SharedCollection,
  Media,
  CollectionShareWithProfile,
  AISmartCollection,
} from '../lib/types';

type DetailTarget = { id: string; kind: 'own' | 'shared' } | null;

// Mirrors the web app's src/app/collections/page.tsx - manual collections,
// sharing them with friends, and AI-generated ones. AI drafts live only in
// this screen's own state (not persisted like web's db.aiCollectionDrafts
// IndexedDB table) - they don't survive navigating away before saving,
// which is a real, deliberate simplification for this pass rather than
// porting Dexie draft-persistence to mobile.
//
// Every "sub-flow" reachable from an open collection's detail sheet (add
// media, view a non-owned item read-only) renders as an internal sub-view
// INSIDE that same <Modal>, never as a second nested <Modal> - React
// Native doesn't reliably support two native Modals open at once (the
// first one can swallow touches meant for the second), unlike stacked web
// dialogs. This was a real bug here: add-media silently did nothing
// because it was a Modal opened on top of the still-open detail Modal.
export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const currentUserId = getCurrentUserId();

  const { media, fetchMedia } = useMediaStore();
  const { collections, sharedWithMe, fetchCollections, fetchSharedWithMe, addCollection, deleteCollection } =
    useCollectionStore();

  const [activeTab, setActiveTab] = useState<'my' | 'ai' | 'shared'>('my');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMediaIds, setNewMediaIds] = useState<string[]>([]);

  const [aiDrafts, setAiDrafts] = useState<AISmartCollection[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingDraftIndex, setSavingDraftIndex] = useState<number | null>(null);

  const [detail, setDetail] = useState<DetailTarget>(null);
  const [shareTarget, setShareTarget] = useState<SmartCollection | null>(null);

  // Re-derived live from the store every render, rather than snapshotted
  // once when opened - addMediaToCollection/removeMediaFromCollection
  // mutate the store, so this picks the change up automatically instead
  // of needing its own local media_ids copy to stay in sync.
  const detailOwn = detail?.kind === 'own' ? collections.find((c) => c.id === detail.id) ?? null : null;
  const detailShared = detail?.kind === 'shared' ? sharedWithMe.find((c) => c.id === detail.id) ?? null : null;

  useEffect(() => {
    fetchCollections();
    fetchSharedWithMe();
    // This screen can be reached without the dashboard ever having run
    // its own fetchMedia() first - needed both for "my collection" detail
    // resolution and the add-media picker's pool.
    fetchMedia();
  }, [fetchCollections, fetchSharedWithMe, fetchMedia]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await addCollection({
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      media_ids: newMediaIds,
      filter_criteria: null,
      is_auto_generated: false,
    });
    setNewTitle('');
    setNewDescription('');
    setNewMediaIds([]);
    setIsCreateOpen(false);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const ai = getAIClient();
      // Existing saved collections plus whatever drafts are still on
      // screen from a previous generate (about to be replaced below) -
      // both count as "already have this", so tapping Generate again
      // doesn't just reproduce the same groupings under a new title.
      const avoidTitles = [...collections.map((c) => c.title), ...aiDrafts.map((d) => d.title)];
      const generated = await ai.generateSmartCollections(
        media.map((m) => ({ title: m.title, type: m.type, genres: m.genres, ai_primary_tone: m.ai_primary_tone })),
        avoidTitles
      );
      if (generated) {
        setAiDrafts(generated);
        setActiveTab('ai');
      } else {
        Alert.alert(
          'AI collections are unavailable',
          'Check that a Groq or Gemini API key is set in Settings.'
        );
      }
    } catch (e: any) {
      Alert.alert('Generation failed', e?.message || 'Something went wrong.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async (draft: AISmartCollection, index: number) => {
    setSavingDraftIndex(index);
    try {
      const mediaIds: string[] = [];
      draft.media_titles.forEach((title) => {
        const matched = media.find(
          (m) =>
            m.title.toLowerCase().includes(title.toLowerCase()) ||
            title.toLowerCase().includes(m.title.toLowerCase())
        );
        if (matched) mediaIds.push(matched.id);
      });

      await addCollection({
        title: draft.title,
        description: draft.description,
        media_ids: mediaIds,
        filter_criteria: null,
        is_auto_generated: true,
      });

      setAiDrafts((prev) => prev.filter((_, i) => i !== index));
    } catch (e: any) {
      Alert.alert('Failed to save', e?.message || 'Something went wrong.');
    } finally {
      setSavingDraftIndex(null);
    }
  };

  const handleDiscardDraft = (index: number) => {
    setAiDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDelete = (collection: SmartCollection) => {
    Alert.alert('Delete this collection?', collection.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCollection(collection.id) },
    ]);
  };

  const openItem = (item: Media) => {
    setDetail(null);
    router.push(`/media/${item.id}`);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Collections' }} />

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>COLLECTIONS</Text>
          <Text style={styles.headerSub}>コレクション</Text>
        </View>
        <Pressable style={styles.newButton} onPress={() => setIsCreateOpen(true)}>
          <Ionicons name="add" size={16} color={theme.primaryText} />
          <Text style={styles.newButtonText}>New</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.generateButton, (isGenerating || media.length === 0) && styles.generateButtonDisabled]}
        onPress={handleGenerate}
        disabled={isGenerating || media.length === 0}
      >
        {isGenerating ? (
          <ActivityIndicator color={theme.primaryText} />
        ) : (
          <Ionicons name="color-wand-outline" size={18} color={theme.primaryText} />
        )}
        <Text style={styles.generateButtonText}>
          {isGenerating ? 'Generating...' : 'Generate AI Collections'}
        </Text>
      </Pressable>
      {media.length === 0 && <Text style={styles.aiNoteText}>Add media to generate AI collections.</Text>}

      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segment, activeTab === 'my' && styles.segmentActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.segmentText, activeTab === 'my' && styles.segmentTextActive]}>
            My ({collections.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'ai' && styles.segmentActive]}
          onPress={() => setActiveTab('ai')}
        >
          <Text style={[styles.segmentText, activeTab === 'ai' && styles.segmentTextActive]}>
            AI ({aiDrafts.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'shared' && styles.segmentActive]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.segmentText, activeTab === 'shared' && styles.segmentTextActive]}>
            Shared ({sharedWithMe.length})
          </Text>
        </Pressable>
      </View>

      {activeTab === 'my' ? (
        collections.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="folder-outline" size={40} color={theme.textFaint} />
            <Text style={styles.emptyText}>No collections yet.</Text>
          </View>
        ) : (
          <FlatList
            data={collections}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: c }) => (
              <Pressable style={styles.card} onPress={() => setDetail({ id: c.id, kind: 'own' })}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardIconRow}>
                    <View style={styles.cardIcon}>
                      <Ionicons name="folder" size={16} color="#fff" />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {c.title}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable style={styles.cardActionButton} onPress={() => setShareTarget(c)}>
                      <Ionicons name="share-social-outline" size={16} color={theme.textMuted} />
                    </Pressable>
                    <Pressable style={styles.cardActionButton} onPress={() => handleDelete(c)}>
                      <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    </Pressable>
                  </View>
                </View>
                {c.description && (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {c.description}
                  </Text>
                )}
                <View style={styles.badgeRow}>
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>
                      {c.media_ids.length} {c.media_ids.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  {c.is_auto_generated && (
                    <View style={styles.aiBadge}>
                      <Ionicons name="sparkles" size={9} color={theme.accent} />
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            )}
          />
        )
      ) : activeTab === 'ai' ? (
        aiDrafts.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="sparkles-outline" size={40} color={theme.textFaint} />
            <Text style={styles.emptyText}>No AI suggestions yet - tap Generate above.</Text>
          </View>
        ) : (
          <FlatList
            data={aiDrafts}
            keyExtractor={(_, i) => `draft-${i}`}
            contentContainerStyle={styles.list}
            renderItem={({ item: draft, index }) => (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardIconRow}>
                    <View style={[styles.cardIcon, styles.aiCardIcon]}>
                      <Ionicons name="sparkles" size={16} color="#fff" />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {draft.title}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.cardActionButton}
                      onPress={() => handleSaveDraft(draft, index)}
                      disabled={savingDraftIndex === index}
                    >
                      {savingDraftIndex === index ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
                      )}
                    </Pressable>
                    <Pressable style={styles.cardActionButton} onPress={() => handleDiscardDraft(index)}>
                      <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    </Pressable>
                  </View>
                </View>
                {draft.description && <Text style={styles.cardDescription}>{draft.description}</Text>}
                <View style={styles.chipRow}>
                  {draft.media_titles.slice(0, 4).map((t) => (
                    <View key={t} style={styles.miniChip}>
                      <Text style={styles.miniChipText} numberOfLines={1}>
                        {t}
                      </Text>
                    </View>
                  ))}
                  {draft.media_titles.length > 4 && (
                    <View style={styles.miniChip}>
                      <Text style={styles.miniChipText}>+{draft.media_titles.length - 4}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          />
        )
      ) : sharedWithMe.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={40} color={theme.textFaint} />
          <Text style={styles.emptyText}>No collections shared with you yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sharedWithMe}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: c }) => (
            <Pressable style={styles.card} onPress={() => setDetail({ id: c.id, kind: 'shared' })}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardIconRow}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="folder" size={16} color="#fff" />
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {c.title}
                  </Text>
                </View>
              </View>
              {c.description && (
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {c.description}
                </Text>
              )}
              <View style={styles.cardBottomRow}>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>
                    {c.media_ids.length} {c.media_ids.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
                {c.owner && (
                  <View style={styles.ownerRow}>
                    {c.owner.imageUrl ? (
                      <Image source={{ uri: c.owner.imageUrl }} style={styles.ownerAvatar} />
                    ) : (
                      <Ionicons name="person-circle-outline" size={16} color={theme.textFaint} />
                    )}
                    <Text style={styles.ownerName}>{c.owner.name}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Create collection */}
      <Modal
        visible={isCreateOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsCreateOpen(false)}
      >
        <ScrollView
          style={{ backgroundColor: theme.bg }}
          contentContainerStyle={[styles.sheetContent, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Create Collection</Text>
            <Pressable style={styles.close} onPress={() => setIsCreateOpen(false)}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="e.g., My Top Anime"
            placeholderTextColor={theme.textFaint}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={newDescription}
            onChangeText={setNewDescription}
            placeholder="What's this collection about?"
            placeholderTextColor={theme.textFaint}
            multiline
          />

          <Text style={styles.fieldLabel}>Media ({newMediaIds.length} selected)</Text>
          <View style={styles.pickerBox}>
            {media.length === 0 ? (
              <Text style={styles.emptyInline}>Nothing in your library yet.</Text>
            ) : (
              media.map((item) => {
                const checked = newMediaIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={styles.pickerRow}
                    onPress={() =>
                      setNewMediaIds((prev) =>
                        checked ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                      )
                    }
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={12} color={theme.primaryText} />}
                    </View>
                    <Text style={styles.pickerRowText} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.pickerRowType}>{getTypeLabel(item.type)}</Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <Pressable
            style={[styles.primaryButton, !newTitle.trim() && styles.primaryButtonDisabled]}
            onPress={handleCreate}
            disabled={!newTitle.trim()}
          >
            <Text style={styles.primaryButtonText}>Create</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      {/* Collection detail - own and shared both live in this ONE Modal;
          which content renders depends on `detail.kind`. Add-media and a
          shared item's read-only view are internal sub-views of these
          components, not separate Modals. */}
      <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetail(null)}>
        {detailOwn && (
          <OwnCollectionDetail collection={detailOwn} allMedia={media} onClose={() => setDetail(null)} onOpenItem={openItem} />
        )}
        {detailShared && (
          <SharedCollectionDetail
            collection={detailShared}
            currentUserId={currentUserId}
            onClose={() => setDetail(null)}
            onOpenOwn={openItem}
          />
        )}
      </Modal>

      <ShareCollectionSheet collection={shareTarget} onClose={() => setShareTarget(null)} />
    </View>
  );
}

// --- Own collection's detail - items are always your own media, so
// tapping one opens the full editable media/[id] screen. Add-media is an
// internal sub-view, not a nested Modal. ---
function OwnCollectionDetail({
  collection,
  allMedia,
  onClose,
  onOpenItem,
}: {
  collection: SmartCollection;
  allMedia: Media[];
  onClose: () => void;
  onOpenItem: (item: Media) => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { addMediaToCollection, removeMediaFromCollection } = useCollectionStore();
  const [subView, setSubView] = useState<'list' | 'add'>('list');

  const items = allMedia.filter((m) => collection.media_ids.includes(m.id));

  if (subView === 'add') {
    return (
      <AddMediaPickerContent
        pool={allMedia}
        excludeIds={collection.media_ids}
        onBack={() => setSubView('list')}
        onAdd={(mediaId) => addMediaToCollection(collection.id, mediaId)}
      />
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.sheetContent, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.sheetHeaderRow}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {collection.title}
        </Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Ionicons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>

      {collection.description && <Text style={styles.sheetDescription}>{collection.description}</Text>}

      <View style={styles.sheetSectionHeader}>
        <Text style={styles.sheetSectionLabel}>Media in collection</Text>
        <Pressable onPress={() => setSubView('add')} style={styles.addLink}>
          <Ionicons name="add" size={14} color={theme.primary} />
          <Text style={styles.addLinkText}>Add</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyInline}>No media in this collection yet.</Text>
      ) : (
        items.map((item) => (
          <MediaRow
            key={item.id}
            item={item}
            onPress={() => onOpenItem(item)}
            onRemove={() => removeMediaFromCollection(collection.id, item.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

// --- Shared collection's detail - items point at the owner/collaborators'
// media rows, not necessarily your own, so this fetches them fresh (like
// web) rather than filtering your own media list. RLS ("select friends
// media") is what actually makes this return anything. Add-media and a
// non-owned item's read-only view are internal sub-views, not nested
// Modals. ---
function SharedCollectionDetail({
  collection,
  currentUserId,
  onClose,
  onOpenOwn,
}: {
  collection: SharedCollection;
  currentUserId: string | undefined;
  onClose: () => void;
  onOpenOwn: (item: Media) => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { media: myMedia } = useMediaStore();
  const { addMediaToSharedCollection, removeMediaFromSharedCollection } = useCollectionStore();
  const [items, setItems] = useState<(Media & { user_id?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subView, setSubView] = useState<'list' | 'add'>('list');
  const [readOnlyItem, setReadOnlyItem] = useState<Media | null>(null);

  const mediaIdsKey = collection.media_ids.join(',');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      if (collection.media_ids.length === 0) {
        if (!cancelled) {
          setItems([]);
          setIsLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await (supabase as any).from('media').select('*').in('id', collection.media_ids);
        if (cancelled) return;
        if (error) throw error;
        setItems((data ?? []) as (Media & { user_id?: string })[]);
      } catch (e) {
        console.warn('Failed to load shared collection media:', e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection.id, mediaIdsKey]);

  if (subView === 'add') {
    return (
      <AddMediaPickerContent
        pool={myMedia}
        excludeIds={collection.media_ids}
        onBack={() => setSubView('list')}
        onAdd={(mediaId) => addMediaToSharedCollection(collection.id, mediaId)}
      />
    );
  }

  if (readOnlyItem) {
    return <ReadOnlyMediaSheetContent media={readOnlyItem} onClose={() => setReadOnlyItem(null)} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.sheetContent, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.sheetHeaderRow}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {collection.title}
        </Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Ionicons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>

      {collection.owner && <Text style={styles.sheetOwner}>Shared by {collection.owner.name}</Text>}
      {collection.description && <Text style={styles.sheetDescription}>{collection.description}</Text>}

      <View style={styles.sheetSectionHeader}>
        <Text style={styles.sheetSectionLabel}>Media in collection</Text>
        <Pressable onPress={() => setSubView('add')} style={styles.addLink}>
          <Ionicons name="add" size={14} color={theme.primary} />
          <Text style={styles.addLinkText}>Add</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
      ) : items.length === 0 ? (
        <Text style={styles.emptyInline}>No media in this collection.</Text>
      ) : (
        items.map((item) => {
          // Any collaborator's write to a media row itself is blocked by
          // RLS regardless (only the owning account can edit its own media)
          // - only open the full editable screen when this item is
          // actually yours.
          const isMine = item.user_id === currentUserId;
          return (
            <MediaRow
              key={item.id}
              item={item}
              onPress={() => (isMine ? onOpenOwn(item) : setReadOnlyItem(item))}
              onRemove={() => removeMediaFromSharedCollection(collection.id, item.id)}
            />
          );
        })
      )}
    </ScrollView>
  );
}

function MediaRow({ item, onPress, onRemove }: { item: Media; onPress: () => void; onRemove: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable style={styles.mediaRow} onPress={onPress}>
      {item.poster_url ? (
        <Image source={{ uri: item.poster_url }} style={styles.mediaRowPoster} />
      ) : (
        <View style={[styles.mediaRowPoster, styles.mediaRowPosterFallback]}>
          <Text style={{ color: theme.textFaint, fontWeight: '900' }}>{item.title.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.mediaRowInfo}>
        <Text style={styles.mediaRowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.mediaRowType}>{getTypeLabel(item.type)}</Text>
      </View>
      <Pressable
        style={styles.mediaRowRemove}
        onPress={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Ionicons name="close" size={16} color={theme.danger} />
      </Pressable>
    </Pressable>
  );
}

// Standalone Modal - always opened directly from the collection list, never
// nested inside another open Modal, so this one is safe as its own <Modal>.
function ShareCollectionSheet({ collection, onClose }: { collection: SmartCollection | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { friends, fetchFriends } = useFriendStore();
  const { fetchSharesForCollection, shareCollection, unshareCollection } = useCollectionStore();
  const [shares, setShares] = useState<CollectionShareWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!collection) return;
    fetchFriends();
    setIsLoading(true);
    fetchSharesForCollection(collection.id)
      .then(setShares)
      .finally(() => setIsLoading(false));
  }, [collection, fetchFriends, fetchSharesForCollection]);

  const sharedWithIds = new Set(shares.map((s) => s.shared_with_id));

  const handleToggle = async (friendId: string) => {
    if (!collection) return;
    setBusyId(friendId);
    try {
      const existing = shares.find((s) => s.shared_with_id === friendId);
      if (existing) {
        await unshareCollection(existing.id);
        setShares((prev) => prev.filter((s) => s.id !== existing.id));
      } else {
        const result = await shareCollection(collection.id, friendId);
        if (result.success) {
          const updated = await fetchSharesForCollection(collection.id);
          setShares(updated);
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={!!collection} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {collection && (
        <ScrollView
          style={{ backgroundColor: theme.bg }}
          contentContainerStyle={[styles.sheetContent, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              Share &quot;{collection.title}&quot;
            </Text>
            <Pressable style={styles.close} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
          ) : friends.length === 0 ? (
            <Text style={styles.emptyInline}>Add friends first to share collections with them.</Text>
          ) : (
            friends.map((f) => {
              const isShared = f.otherUser && sharedWithIds.has(f.otherUser.id);
              const isBusy = busyId === f.otherUser?.id;
              return (
                <View key={f.id} style={styles.shareRow}>
                  {f.otherUser?.imageUrl ? (
                    <Image source={{ uri: f.otherUser.imageUrl }} style={styles.shareAvatar} />
                  ) : (
                    <View style={[styles.shareAvatar, styles.shareAvatarFallback]}>
                      <Text style={styles.shareAvatarFallbackText}>
                        {f.otherUser?.name?.[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.shareName} numberOfLines={1}>
                    {f.otherUser?.name}
                  </Text>
                  <Pressable
                    style={[styles.shareButton, isShared && styles.shareButtonActive]}
                    disabled={isBusy || !f.otherUser}
                    onPress={() => f.otherUser && handleToggle(f.otherUser.id)}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={isShared ? theme.danger : theme.primaryText} />
                    ) : (
                      <Text style={[styles.shareButtonText, isShared && styles.shareButtonTextActive]}>
                        {isShared ? 'Remove' : 'Share'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </Modal>
  );
}

// Unwrapped content (no <Modal> of its own) - rendered as an internal
// sub-view of whichever collection-detail Modal is currently open, so
// "add media" never nests a second native Modal on top of the first.
function AddMediaPickerContent({
  pool,
  excludeIds,
  onBack,
  onAdd,
}: {
  pool: Media[];
  excludeIds: string[];
  onBack: () => void;
  onAdd: (mediaId: string) => Promise<void> | void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const available = pool.filter((m) => !excludeIds.includes(m.id));
  const filtered = search.trim()
    ? available.filter((m) => m.title.toLowerCase().includes(search.trim().toLowerCase()))
    : available;

  const handleAdd = async (mediaId: string) => {
    setAddingId(mediaId);
    try {
      await onAdd(mediaId);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.sheetContent, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.sheetHeaderRow}>
        <Pressable style={styles.close} onPress={onBack}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </Pressable>
        <Text style={styles.sheetTitle}>Add Media</Text>
      </View>
      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder="Search your library..."
        placeholderTextColor={theme.textFaint}
      />
      {filtered.length === 0 ? (
        <Text style={styles.emptyInline}>
          {available.length === 0 ? "Everything's already in this collection." : 'No matches.'}
        </Text>
      ) : (
        filtered.map((item) => (
          <View key={item.id} style={styles.pickerListRow}>
            {item.poster_url ? (
              <Image source={{ uri: item.poster_url }} style={styles.pickerListPoster} />
            ) : (
              <View style={[styles.pickerListPoster, styles.mediaRowPosterFallback]}>
                <Text style={{ color: theme.textFaint, fontWeight: '900' }}>{item.title.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.pickerListTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Pressable style={styles.pickerListAdd} disabled={addingId === item.id} onPress={() => handleAdd(item.id)}>
              {addingId === item.id ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <Ionicons name="add" size={16} color={theme.primaryText} />
              )}
            </Pressable>
          </View>
        ))
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
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingTop: 12,
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
    newButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    newButtonText: {
      color: theme.primaryText,
      fontSize: 13,
      fontWeight: '700',
    },
    aiNoteText: {
      color: theme.textFaint,
      fontSize: 12,
      textAlign: 'center',
      marginHorizontal: 16,
      marginTop: 10,
    },
    segmentRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 12,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
      marginTop: 8,
    },
    list: {
      padding: 16,
      paddingTop: 0,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      padding: 14,
      marginBottom: 10,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    cardIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
      flexShrink: 1,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 4,
    },
    cardActionButton: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardDescription: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 8,
      lineHeight: 17,
    },
    cardBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    cardBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    cardBadgeText: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.isManga ? 'rgba(217,30,54,0.1)' : 'rgba(232,121,249,0.15)',
      borderWidth: theme.borderWidth,
      borderColor: theme.isManga ? theme.primary : 'rgba(232,121,249,0.4)',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    aiBadgeText: {
      color: theme.isManga ? theme.primary : theme.accent,
      fontSize: 10,
      fontWeight: '700',
    },
    aiCardIcon: {
      backgroundColor: theme.isManga ? theme.primary : theme.accent,
    },
    miniChip: {
      backgroundColor: theme.input,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      maxWidth: 140,
    },
    miniChipText: {
      color: theme.textMuted,
      fontSize: 11,
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: theme.isManga ? theme.primary : theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
    },
    generateButtonDisabled: {
      opacity: 0.5,
    },
    generateButtonText: {
      color: theme.primaryText,
      fontSize: 14,
      fontWeight: '700',
    },
    ownerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    ownerAvatar: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    ownerName: {
      color: theme.textFaint,
      fontSize: 11,
    },
    sheetContent: {
      padding: 20,
      paddingBottom: 40,
    },
    sheetHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    sheetTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '900',
      flex: 1,
    },
    close: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetOwner: {
      color: theme.textFaint,
      fontSize: 11,
      marginBottom: 6,
    },
    sheetDescription: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 12,
    },
    sheetSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 10,
    },
    sheetSectionLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    addLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    addLinkText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    mediaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      padding: 8,
      marginBottom: 8,
    },
    mediaRowPoster: {
      width: 36,
      height: 50,
      borderRadius: 8,
    },
    mediaRowPosterFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.input,
    },
    mediaRowInfo: {
      flex: 1,
      minWidth: 0,
    },
    mediaRowTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    mediaRowType: {
      color: theme.textFaint,
      fontSize: 10,
      marginTop: 2,
    },
    mediaRowRemove: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 14,
      marginBottom: 8,
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
      marginBottom: 8,
    },
    textArea: {
      minHeight: 70,
      textAlignVertical: 'top',
    },
    pickerBox: {
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      padding: 6,
      maxHeight: 260,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    pickerRowText: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
    },
    pickerRowType: {
      color: theme.textFaint,
      fontSize: 10,
    },
    primaryButton: {
      marginTop: 20,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      color: theme.primaryText,
      fontSize: 14,
      fontWeight: '700',
    },
    shareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      padding: 10,
      marginBottom: 8,
    },
    shareAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    shareAvatarFallback: {
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareAvatarFallbackText: {
      color: theme.primaryText,
      fontSize: 12,
      fontWeight: '800',
    },
    shareName: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
    },
    shareButton: {
      backgroundColor: theme.primary,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    shareButtonActive: {
      backgroundColor: theme.isManga ? 'rgba(176,0,32,0.1)' : 'rgba(239,68,68,0.15)',
    },
    shareButtonText: {
      color: theme.primaryText,
      fontSize: 11,
      fontWeight: '700',
    },
    shareButtonTextActive: {
      color: theme.danger,
    },
    pickerListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      padding: 8,
      marginBottom: 8,
    },
    pickerListPoster: {
      width: 32,
      height: 44,
      borderRadius: 7,
    },
    pickerListTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
    },
    pickerListAdd: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

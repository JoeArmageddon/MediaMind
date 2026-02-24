'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft, Plus, Film, Wand2, Folder, Trash2, X, Edit3, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAIClient } from '@/lib/ai';
import { useMediaStore } from '@/store/mediaStore';
import { useCollectionStore } from '@/store/collectionStore';
import { cn, getTypeLabel } from '@/lib/utils';
import type { AISmartCollection, SmartCollection, Media } from '@/types';

// Type guard functions to properly narrow union types
function isSmartCollection(coll: SmartCollection | AISmartCollection): coll is SmartCollection {
  return 'media_ids' in coll;
}

function isAICollection(coll: SmartCollection | AISmartCollection): coll is AISmartCollection {
  return 'media_titles' in coll;
}

// Safe title accessor
function getCollectionTitle(coll: SmartCollection | AISmartCollection): string {
  if (isSmartCollection(coll) || isAICollection(coll)) {
    return coll.title;
  }
  return '';
}

// Helper component to render collection detail content with proper typing
function CollectionDetailContent({ 
  collection, 
  media, 
  getMediaForCollection 
}: { 
  collection: SmartCollection | AISmartCollection;
  media: Media[];
  getMediaForCollection: (c: SmartCollection) => Media[];
}) {
  const title = getCollectionTitle(collection);
  const description = isAICollection(collection) || isSmartCollection(collection) ? collection.description : null;
  
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {description && (
          <p className="text-white/60 text-sm leading-relaxed">{description}</p>
        )}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">
            {isSmartCollection(collection) ? 'Media in collection' : 'Suggested media'}
          </h4>
          {isSmartCollection(collection) ? (
            // User collection - show actual media
            (() => {
              const collMedia = getMediaForCollection(collection);
              return collMedia.length > 0 ? (
                collMedia.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      {item.poster_url ? (
                        <img src={item.poster_url} alt={item.title} className="w-10 h-14 object-cover rounded-lg" />
                      ) : (
                        <div className="w-10 h-14 bg-white/10 rounded-lg flex items-center justify-center text-lg font-bold">
                          {item.title[0]}
                        </div>
                      )}
                      <div>
                        <span className="text-white font-medium text-sm">{item.title}</span>
                        <p className="text-xs text-white/40">{getTypeLabel(item.type)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-white/40 text-sm text-center py-4">No media in this collection yet.</p>
              );
            })()
          ) : (
            // AI collection - show suggested titles
            isAICollection(collection) && collection.media_titles?.map((title) => (
              <div
                key={title}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
              >
                <span className="text-white font-medium text-sm">{title}</span>
                {media.find(m => m.title.toLowerCase().includes(title.toLowerCase())) && (
                  <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-400">
                    In Library
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default function SmartCollectionsPage() {
  const router = useRouter();
  const { media } = useMediaStore();
  const { collections, isLoading, fetchCollections, addCollection, deleteCollection, addMediaToCollection } = useCollectionStore();
  
  const [aiCollections, setAiCollections] = useState<AISmartCollection[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<SmartCollection | AISmartCollection | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('my');

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const ai = getAIClient();
      const newCollections = await ai.generateSmartCollections(
        media.map((m) => ({
          title: m.title,
          type: m.type,
          genres: m.genres,
          ai_primary_tone: m.ai_primary_tone,
        }))
      );
      if (newCollections) {
        setAiCollections(newCollections);
        setActiveTab('ai');
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate AI collections. Make sure you have a Groq or Gemini API key configured in Settings.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    await addCollection({
      title: newCollectionName,
      description: newCollectionDesc || null,
      media_ids: selectedMediaIds,
      filter_criteria: null,
      is_auto_generated: false,
    });

    setNewCollectionName('');
    setNewCollectionDesc('');
    setSelectedMediaIds([]);
    setIsCreateOpen(false);
  };

  const handleSaveAICollection = async (aiCollection: AISmartCollection) => {
    // Find media IDs that match the titles in the AI collection
    const mediaIds: string[] = [];
    aiCollection.media_titles.forEach((title) => {
      const matchedMedia = media.find(
        (m) => m.title.toLowerCase().includes(title.toLowerCase()) || 
               title.toLowerCase().includes(m.title.toLowerCase())
      );
      if (matchedMedia) {
        mediaIds.push(matchedMedia.id);
      }
    });

    await addCollection({
      title: aiCollection.title,
      description: aiCollection.description,
      media_ids: mediaIds,
      filter_criteria: null,
      is_auto_generated: true,
    });

    alert(`"${aiCollection.title}" saved to your collections!`);
  };

  const getMediaForCollection = (collection: SmartCollection): Media[] => {
    return media.filter((m) => collection.media_ids.includes(m.id));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">COLLECTIONS</h1>
            <p className="text-sm text-white/50 font-mono">コレクション</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || media.length === 0}
          className="flex-1 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 text-white rounded-xl h-14"
        >
          <Wand2 className={cn('mr-2 h-5 w-5', isGenerating && 'animate-spin')} />
          {isGenerating ? 'Generating...' : 'Generate AI Collections'}
        </Button>
      </div>

      {media.length === 0 && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-white/50">Add some media to your library first to generate AI collections.</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/5 p-1 rounded-2xl h-auto">
          <TabsTrigger 
            value="my" 
            className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60"
          >
            <Folder className="h-4 w-4 mr-2" />
            My Collections ({collections.length})
          </TabsTrigger>
          <TabsTrigger 
            value="ai"
            className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI Generated ({aiCollections.length})
          </TabsTrigger>
        </TabsList>

        {/* My Collections */}
        <TabsContent value="my" className="mt-6">
          {collections.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Folder className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No collections yet.</p>
              <p className="text-sm text-white/30 mt-2">Create your own or generate AI collections.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => setSelectedCollection(collection)}
                  className="glass-card rounded-[24px] p-6 cursor-pointer hover:border-indigo-500/50 transition-all group relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <Folder className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-xl font-black text-white tracking-tight">{collection.title}</h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCollection(collection.id);
                        }}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {collection.description && (
                      <p className="text-white/60 text-sm mb-4 leading-relaxed">{collection.description}</p>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-white/5 border-white/10 text-white/80 rounded-lg px-3 py-1">
                        {collection.media_ids.length} items
                      </Badge>
                      {collection.is_auto_generated && (
                        <Badge variant="outline" className="border-fuchsia-500/50 text-fuchsia-400 rounded-lg">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* AI Collections */}
        <TabsContent value="ai" className="mt-6">
          {aiCollections.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Sparkles className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No AI collections yet.</p>
              <p className="text-sm text-white/30 mt-2">Click "Generate AI Collections" to create some.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {aiCollections.map((collection, index) => (
                <div
                  key={index}
                  className="glass-card rounded-[24px] p-6 hover:border-fuchsia-500/50 transition-all group relative overflow-hidden"
                >
                  {/* Background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                          <Film className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-xl font-black text-white tracking-tight">{collection.title}</h3>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSaveAICollection(collection)}
                        className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                    
                    <p className="text-white/60 text-sm mb-4 leading-relaxed">{collection.description}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {collection.media_titles.slice(0, 4).map((title) => (
                        <Badge 
                          key={title} 
                          variant="secondary" 
                          className="bg-white/5 border-white/10 text-white/80 rounded-lg px-3 py-1"
                        >
                          {title}
                        </Badge>
                      ))}
                      {collection.media_titles.length > 4 && (
                        <Badge variant="outline" className="border-white/10 text-white/50 rounded-lg">
                          +{collection.media_titles.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Collection Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg bg-[#0a0a0a] border-white/10 rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Name</label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g., My Top Anime"
                className="bg-black border-white/10 rounded-xl h-12"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Description (optional)</label>
              <Textarea
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                placeholder="What's this collection about?"
                className="bg-black border-white/10 rounded-xl min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                Select Media ({selectedMediaIds.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-white/10 rounded-xl p-2">
                {media.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMediaIds.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMediaIds([...selectedMediaIds, item.id]);
                        } else {
                          setSelectedMediaIds(selectedMediaIds.filter((id) => id !== item.id));
                        }
                      }}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span className="text-sm text-white truncate flex-1">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-white/50">
                      {getTypeLabel(item.type)}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
            <Button 
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Collection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Collection Detail Dialog */}
      <Dialog open={!!selectedCollection} onOpenChange={() => setSelectedCollection(null)}>
        <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10 rounded-[28px]">
          {selectedCollection && (
            <CollectionDetailContent 
              collection={selectedCollection} 
              media={media}
              getMediaForCollection={getMediaForCollection}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

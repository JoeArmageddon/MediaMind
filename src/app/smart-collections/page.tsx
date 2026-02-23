'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft, Plus, Film, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAIClient } from '@/lib/ai';
import { useMediaStore } from '@/store/mediaStore';
import { cn } from '@/lib/utils';
import type { AISmartCollection, Media } from '@/types';

// Mock collections
const mockCollections: AISmartCollection[] = [
  {
    title: 'Existential Journeys',
    description: 'Stories that question existence, meaning, and the human condition',
    media_titles: ['Attack on Titan', 'Vinland Saga', 'Blade Runner 2049'],
  },
  {
    title: 'Cozy Escapes',
    description: 'Comfort media for when you need a mental break',
    media_titles: ['Spy x Family', "Kiki's Delivery Service", 'The Grand Budapest Hotel'],
  },
  {
    title: 'Intense Thrill Rides',
    description: 'High-octane experiences that keep you on the edge',
    media_titles: ['Demon Slayer', 'Mad Max: Fury Road', 'Arcane'],
  },
];

export default function SmartCollectionsPage() {
  const router = useRouter();
  const { media } = useMediaStore();
  const [collections, setCollections] = useState<AISmartCollection[]>(mockCollections);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<AISmartCollection | null>(null);

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
        setCollections(newCollections);
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
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
            <h1 className="text-3xl font-black text-white tracking-tighter">AI COLLECTIONS</h1>
            <p className="text-sm text-white/50 font-mono">スマートコレクション</p>
          </div>
        </div>
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating}
          className="bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 text-white rounded-xl"
        >
          <Wand2 className={cn('mr-2 h-4 w-4', isGenerating && 'animate-spin')} />
          {isGenerating ? 'Generating...' : 'Generate'}
        </Button>
      </div>

      {/* Collections Grid */}
      <div className="grid gap-4">
        {collections.map((collection, index) => (
          <div
            key={collection.title}
            onClick={() => setSelectedCollection(collection)}
            className="glass-card rounded-[24px] p-6 cursor-pointer hover:border-fuchsia-500/50 transition-all group relative overflow-hidden"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                  <Film className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">{collection.title}</h3>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedCollection} onOpenChange={() => setSelectedCollection(null)}>
        <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10 rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              {selectedCollection?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-white/60 text-sm leading-relaxed">
              {selectedCollection?.description}
            </p>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Media in collection</h4>
              {selectedCollection?.media_titles.map((title) => (
                <div
                  key={title}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <span className="text-white font-medium">{title}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaStore } from '@/store/mediaStore';
import { Search, Loader2, Plus, ArrowLeft, Film, Tv, Gamepad2, BookOpen, Sparkles, Wand2, List, Check, X, Trash2, PenSquare, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSearchOrchestrator } from '@/lib/api/search';
import { getApiKey } from '@/lib/db/dexie';
import { cn, getTypeLabel, getUnitLabel } from '@/lib/utils';
import type { SearchResult, MediaType } from '@/types';

const searchTypes: { value: MediaType | 'all'; label: string; icon: React.ReactNode; gradient: string }[] = [
  { value: 'all', label: 'All', icon: <Sparkles className="h-4 w-4" />, gradient: 'from-slate-400 to-zinc-500' },
  { value: 'movie', label: 'Movies', icon: <Film className="h-4 w-4" />, gradient: 'from-cyan-500 to-blue-600' },
  { value: 'tv', label: 'TV', icon: <Tv className="h-4 w-4" />, gradient: 'from-violet-500 to-fuchsia-600' },
  { value: 'anime', label: 'Anime', icon: <Sparkles className="h-4 w-4" />, gradient: 'from-pink-500 to-rose-600' },
  { value: 'manhwa', label: 'Manhwa', icon: <BookOpen className="h-4 w-4" />, gradient: 'from-purple-500 to-indigo-600' },
  { value: 'manhua', label: 'Manhua', icon: <BookOpen className="h-4 w-4" />, gradient: 'from-rose-500 to-pink-600' },
  { value: 'donghua', label: 'Donghua', icon: <Sparkles className="h-4 w-4" />, gradient: 'from-red-500 to-rose-600' },
  { value: 'manga', label: 'Manga', icon: <BookOpen className="h-4 w-4" />, gradient: 'from-orange-500 to-red-600' },
  { value: 'game', label: 'Games', icon: <Gamepad2 className="h-4 w-4" />, gradient: 'from-emerald-400 to-teal-500' },
  { value: 'book', label: 'Books', icon: <BookOpen className="h-4 w-4" />, gradient: 'from-amber-400 to-orange-500' },
  { value: 'misc', label: 'Misc', icon: <MoreHorizontal className="h-4 w-4" />, gradient: 'from-gray-500 to-slate-600' },
];

interface BatchItem {
  id: string;
  title: string;
  status: 'pending' | 'searching' | 'found' | 'not_found' | 'added';
  result?: SearchResult;
  selectedResult?: SearchResult;
  results?: SearchResult[];
}

interface ManualFormData {
  title: string;
  type: MediaType;
  description: string;
  poster_url: string;
  release_year: string;
  total_units: string;
  genres: string;
  user_rating: string;
}

export default function SearchPage() {
  const router = useRouter();
  const { addMedia } = useMediaStore();
  const [mode, setMode] = useState<'single' | 'batch' | 'manual'>('single');
  
  // Single mode state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<MediaType | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualEntry, setManualEntry] = useState({ title: '', description: '' });

  // Batch mode state
  const [batchText, setBatchText] = useState('');
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchType, setBatchType] = useState<MediaType>('anime');

  // Manual add state
  const [manualForm, setManualForm] = useState<ManualFormData>({
    title: '',
    type: 'anime',
    description: '',
    poster_url: '',
    release_year: '',
    total_units: '',
    genres: '',
    user_rating: '',
  });

  const orchestrator = getSearchOrchestrator();

  const performSearch = useCallback(async (searchQuery: string, type: MediaType | 'all') => {
    if (!searchQuery.trim()) {
      setError('Please enter a search term');
      return;
    }

    // Check if API keys are configured (from IndexedDB - more reliable on mobile)
    const tmdbKey = await getApiKey('tmdb_key') || process.env.NEXT_PUBLIC_TMDB_API_KEY;
    const rawgKey = await getApiKey('rawg_key') || process.env.NEXT_PUBLIC_RAWG_API_KEY;
    
    if (!tmdbKey && (type === 'all' || type === 'movie' || type === 'tv')) {
      setError('TMDB API key missing. Please add it in Settings to search for Movies/TV.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setResults([]);
    setError(null);
    setShowManualAdd(false);

    try {
      const preferredType = type === 'all' ? undefined : type;
      const searchResults = await orchestrator.search(searchQuery, preferredType);
      
      setResults(searchResults);
      
      if (searchResults.length === 0) {
        setShowManualAdd(true);
        setManualEntry({ title: searchQuery, description: '' });
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Check your API keys in Settings, or add manually.');
      setShowManualAdd(true);
      setManualEntry({ title: searchQuery, description: '' });
    } finally {
      setIsLoading(false);
    }
  }, [orchestrator]);

  const handleSearch = async () => {
    await performSearch(query, selectedType);
  };

  const handleAddResult = async (result: SearchResult) => {
    try {
      const newMedia = {
        title: result.title,
        normalized_title: result.title.toLowerCase().replace(/[^a-z0-9]/g, ''),
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
        status: 'planned' as const,
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
        tmdb_id: null,
        mal_id: null,
        rawg_id: null,
        google_books_id: null,
        completed_at: null,
      };
      
      await addMedia(newMedia);
      router.push('/');
    } catch (error) {
      console.error('Failed to add media:', error);
      setError('Failed to add to library. Please try again.');
    }
  };

  const handleManualAdd = async () => {
    const newEntry: SearchResult = {
      title: manualEntry.title,
      type: selectedType === 'all' ? 'anime' : selectedType as MediaType,
      poster_url: null,
      description: manualEntry.description || null,
      release_year: null,
      api_rating: null,
      genres: [],
      total_units: 0,
      external_id: 'manual-' + Date.now(),
      confidence: 1,
    };
    await handleAddResult(newEntry);
  };

  // Manual add form submit
  const handleManualFormSubmit = async () => {
    if (!manualForm.title.trim()) {
      setError('Title is required');
      return;
    }

    const newEntry: SearchResult = {
      title: manualForm.title,
      type: manualForm.type,
      poster_url: manualForm.poster_url || null,
      description: manualForm.description || null,
      release_year: manualForm.release_year ? parseInt(manualForm.release_year) : null,
      api_rating: null,
      genres: manualForm.genres.split(',').map(g => g.trim()).filter(g => g),
      total_units: manualForm.total_units ? parseInt(manualForm.total_units) : 0,
      external_id: 'manual-' + Date.now(),
      confidence: 1,
    };

    await handleAddResult(newEntry);
  };

  // Batch mode functions
  const parseBatchText = () => {
    const lines = batchText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const items: BatchItem[] = lines.map((title, index) => ({
      id: `batch-${index}`,
      title,
      status: 'pending',
    }));
    
    setBatchItems(items);
  };

  const processBatch = async () => {
    if (batchItems.length === 0) return;
    
    // Check if API keys are configured (from IndexedDB - more reliable on mobile)
    const tmdbKey = await getApiKey('tmdb_key') || process.env.NEXT_PUBLIC_TMDB_API_KEY;
    const rawgKey = await getApiKey('rawg_key') || process.env.NEXT_PUBLIC_RAWG_API_KEY;
    
    if (!tmdbKey && (batchType === 'movie' || batchType === 'tv')) {
      setError('TMDB API key missing. Please add it in Settings to search for Movies/TV.');
      return;
    }
    if (!rawgKey && batchType === 'game') {
      setError('RAWG API key missing. Please add it in Settings to search for Games.');
      return;
    }
    
    setIsBatchProcessing(true);
    const updatedItems = [...batchItems];

    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      if (item.status === 'added') continue;

      updatedItems[i] = { ...item, status: 'searching' };
      setBatchItems([...updatedItems]);

      try {
        const results = await orchestrator.search(item.title, batchType);
        
        if (results.length > 0) {
          updatedItems[i] = {
            ...item,
            status: 'found',
            results,
            selectedResult: results[0],
          };
        } else {
          updatedItems[i] = { ...item, status: 'not_found' };
        }
      } catch (error) {
        updatedItems[i] = { ...item, status: 'not_found' };
      }

      setBatchItems([...updatedItems]);
      
      if (i < updatedItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsBatchProcessing(false);
  };

  const selectResultForItem = (itemId: string, result: SearchResult) => {
    setBatchItems(items => items.map(item => 
      item.id === itemId 
        ? { ...item, selectedResult: result }
        : item
    ));
  };

  const addBatchItem = async (itemId: string) => {
    const item = batchItems.find(i => i.id === itemId);
    if (item?.selectedResult) {
      await handleAddResult(item.selectedResult);
      setBatchItems(items => items.map(i => 
        i.id === itemId 
          ? { ...i, status: 'added' }
          : i
      ));
    }
  };

  const removeBatchItem = (itemId: string) => {
    setBatchItems(items => items.filter(item => item.id !== itemId));
  };

  const addAllSelected = async () => {
    const toAdd = batchItems.filter(item => item.selectedResult && item.status !== 'added');
    for (const item of toAdd) {
      if (item.selectedResult) {
        await handleAddResult(item.selectedResult);
      }
    }
    router.push('/');
  };

  const selectedConfig = searchTypes.find(t => t.value === selectedType) || searchTypes[0];
  const batchTypeConfig = searchTypes.find(t => t.value === batchType) || searchTypes[0];
  const manualTypeConfig = searchTypes.find(t => t.value === manualForm.type) || searchTypes[0];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">ADD MEDIA</h1>
          <p className="text-sm text-white/50 font-mono">検索</p>
        </div>
      </div>

      {/* Mode Switcher */}
      <Tabs value={mode} onValueChange={(v) => { setMode(v as 'single' | 'batch' | 'manual'); setError(null); }} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 p-1 rounded-2xl h-auto">
          <TabsTrigger 
            value="single" 
            className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60"
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger 
            value="batch"
            className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60"
          >
            <List className="h-4 w-4 mr-2" />
            Batch
          </TabsTrigger>
          <TabsTrigger 
            value="manual"
            className="rounded-xl py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60"
          >
            <PenSquare className="h-4 w-4 mr-2" />
            Manual
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'single' && (
        <>
          {/* Search Box */}
          <div className="glass-card rounded-[28px] p-6">
            {/* Type Selector */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              {searchTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap',
                    selectedType === type.value
                      ? `bg-gradient-to-r ${type.gradient} text-white shadow-lg`
                      : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                  )}
                >
                  {type.icon}
                  {type.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <Input
                  placeholder="Search for movies, shows, anime..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-12 h-14 bg-black border-white/10 rounded-xl text-lg focus:border-indigo-500"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isLoading}
                className={cn(
                  'h-14 px-6 rounded-xl font-bold text-white',
                  'bg-gradient-to-r shadow-lg',
                  selectedConfig.gradient
                )}
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'SEARCH'}
              </Button>
            </div>
          </div>

          {/* Manual Add Option */}
          {showManualAdd && !isLoading && (
            <div className="glass-card rounded-[28px] p-6 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Not Found?</h3>
                  <p className="text-sm text-white/60">Add it manually with your own details</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Input
                  value={manualEntry.title}
                  onChange={(e) => setManualEntry({ ...manualEntry, title: e.target.value })}
                  placeholder="Title"
                  className="bg-black border-white/10 rounded-xl"
                />
                <textarea
                  value={manualEntry.description}
                  onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full h-20 bg-black border border-white/10 rounded-xl p-3 text-white resize-none focus:border-indigo-500 focus:outline-none"
                />
                <Button 
                  onClick={handleManualAdd}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-12 font-bold"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add Manually
                </Button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !showManualAdd && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white tracking-tight">RESULTS</h2>
                <Badge variant="outline" className="border-white/10 text-white/70 rounded-full">
                  {results.length} found
                </Badge>
              </div>
              
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div 
                    key={`${result.title}-${index}`} 
                    className="glass-card rounded-2xl p-4 hover:border-white/20 transition-all group"
                  >
                    <div className="flex gap-4">
                      <div className="h-28 w-20 flex-shrink-0 bg-black rounded-xl overflow-hidden border border-white/10">
                        {result.poster_url ? (
                          <img
                            src={result.poster_url}
                            alt={result.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
                            <span className="text-2xl font-black text-white/20">
                              {result.title.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <Badge variant="outline" className="mb-1 text-xs border-white/10 text-white/70 rounded-md">
                              {getTypeLabel(result.type)}
                            </Badge>
                            <h3 className="font-bold text-white text-lg leading-tight">{result.title}</h3>
                            {result.description && (
                              <p className="mt-1 line-clamp-2 text-sm text-white/50">
                                {result.description}
                              </p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            onClick={() => handleAddResult(result)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex-shrink-0"
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>

                        <div className="mt-auto flex items-center gap-3 text-xs text-white/40 pt-3">
                          {result.release_year && (
                            <span className="bg-white/5 px-2 py-1 rounded-md">{result.release_year}</span>
                          )}
                          {result.api_rating && (
                            <span className="text-yellow-500 flex items-center gap-1">
                              <span className="text-yellow-500">★</span> {result.api_rating.toFixed(1)}
                            </span>
                          )}
                          {String(result.external_id).startsWith('ai-') && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400 rounded-md">
                              AI-Detected
                            </Badge>
                          )}
                          <span className="ml-auto">{Math.round(result.confidence * 100)}% match</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'batch' && (
        /* Batch Mode */
        <>
          {/* Batch Type Selector */}
          <div className="glass-card rounded-[28px] p-6">
            <label className="text-sm font-medium text-white/60 mb-3 block">Type for all items</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {searchTypes.filter(t => t.value !== 'all').map((type) => (
                <button
                  key={type.value}
                  onClick={() => setBatchType(type.value as MediaType)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap',
                    batchType === type.value
                      ? `bg-gradient-to-r ${type.gradient} text-white shadow-lg`
                      : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                  )}
                >
                  {type.icon}
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Batch Input */}
          {batchItems.length === 0 ? (
            <div className="glass-card rounded-[28px] p-6">
              <label className="text-sm font-medium text-white/60 mb-3 block">
                Paste your list (one title per line)
              </label>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder="e.g.&#10;Solo Leveling&#10;Omniscient Reader&#10;Tower of God&#10;Noblesse"
                className="w-full h-48 bg-black border border-white/10 rounded-xl p-4 text-white resize-none focus:border-indigo-500 focus:outline-none font-mono text-sm"
              />
              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setBatchText('')}
                  className="flex-1 border-white/10 text-white/60 hover:bg-white/5 rounded-xl h-12"
                  disabled={!batchText}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
                <Button
                  onClick={parseBatchText}
                  disabled={!batchText.trim()}
                  className={cn(
                    'flex-1 h-12 rounded-xl font-bold text-white',
                    'bg-gradient-to-r shadow-lg',
                    batchTypeConfig.gradient
                  )}
                >
                  <List className="mr-2 h-4 w-4" />
                  Parse List ({batchText.split('\n').filter(l => l.trim()).length})
                </Button>
              </div>
            </div>
          ) : (
            /* Batch Results */
            <div className="space-y-4">
              {/* Batch Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Batch Items</h2>
                  <p className="text-sm text-white/50">
                    {batchItems.filter(i => i.status === 'added').length} of {batchItems.length} added
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchItems([])}
                    className="border-white/10 text-white/60 rounded-xl"
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={processBatch}
                    disabled={isBatchProcessing}
                    className={cn(
                      'rounded-xl font-bold text-white',
                      'bg-gradient-to-r shadow-lg',
                      batchTypeConfig.gradient
                    )}
                  >
                    {isBatchProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Search All
                  </Button>
                </div>
              </div>

              {/* Add All Button */}
              {batchItems.some(i => i.selectedResult && i.status !== 'added') && (
                <Button
                  onClick={addAllSelected}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold"
                >
                  <Check className="mr-2 h-5 w-5" />
                  Add All Selected ({batchItems.filter(i => i.selectedResult && i.status !== 'added').length})
                </Button>
              )}

              {/* Batch Items List */}
              <div className="space-y-3">
                {batchItems.map((item) => (
                  <div 
                    key={item.id}
                    className={cn(
                      'glass-card rounded-2xl p-4 transition-all',
                      item.status === 'added' && 'opacity-50 border-emerald-500/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Indicator */}
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1',
                        item.status === 'pending' && 'bg-white/5',
                        item.status === 'searching' && 'bg-indigo-500/20',
                        item.status === 'found' && 'bg-emerald-500/20',
                        item.status === 'not_found' && 'bg-red-500/20',
                        item.status === 'added' && 'bg-emerald-500/20',
                      )}>
                        {item.status === 'pending' && <span className="text-white/40 text-xs">●</span>}
                        {item.status === 'searching' && <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />}
                        {item.status === 'found' && <Check className="h-4 w-4 text-emerald-400" />}
                        {item.status === 'not_found' && <X className="h-4 w-4 text-red-400" />}
                        {item.status === 'added' && <Check className="h-4 w-4 text-emerald-400" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <h3 className={cn(
                          'font-bold text-white',
                          item.status === 'added' && 'line-through text-white/50'
                        )}>
                          {item.title}
                        </h3>

                        {/* Results Selection */}
                        {item.results && item.results.length > 0 && item.status !== 'added' && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-white/50">Select the correct match:</p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {item.results.slice(0, 5).map((result, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => selectResultForItem(item.id, result)}
                                  className={cn(
                                    'flex-shrink-0 w-24 text-left p-2 rounded-xl border transition-all',
                                    item.selectedResult === result
                                      ? 'border-indigo-500 bg-indigo-500/10'
                                      : 'border-white/10 bg-white/5 hover:border-white/20'
                                  )}
                                >
                                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-black mb-2">
                                    {result.poster_url ? (
                                      <img 
                                        src={result.poster_url} 
                                        alt={result.title}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-lg font-bold text-white/20">
                                          {result.title.charAt(0)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-white truncate">{result.title}</p>
                                  {result.release_year && (
                                    <p className="text-[10px] text-white/50">{result.release_year}</p>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Not Found - Manual Add Option */}
                        {item.status === 'not_found' && (
                          <div className="mt-2 text-sm text-white/50">
                            No results found. 
                            <button 
                              onClick={() => selectResultForItem(item.id, {
                                title: item.title,
                                type: batchType,
                                poster_url: null,
                                description: null,
                                release_year: null,
                                api_rating: null,
                                genres: [],
                                total_units: 0,
                                external_id: 'manual-' + Date.now(),
                                confidence: 1,
                              })}
                              className="text-indigo-400 hover:text-indigo-300 ml-1"
                            >
                              Add manually
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {item.selectedResult && item.status !== 'added' && (
                          <Button
                            size="icon"
                            onClick={() => addBatchItem(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 w-10"
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeBatchItem(item.id)}
                          className="text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl h-10 w-10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'manual' && (
        /* Manual Add Mode */
        <div className="glass-card rounded-[28px] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br',
              manualTypeConfig.gradient
            )}>
              <PenSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Manual Entry</h3>
              <p className="text-sm text-white/50">Add media with custom details</p>
            </div>
          </div>

          {error && (
            <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Title *</label>
              <Input
                value={manualForm.title}
                onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                placeholder="Enter title"
                className="bg-black border-white/10 rounded-xl h-12"
              />
            </div>

            {/* Type Selector */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Type</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {searchTypes.filter(t => t.value !== 'all').map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setManualForm({ ...manualForm, type: type.value as MediaType })}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap',
                      manualForm.type === type.value
                        ? `bg-gradient-to-r ${type.gradient} text-white shadow-lg`
                        : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                    )}
                  >
                    {type.icon}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Description</label>
              <textarea
                value={manualForm.description}
                onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                placeholder="Enter description"
                className="w-full h-24 bg-black border border-white/10 rounded-xl p-3 text-white resize-none focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Poster URL */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Poster URL</label>
              <Input
                value={manualForm.poster_url}
                onChange={(e) => setManualForm({ ...manualForm, poster_url: e.target.value })}
                placeholder="https://..."
                className="bg-black border-white/10 rounded-xl h-12"
              />
            </div>

            {/* Grid for numeric fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Release Year</label>
                <Input
                  type="number"
                  value={manualForm.release_year}
                  onChange={(e) => setManualForm({ ...manualForm, release_year: e.target.value })}
                  placeholder="2024"
                  className="bg-black border-white/10 rounded-xl h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">
                  Total {getUnitLabel(manualForm.type)}
                </label>
                <Input
                  type="number"
                  value={manualForm.total_units}
                  onChange={(e) => setManualForm({ ...manualForm, total_units: e.target.value })}
                  placeholder="0"
                  className="bg-black border-white/10 rounded-xl h-12"
                />
              </div>
            </div>

            {/* Genres */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Genres (comma-separated)</label>
              <Input
                value={manualForm.genres}
                onChange={(e) => setManualForm({ ...manualForm, genres: e.target.value })}
                placeholder="Action, Fantasy, Adventure..."
                className="bg-black border-white/10 rounded-xl h-12"
              />
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleManualFormSubmit}
              disabled={!manualForm.title.trim()}
              className={cn(
                'w-full h-14 rounded-xl font-bold text-white mt-4',
                'bg-gradient-to-r shadow-lg',
                manualTypeConfig.gradient
              )}
            >
              <Plus className="mr-2 h-5 w-5" />
              Add to Library
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

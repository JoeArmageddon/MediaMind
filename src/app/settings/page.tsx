'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Upload, RefreshCw, Wifi, WifiOff, Key, Save, Trash2, CheckCircle, Loader2, BookOpen, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useMediaStore } from '@/store/mediaStore';
import { useSyncStore } from '@/store/syncStore';
import { useThemeStore } from '@/store/themeStore';
import { exportDatabase, importDatabase, getApiKey, saveApiKey, db } from '@/lib/db/dexie';
import { resolveApiKey } from '@/lib/api/apiKey';
import { createTMDBClient } from '@/lib/api/tmdb';
import { withTimeout, fetchWithTimeout } from '@/lib/api/http';
import { supabase } from '@/lib/db/supabase';
import { getAIClient } from '@/lib/ai';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { syncWithSupabase, updateMedia } = useMediaStore();
  const { is_online, pending_changes } = useSyncStore();
  const { theme, toggleTheme } = useThemeStore();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);
  const [isFixingTags, setIsFixingTags] = useState(false);
  const [fixTagsProgress, setFixTagsProgress] = useState<{ done: number; total: number } | null>(null);
  const [fixTagsResult, setFixTagsResult] = useState<string | null>(null);

  // One-time migration for data created before accounts existed: claims any
  // row nobody owns yet (user_id IS NULL) as the signed-in user's own. RLS
  // (see supabase/schema.sql) only allows this for currently-unclaimed rows,
  // so it can't be used to take someone else's data.
  const claimExistingLibrary = async () => {
    setIsClaiming(true);
    setClaimResult(null);
    try {
      const clerkUserId = typeof window !== 'undefined' ? window.Clerk?.user?.id : undefined;
      if (!clerkUserId) throw new Error('Not signed in.');

      const tables = ['media', 'history', 'smart_collections'] as const;
      let claimedTotal = 0;
      for (const table of tables) {
        const { data, error } = await (supabase as any)
          .from(table)
          .update({ user_id: clerkUserId })
          .is('user_id', null)
          .select('id');
        if (error) throw error;
        claimedTotal += data?.length ?? 0;
      }
      setClaimResult(
        claimedTotal > 0
          ? `Claimed ${claimedTotal} item${claimedTotal === 1 ? '' : 's'} - refresh to see them.`
          : 'Nothing to claim - your library is already yours.'
      );
    } catch (e) {
      console.error('Claim failed:', e);
      setClaimResult(e instanceof Error ? `Failed: ${e.message}` : 'Failed to claim existing data.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Bulk backfill for the "current tags are a shitshow" gap: for years,
  // TMDB search results had their genres hardcoded to [] (the genre_ids
  // TMDB returns were never resolved to names - fixed in tmdb.ts), and the
  // `tags` field was never populated by anything at all, from any source.
  // Existing library items have no stored tmdb_id/mal_id/etc to re-look-up
  // by id (also just fixed, but only for future adds) - so this uses AI
  // classification/tag-suggestion from title+description instead, which
  // works for whatever's already here regardless of source.
  const fixTagsAndGenres = async () => {
    setIsFixingTags(true);
    setFixTagsResult(null);
    setFixTagsProgress(null);
    try {
      const allMedia = await db.media.toArray();
      const needsWork = allMedia.filter((m) => m.genres.length === 0 || m.tags.length === 0);

      if (needsWork.length === 0) {
        setFixTagsResult('Everything already has genres and tags.');
        return;
      }

      const ai = getAIClient();
      if (!ai.isAvailable()) {
        setFixTagsResult('No AI configured - add a Groq or Gemini key below first.');
        return;
      }

      setFixTagsProgress({ done: 0, total: needsWork.length });
      let fixed = 0;
      let failed = 0;
      let doneCount = 0;

      // Modest concurrency - fast enough for ~200 items to finish in a
      // couple of minutes, without hammering the AI provider hard enough to
      // trigger sustained rate-limiting (callWithFallback already recovers
      // from an occasional 429 by falling back to the other provider).
      const CONCURRENCY = 3;
      let cursor = 0;
      const worker = async () => {
        while (cursor < needsWork.length) {
          const item = needsWork[cursor++];
          try {
            let genres = item.genres;
            if (genres.length === 0) {
              const classification = await ai.classifyMedia(item.title);
              if (classification?.likely_genres?.length) {
                genres = classification.likely_genres;
              }
            }

            let tags = item.tags;
            if (tags.length === 0) {
              const suggested = await ai.suggestTags({
                title: item.title,
                type: item.type,
                description: item.description,
                genres,
              });
              if (suggested && suggested.length > 0) {
                tags = suggested;
              }
            }

            if (genres !== item.genres || tags !== item.tags) {
              await updateMedia(item.id, { genres, tags });
              fixed++;
            }
          } catch (e) {
            console.warn('Failed to fix tags/genres for', item.title, e);
            failed++;
          } finally {
            doneCount++;
            setFixTagsProgress({ done: doneCount, total: needsWork.length });
          }
        }
      };

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      setFixTagsResult(
        `Fixed ${fixed} item${fixed === 1 ? '' : 's'}${failed > 0 ? ` - ${failed} failed` : ''}.`
      );
    } catch (e) {
      console.error('fixTagsAndGenres failed:', e);
      setFixTagsResult(e instanceof Error ? `Failed: ${e.message}` : 'Failed to fix tags.');
    } finally {
      setIsFixingTags(false);
    }
  };

  const [includeApiKeysInExport, setIncludeApiKeysInExport] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tmdbKey, setTmdbKey] = useState('');
  const [rawgKey, setRawgKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load keys from IndexedDB (more reliable on mobile)
    const loadKeys = async () => {
      const tmdb = await getApiKey('tmdb_key');
      const rawg = await getApiKey('rawg_key');
      const gemini = await getApiKey('gemini_key');
      const groq = await getApiKey('groq_key');
      
      setTmdbKey(tmdb);
      setRawgKey(rawg);
      setGeminiKey(gemini);
      setGroqKey(groq);
    };
    
    loadKeys();
  }, []);

  const saveKeys = async () => {
    try {
      await saveApiKey('tmdb_key', tmdbKey);
      await saveApiKey('rawg_key', rawgKey);
      await saveApiKey('gemini_key', geminiKey);
      await saveApiKey('groq_key', groqKey);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save API keys:', error);
      alert('Failed to save API keys. Please try again.');
    }
  };

  const downloadJson = (data: string, filenamePrefix: string) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportDatabase({ includeApiKeys: includeApiKeysInExport });
      downloadJson(data, 'mediamind-backup');
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // File selection just opens the confirmation - importDatabase() clears
  // existing tables before restoring, so this must never fire on selection
  // alone (see runImport for the actual destructive step).
  const handleImportFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingImportFile(file);
  };

  const runImport = async () => {
    const file = pendingImportFile;
    setPendingImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setIsImporting(true);
    try {
      // Safety net: snapshot current data before wiping it, so a bad/wrong
      // import file can be undone by re-importing this backup.
      try {
        const preImportBackup = await exportDatabase();
        downloadJson(preImportBackup, 'mediamind-pre-import-backup');
      } catch (backupError) {
        console.warn('Could not create pre-import safety backup:', backupError);
      }

      const text = await file.text();
      await importDatabase(text);
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncWithSupabase();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const [testResults, setTestResults] = useState<Record<string, boolean | null | 'loading'>>({
    tmdb: null,
    rawg: null,
  });

  const testApiKeys = async () => {
    console.log('Testing API keys...');
    setTestResults({ tmdb: 'loading', rawg: 'loading' });

    // Test TMDB through the same proxy real searches use (see
    // src/lib/api/tmdb.ts) - a raw direct fetch to api.themoviedb.org here
    // would hang/fail on any network that blocks that domain, exactly like
    // real search did before the proxy existed, giving a misleading result.
    try {
      const tmdb = createTMDBClient();
      const results = await withTimeout(tmdb.searchMovies('inception'), 15000, 'TMDB test');
      setTestResults(prev => ({ ...prev, tmdb: results.length > 0 }));
    } catch (e) {
      console.error('TMDB test error:', e);
      setTestResults(prev => ({ ...prev, tmdb: false }));
    }

    // Test RAWG with a timeout - a hung request here previously looked
    // exactly like "stuck", with no way to tell it apart from a real failure.
    try {
      const rawgKey = await resolveApiKey('rawg_key', process.env.NEXT_PUBLIC_RAWG_API_KEY);
      console.log('RAWG key found:', !!rawgKey);
      if (rawgKey) {
        const response = await fetchWithTimeout(
          `https://api.rawg.io/api/games?key=${rawgKey}&page_size=1`,
          15000,
          'RAWG test'
        );
        console.log('RAWG test response:', response.status);
        setTestResults(prev => ({ ...prev, rawg: response.ok }));
      } else {
        setTestResults(prev => ({ ...prev, rawg: false }));
      }
    } catch (e) {
      console.error('RAWG test error:', e);
      setTestResults(prev => ({ ...prev, rawg: false }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg)] rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-[var(--mm-text)] tracking-tighter">SYSTEM</h1>
          <p className="text-sm text-[var(--mm-text-50)] font-mono">設定</p>
        </div>
      </div>

      {/* Appearance */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {theme === 'manga' ? (
            <BookOpen className="h-5 w-5 text-[var(--mm-primary)]" />
          ) : (
            <Moon className="h-5 w-5 text-[var(--mm-primary)]" />
          )}
          <div>
            <div className="font-bold text-[var(--mm-text)] text-sm">Manga mode</div>
            <div className="text-xs text-[var(--mm-text-50)]">
              {theme === 'manga' ? 'Paper white, bold ink borders - like a manga page.' : 'Off - the dark "liquid glass" theme.'}
            </div>
          </div>
        </div>
        <Switch checked={theme === 'manga'} onCheckedChange={toggleTheme} />
      </div>

      {/* Status Card */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={is_online ? 'w-3 h-3 bg-green-500 rounded-full animate-pulse' : 'w-3 h-3 bg-red-500 rounded-full'} />
          <div>
            <div className="font-bold text-[var(--mm-text)]">{is_online ? 'ONLINE' : 'OFFLINE'}</div>
            <div className="text-xs text-[var(--mm-text-50)] font-mono">
              {pending_changes > 0 ? `${pending_changes} pending changes` : 'Sync up to date'}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || !is_online}
          className="border-[var(--mm-card-border)] hover:bg-[var(--mm-hover-bg)]"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
          Sync
        </Button>
      </div>

      {/* Claim pre-account data */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-[var(--mm-text)] text-sm">Claim existing library</div>
            <div className="text-xs text-[var(--mm-text-50)]">
              One-time: assigns any data created before accounts existed to you.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={claimExistingLibrary}
            disabled={isClaiming || !is_online}
            className="border-[var(--mm-card-border)] hover:bg-[var(--mm-hover-bg)] flex-shrink-0"
          >
            {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Claim'}
          </Button>
        </div>
        {claimResult && <p className="text-xs text-[var(--mm-text-60)] mt-2">{claimResult}</p>}
      </div>

      {/* Fix tags/genres */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-[var(--mm-text)] text-sm">Fix tags &amp; genres</div>
            <div className="text-xs text-[var(--mm-text-50)]">
              AI-fills missing genres and descriptive tags across your whole library.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fixTagsAndGenres}
            disabled={isFixingTags || !is_online}
            className="border-[var(--mm-card-border)] hover:bg-[var(--mm-hover-bg)] flex-shrink-0"
          >
            {isFixingTags ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fix'}
          </Button>
        </div>
        {isFixingTags && fixTagsProgress && (
          <p className="text-xs text-[var(--mm-text-60)] mt-2">
            {fixTagsProgress.done} / {fixTagsProgress.total}
          </p>
        )}
        {fixTagsResult && <p className="text-xs text-[var(--mm-text-60)] mt-2">{fixTagsResult}</p>}
      </div>

      {/* API Keys */}
      <div className="glass-card rounded-[28px] p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <Key className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--mm-text)]">API KEYS</h2>
            <p className="text-xs text-[var(--mm-text-50)] font-mono">Configure external services</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--mm-text-50)] uppercase tracking-wider mb-2 block">TMDB API Key</label>
            <Input
              type="password"
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              placeholder="Your TMDB API key"
              className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--mm-text-50)] uppercase tracking-wider mb-2 block">RAWG API Key</label>
            <Input
              type="password"
              value={rawgKey}
              onChange={(e) => setRawgKey(e.target.value)}
              placeholder="Your RAWG API key"
              className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--mm-text-50)] uppercase tracking-wider mb-2 block">Gemini API Key</label>
            <Input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Your Gemini API key"
              className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--mm-text-50)] uppercase tracking-wider mb-2 block">Groq API Key (Primary AI)</label>
            <Input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="Your Groq API key (gsk_...)"
              className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] focus:border-indigo-500"
            />
            <p className="text-[10px] text-[var(--mm-text-30)] mt-1">Used for AI collections and recommendations. Faster than Gemini.</p>
          </div>
        </div>

        <Button 
          onClick={saveKeys}
          className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl"
        >
          {saved ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Keys
            </>
          )}
        </Button>

        {/* Test API Keys */}
        <div className="pt-4 border-t border-[var(--mm-card-border)]">
          <Button 
            onClick={testApiKeys}
            variant="outline"
            disabled={testResults.tmdb === 'loading' || testResults.rawg === 'loading'}
            className="w-full border-[var(--mm-card-border)] hover:bg-[var(--mm-hover-bg)] rounded-xl disabled:opacity-50"
          >
            {testResults.tmdb === 'loading' || testResults.rawg === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Test API Keys
          </Button>
          
          {(testResults.tmdb !== null || testResults.rawg !== null) && (
            <div className="mt-3 space-y-2">
              {testResults.tmdb !== null && testResults.tmdb !== 'loading' && (
                <div className={`flex items-center gap-2 text-sm ${testResults.tmdb ? 'text-green-400' : 'text-red-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${testResults.tmdb ? 'bg-green-400' : 'bg-red-400'}`} />
                  TMDB: {testResults.tmdb ? 'Working' : 'Failed / No Key'}
                </div>
              )}
              {testResults.rawg !== null && testResults.rawg !== 'loading' && (
                <div className={`flex items-center gap-2 text-sm ${testResults.rawg ? 'text-green-400' : 'text-red-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${testResults.rawg ? 'bg-green-400' : 'bg-red-400'}`} />
                  RAWG: {testResults.rawg ? 'Working' : 'Failed / No Key'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="glass-card rounded-[28px] p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
            <Download className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--mm-text)]">DATA</h2>
            <p className="text-xs text-[var(--mm-text-50)] font-mono">Backup & restore</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="h-14 border-[var(--mm-card-border)] hover:bg-[var(--mm-hover-bg)] flex flex-col items-center gap-1"
          >
            {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            <span className="text-xs">Export</span>
          </Button>

          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFileSelected}
              disabled={isImporting}
              className="hidden"
            />
            <div className="h-14 border border-[var(--mm-card-border)] hover:bg-[var(--mm-hover-bg)] rounded-md flex flex-col items-center justify-center gap-1 transition-colors">
              {isImporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              <span className="text-xs">Import</span>
            </div>
          </label>
        </div>

        <label className="flex items-center gap-2 pt-1">
          <Checkbox checked={includeApiKeysInExport} onCheckedChange={(v) => setIncludeApiKeysInExport(v === true)} />
          <span className="text-xs text-[var(--mm-text-50)]">Include API keys in export (kept out by default)</span>
        </label>
      </div>

      <ConfirmDialog
        open={pendingImportFile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingImportFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
        title="Replace all local data?"
        description={`Importing "${pendingImportFile?.name ?? ''}" will replace your library, collections, history, and settings with the contents of this file. A backup of your current data downloads automatically first, so you can undo this by re-importing it.`}
        confirmLabel="Import & Replace"
        onConfirm={runImport}
      />

      {/* About */}
      <div className="glass-card rounded-2xl p-6 text-center">
        <h3 className="text-lg font-bold text-[var(--mm-text)] mb-2">MEDIA MIND</h3>
        <p className="text-sm text-[var(--mm-text-50)]">v2.0 • Personal Media Intelligence</p>
        <p className="text-xs text-[var(--mm-text-30)] mt-4 font-mono">Built with Next.js + Supabase + AI</p>
      </div>
    </div>
  );
}

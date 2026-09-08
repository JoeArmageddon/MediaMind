'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Upload, RefreshCw, Wifi, WifiOff, Key, Save, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useMediaStore } from '@/store/mediaStore';
import { useSyncStore } from '@/store/syncStore';
import { exportDatabase, importDatabase, getApiKey, saveApiKey } from '@/lib/db/dexie';
import { resolveApiKey } from '@/lib/api/apiKey';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { syncWithSupabase } = useMediaStore();
  const { is_online, pending_changes } = useSyncStore();
  
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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
    
    // Test TMDB with actual API call
    try {
      const tmdbKey = await resolveApiKey('tmdb_key', process.env.NEXT_PUBLIC_TMDB_API_KEY);
      console.log('TMDB key found:', !!tmdbKey);
      if (tmdbKey) {
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/550?api_key=${tmdbKey}`
        );
        console.log('TMDB test response:', response.status);
        setTestResults(prev => ({ ...prev, tmdb: response.ok }));
      } else {
        setTestResults(prev => ({ ...prev, tmdb: false }));
      }
    } catch (e) {
      console.error('TMDB test error:', e);
      setTestResults(prev => ({ ...prev, tmdb: false }));
    }
    
    // Test RAWG with actual API call
    try {
      const rawgKey = await resolveApiKey('rawg_key', process.env.NEXT_PUBLIC_RAWG_API_KEY);
      console.log('RAWG key found:', !!rawgKey);
      if (rawgKey) {
        const response = await fetch(
          `https://api.rawg.io/api/games?key=${rawgKey}&page_size=1`
        );
        console.log('RAWG test response:', response.status);
        setTestResults(prev => ({ ...prev, rawg: response.ok }));
      } else {
        setTestResults(prev => ({ ...prev, rawg: false }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, rawg: false }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">SYSTEM</h1>
          <p className="text-sm text-white/50 font-mono">設定</p>
        </div>
      </div>

      {/* Status Card */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={is_online ? 'w-3 h-3 bg-green-500 rounded-full animate-pulse' : 'w-3 h-3 bg-red-500 rounded-full'} />
          <div>
            <div className="font-bold text-white">{is_online ? 'ONLINE' : 'OFFLINE'}</div>
            <div className="text-xs text-white/50 font-mono">
              {pending_changes > 0 ? `${pending_changes} pending changes` : 'Sync up to date'}
            </div>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSync}
          disabled={isSyncing || !is_online}
          className="border-white/10 hover:bg-white/5"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
          Sync
        </Button>
      </div>

      {/* API Keys */}
      <div className="glass-card rounded-[28px] p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <Key className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">API KEYS</h2>
            <p className="text-xs text-white/50 font-mono">Configure external services</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">TMDB API Key</label>
            <Input
              type="password"
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              placeholder="Your TMDB API key"
              className="bg-black border-white/10 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">RAWG API Key</label>
            <Input
              type="password"
              value={rawgKey}
              onChange={(e) => setRawgKey(e.target.value)}
              placeholder="Your RAWG API key"
              className="bg-black border-white/10 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Gemini API Key</label>
            <Input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Your Gemini API key"
              className="bg-black border-white/10 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Groq API Key (Primary AI)</label>
            <Input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="Your Groq API key (gsk_...)"
              className="bg-black border-white/10 focus:border-indigo-500"
            />
            <p className="text-[10px] text-white/30 mt-1">Used for AI collections and recommendations. Faster than Gemini.</p>
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
        <div className="pt-4 border-t border-white/10">
          <Button 
            onClick={testApiKeys}
            variant="outline"
            disabled={testResults.tmdb === 'loading' || testResults.rawg === 'loading'}
            className="w-full border-white/10 hover:bg-white/5 rounded-xl disabled:opacity-50"
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
            <h2 className="text-lg font-bold text-white">DATA</h2>
            <p className="text-xs text-white/50 font-mono">Backup & restore</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="h-14 border-white/10 hover:bg-white/5 flex flex-col items-center gap-1"
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
            <div className="h-14 border border-white/10 hover:bg-white/5 rounded-md flex flex-col items-center justify-center gap-1 transition-colors">
              {isImporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              <span className="text-xs">Import</span>
            </div>
          </label>
        </div>

        <label className="flex items-center gap-2 pt-1">
          <Checkbox checked={includeApiKeysInExport} onCheckedChange={(v) => setIncludeApiKeysInExport(v === true)} />
          <span className="text-xs text-white/50">Include API keys in export (kept out by default)</span>
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
        <h3 className="text-lg font-bold text-white mb-2">MEDIA MIND</h3>
        <p className="text-sm text-white/50">v2.0 • Personal Media Intelligence</p>
        <p className="text-xs text-white/30 mt-4 font-mono">Built with Next.js + Supabase + AI</p>
      </div>
    </div>
  );
}

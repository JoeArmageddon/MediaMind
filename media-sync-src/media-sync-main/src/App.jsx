import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, 
  Search, 
  Plus, 
  User, 
  Film, 
  BookOpen, 
  Gamepad2, 
  Tv, 
  Sparkles, 
  X, 
  Check, 
  Trash2, 
  Zap, 
  Clock,
  Dices,
  Send,
  Loader2,
  Monitor,     
  BookCopy,    
  Smartphone,
  Box,
  Settings,
  Key,
  Save,
  LayoutGrid,
  List as ListIcon,
  Filter,
  ChevronDown,
  FolderOpen,
  ArrowRight,
  Library,
  Layers,
  Play,
  Star,
  Activity
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
} from 'firebase/firestore';

/* --- FIREBASE CONFIGURATION --- */
const firebaseConfig = {
  apiKey: "AIzaSyAG0rywtMXVZWnVZmHd5I9xzQqCuoLoqEY",
  authDomain: "mediasync-48534.firebaseapp.com",
  projectId: "mediasync-48534",
  storageBucket: "mediasync-48534.firebasestorage.app",
  messagingSenderId: "600579510152",
  appId: "1:600579510152:web:45f1583931a0ccb382b43d"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/* --- GEMINI API CONFIGURATION --- */
const GEMINI_API_KEY = ""; // Provided by environment

/* --- STYLES & CONFIG --- */
const CATEGORIES = {
  MOVIE: { id: 'MOVIE', label: 'Movies', icon: Film, from: 'from-cyan-500', to: 'to-blue-600', shadow: 'shadow-cyan-500/20' },
  SHOW: { id: 'SHOW', label: 'TV Shows', icon: Monitor, from: 'from-violet-500', to: 'to-fuchsia-600', shadow: 'shadow-violet-500/20' },
  ANIME: { id: 'ANIME', label: 'Anime', icon: Tv, from: 'from-pink-500', to: 'to-rose-600', shadow: 'shadow-pink-500/20' },
  BOOK: { id: 'BOOK', label: 'Books', icon: BookOpen, from: 'from-amber-400', to: 'to-orange-500', shadow: 'shadow-amber-500/20' },
  MANGA: { id: 'MANGA', label: 'Manga', icon: BookCopy, from: 'from-red-500', to: 'to-orange-600', shadow: 'shadow-red-500/20' },
  MANHWA: { id: 'MANHWA', label: 'Manhwa', icon: Smartphone, from: 'from-indigo-400', to: 'to-blue-600', shadow: 'shadow-indigo-500/20' },
  GAME: { id: 'GAME', label: 'Games', icon: Gamepad2, from: 'from-emerald-400', to: 'to-teal-500', shadow: 'shadow-emerald-500/20' },
  OTHER: { id: 'OTHER', label: 'Others', icon: Box, from: 'from-slate-400', to: 'to-zinc-500', shadow: 'shadow-slate-500/20' },
};

/* --- GEMINI API HELPER --- */
const callGemini = async (prompt, systemInstruction = "") => {
  const customKey = typeof window !== 'undefined' ? localStorage.getItem('media_system_api_key') : null;
  const keyToUse = customKey || GEMINI_API_KEY;

  if (!keyToUse) console.warn("No API Key found.");
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${keyToUse}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { responseMimeType: "application/json" }
        }),
      }
    );

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Gemini call failed:", error);
    return null;
  }
};

/* --- COMPONENTS --- */

// 1. CINEMATIC MEDIA CARD
const MediaCard = ({ item, categoryConfig, viewMode, onUpdateStatus, onDelete, onMoveItem, watchlists }) => {
  const [expanded, setExpanded] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  
  const config = categoryConfig || CATEGORIES.OTHER;
  const isCompleted = item.status === 'completed';
  
  const title = typeof item.title === 'string' ? item.title : 'Untitled';
  const duration = typeof item.duration === 'string' ? item.duration : 'N/A';
  const description = typeof item.description === 'string' ? item.description : '';
  
  // FIX: Split tags by comma if they come in as a merged string
  const tags = useMemo(() => {
    let rawTags = item.tags;
    if (typeof rawTags === 'string') rawTags = rawTags.split(',');
    if (!Array.isArray(rawTags)) return [];
    
    // Flatten and clean
    return rawTags
      .flatMap(t => typeof t === 'string' ? t.split(',') : []) 
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }, [item.tags]);

  // Glassmorphism 2.0 Style
  const glassClass = `
    relative overflow-hidden transition-all duration-500 ease-out
    bg-[#1A1A1A]/40 backdrop-blur-xl border border-white/10
    shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]
    hover:border-white/20 hover:shadow-[0_0_30px_-5px_rgba(0,0,0,0.5)]
  `;

  if (viewMode === 'GRID') {
    return (
      <div 
        onClick={() => !showMoveMenu && setExpanded(!expanded)}
        className={`group ${glassClass} rounded-[24px] flex flex-col justify-between ${expanded ? 'h-auto ring-1 ring-white/20 z-20 bg-[#0A0A0A]' : 'h-64'}`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${config.from} ${config.to} opacity-10 group-hover:opacity-20 transition-opacity duration-700`} />
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03] pointer-events-none" />

        <div className="p-6 flex flex-col h-full relative z-10">
           <div className="flex justify-between items-start mb-2">
              <div className={`
                w-10 h-10 rounded-2xl flex items-center justify-center 
                bg-gradient-to-br ${config.from} ${config.to} text-white shadow-lg ${config.shadow}
                transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300
              `}>
                <config.icon size={18} strokeWidth={2.5} />
              </div>
              
              <button 
                onClick={(e) => { e.stopPropagation(); onUpdateStatus(item.id, isCompleted ? 'backlog' : 'completed'); }}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300
                  ${isCompleted 
                    ? 'bg-white text-black border-white scale-110 shadow-[0_0_15px_white]' 
                    : 'bg-black/30 border-white/10 text-white/30 hover:text-white hover:border-white/50'}
                `}
              >
                <Check size={14} strokeWidth={4} />
              </button>
           </div>
           
           <div className="flex-1 flex flex-col justify-center my-2">
             <h3 className={`font-black text-xl text-white leading-[1.1] line-clamp-3 tracking-tight ${isCompleted ? 'line-through opacity-40' : ''}`}>
               {title}
             </h3>
           </div>
           
           <div className="mt-auto">
             <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-white/90 bg-white/10 px-2.5 py-1 rounded-md border border-white/5 backdrop-blur-md">
                  {duration}
                </span>
             </div>
             
             {tags.length > 0 && (
               <div className="flex flex-wrap gap-1.5">
                 {tags.slice(0, 2).map((tag, i) => (
                   <span key={i} className="text-[9px] font-bold text-white/50 uppercase tracking-widest border border-white/5 px-1.5 rounded-sm">{tag}</span>
                 ))}
               </div>
             )}
           </div>
        </div>

        {expanded && (
           <div className="px-6 pb-6 pt-0 animate-in slide-in-from-bottom-2 duration-300 relative z-20">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />
              <p className="text-sm text-slate-400 leading-relaxed mb-6 font-medium">{description || "No info."}</p>
              
              {showMoveMenu ? (
                <div className="bg-[#111] rounded-xl p-3 border border-white/10 animate-in fade-in">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-1">Move to Watchlist</div>
                  <div className="flex flex-wrap gap-2">
                    {watchlists.map(list => (
                      <button
                        key={list}
                        onClick={(e) => { e.stopPropagation(); onMoveItem(item.id, list); setShowMoveMenu(false); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-indigo-600 hover:text-white text-slate-300 transition-colors border border-white/5"
                      >
                        {list}
                      </button>
                    ))}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setShowMoveMenu(false); }} className="w-full mt-2 text-[10px] text-red-400 hover:text-red-300 py-1">Cancel</button>
                </div>
              ) : (
                <div className="flex gap-2">
                   <button 
                    onClick={(e) => { e.stopPropagation(); setShowMoveMenu(true); }}
                    className="flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors border border-white/5"
                   >
                     <FolderOpen size={14} /> List
                   </button>
                   <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    className="flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 transition-colors border border-red-500/10"
                   >
                     <Trash2 size={14} />
                   </button>
                </div>
              )}
           </div>
        )}
      </div>
    );
  }

  // List View (Minimalist)
  return (
    <div 
      onClick={() => !showMoveMenu && setExpanded(!expanded)}
      className={`group ${glassClass} rounded-2xl mb-2 min-h-[80px]`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${config.from} ${config.to}`} />
      
      <div className="p-4 flex gap-4 items-center relative z-10">
        <div className={`p-2.5 rounded-xl bg-white/5 text-white/80 border border-white/5`}>
          <config.icon size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
             <h3 className={`font-bold text-base text-white/90 truncate pr-4 ${isCompleted ? 'line-through opacity-50' : ''}`}>
               {title}
             </h3>
             <span className="text-[10px] font-bold text-slate-500 border border-white/5 px-2 py-0.5 rounded bg-black/40">{duration}</span>
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
             {tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                  {tag}
                </span>
             ))}
          </div>
        </div>

        <button 
           onClick={(e) => { e.stopPropagation(); onUpdateStatus(item.id, isCompleted ? 'backlog' : 'completed'); }}
           className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${isCompleted ? 'bg-white text-black border-white' : 'border-white/10 text-white/20 hover:text-white'}`}
        >
           <Check size={14} strokeWidth={3} />
        </button>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2 relative z-20">
           <div className="w-full h-px bg-white/5 mb-3" />
           <p className="text-xs text-slate-400 mb-4">{description}</p>
           
           <div className="flex gap-2 justify-end">
              <button onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white font-bold uppercase tracking-wider">Move</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[10px] text-red-400 font-bold uppercase tracking-wider">Delete</button>
           </div>
           
           {showMoveMenu && (
             <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in">
                {watchlists.map(list => (
                  <button
                    key={list}
                    onClick={(e) => { e.stopPropagation(); onMoveItem(item.id, list); setShowMoveMenu(false); }}
                    className="text-[10px] px-3 py-1.5 rounded-full bg-indigo-600/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500 hover:text-white"
                  >
                    {list}
                  </button>
                ))}
             </div>
           )}
        </div>
      )}
    </div>
  );
};

// 2. MAIN APP
export default function MediaSystem() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('DASHBOARD'); // DASHBOARD | LIBRARY | AI | PROFILE
  const [items, setItems] = useState([]);
  
  // View & Filter
  const [selectedCategory, setSelectedCategory] = useState('MOVIE');
  const [selectedGenres, setSelectedGenres] = useState([]); 
  const [viewMode, setViewMode] = useState('GRID');
  
  // Watchlists
  const [watchlists, setWatchlists] = useState(['Main']);
  const [activeWatchlist, setActiveWatchlist] = useState('Main');
  const [isWatchlistMenuOpen, setIsWatchlistMenuOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');

  // Features
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [inputMode, setInputMode] = useState('SINGLE'); 
  const [inputText, setInputText] = useState('');
  const [vibeQuery, setVibeQuery] = useState('');
  const [vibeResults, setVibeResults] = useState([]);
  const [isProcessingVibe, setIsProcessingVibe] = useState(false);
  const [isPickOpen, setIsPickOpen] = useState(false);
  const [pickTime, setPickTime] = useState(60); 
  const [pickedItem, setPickedItem] = useState(null);
  const [customApiKey, setCustomApiKey] = useState('');

  /* --- DATA & AUTH --- */
  useEffect(() => {
    const init = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    init();
    const sub = onAuthStateChanged(auth, u => setUser(u));
    const k = localStorage.getItem('media_system_api_key');
    if (k) setCustomApiKey(k);
    return () => sub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'media_items'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, s => setItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'user_lists'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, s => {
      if (!s.empty) setWatchlists(s.docs.map(d => d.data().name));
      else addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'user_lists'), { name: 'Main', createdAt: serverTimestamp() });
    });
  }, [user]);

  /* --- LOGIC --- */
  const handleSaveApiKey = () => {
    localStorage.setItem('media_system_api_key', customApiKey);
    alert("System Config Saved.");
  };

  const handleCreateList = async () => {
    if (!newWatchlistName.trim() || !user) return;
    if (watchlists.includes(newWatchlistName.trim())) return alert("Exists!");
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'user_lists'), { name: newWatchlistName.trim(), createdAt: serverTimestamp() });
    setActiveWatchlist(newWatchlistName.trim());
    setNewWatchlistName('');
    setIsWatchlistMenuOpen(false);
  };

  const handleMoveItem = async (itemId, targetList) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'media_items', itemId), { list: targetList });
  };

  const toggleGenre = (g) => setSelectedGenres(p => p.includes(g) ? p.filter(i => i !== g) : [...p, g]);

  const handleAdd = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    let prompt = inputMode === 'SINGLE' 
      ? `Identify "${inputText}" (Category: ${selectedCategory}). JSON Array of 1 object: title, tags (Comma separated string of genres, e.g. "Action, Sci-Fi"), duration, description (30 words).`
      : `Extract items from this list (Category: ${selectedCategory}). JSON Array. Each: title, tags (Comma separated string of genres), duration, description.`;
    
    const res = await callGemini(inputText, prompt);
    let newItems = Array.isArray(res) ? res : (res ? [res] : []);
    
    newItems = newItems.map(i => ({
      ...i,
      tags: Array.isArray(i.tags) ? i.tags : (typeof i.tags === 'string' ? i.tags.split(',').map(t => t.trim()) : [])
    }));

    if (newItems.length === 0 && inputMode === 'SINGLE') newItems = [{ title: inputText, tags: [], duration: '?', description: 'Manual entry.' }];

    if (user) {
      const col = collection(db, 'artifacts', appId, 'users', user.uid, 'media_items');
      for (const i of newItems) await addDoc(col, { ...i, type: selectedCategory, status: 'backlog', list: activeWatchlist, createdAt: serverTimestamp() });
    }
    setLoading(false); setInputText(''); setIsAddOpen(false);
  };

  const handleSystemPick = async () => {
    const relevantItems = items.filter(i => i.type === selectedCategory && i.status !== 'completed' && (i.list === activeWatchlist || !i.list));
    if (relevantItems.length === 0) {
      alert("List is empty!");
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));

    const prompt = `
      Time: ${pickTime} mins. 
      Items: ${JSON.stringify(relevantItems.map(i => ({ title: i.title, duration: i.duration })))}
      Task: Pick ONE best fit. Return JSON: { title, reason_short }
    `;
    const result = await callGemini(prompt, "You are a media curator.");
    if (result) {
      const matched = relevantItems.find(i => i.title === result.title) || relevantItems[0];
      setPickedItem({ ...matched, reason: result.reason_short });
    }
    setLoading(false);
  };

  /* --- DATA FILTERS --- */
  const categoryItems = useMemo(() => items.filter(i => {
    const listMatch = i.list === activeWatchlist || (!i.list && activeWatchlist === 'Main');
    const catMatch = i.type === selectedCategory;
    return listMatch && catMatch;
  }), [items, activeWatchlist, selectedCategory]);

  const genres = useMemo(() => {
    const s = new Set();
    categoryItems.forEach(i => {
      const t = Array.isArray(i.tags) ? i.tags : (typeof i.tags === 'string' ? i.tags.split(',').map(x=>x.trim()) : []);
      t.forEach(x => {
        if (typeof x === 'string' && x.length > 0) s.add(x);
      });
    });
    return Array.from(s).sort();
  }, [categoryItems]);

  const displayItems = useMemo(() => {
    if (selectedGenres.length === 0) return categoryItems;
    return categoryItems.filter(i => {
      const t = Array.isArray(i.tags) ? i.tags : (typeof i.tags === 'string' ? i.tags.split(',') : []);
      return selectedGenres.some(g => t.includes(g));
    });
  }, [categoryItems, selectedGenres]);

  const stats = useMemo(() => {
    const s = { total: items.length, completed: items.filter(i => i.status === 'completed').length };
    return s;
  }, [items]);

  /* --- RENDERERS --- */

  const renderDashboard = () => (
    <div className="flex-1 overflow-y-auto px-6 pb-32 pt-12 scroll-smooth scrollbar-hide">
      {/* Background Noise/Texture */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay" />
      
      {/* Hero Section */}
      <div className="relative mb-8">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-[80px]" />
        <h1 className="text-6xl font-black text-white tracking-tighter leading-[0.8] mb-2 relative z-10 mix-blend-difference">
          MEDIA<br/>SYNC
        </h1>
        <div className="flex items-center gap-3 text-indigo-400 font-mono text-xs tracking-[0.2em] uppercase">
          <span>メディア・シンク</span>
          <div className="h-px w-12 bg-indigo-500/50" />
          <span>v2.0</span>
        </div>
      </div>

      {/* Stats Ticker */}
      <div className="flex gap-4 mb-8 overflow-x-auto no-scrollbar">
         <div className="flex-none bg-white/5 border border-white/10 px-4 py-3 rounded-xl backdrop-blur-md flex items-center gap-3 min-w-[140px]">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <div>
               <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total</div>
               <div className="text-xl font-bold font-mono">{stats.total}</div>
            </div>
         </div>
         <div className="flex-none bg-white/5 border border-white/10 px-4 py-3 rounded-xl backdrop-blur-md flex items-center gap-3 min-w-[140px]">
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
            <div>
               <div className="text-[10px] text-slate-400 uppercase tracking-wider">Watched</div>
               <div className="text-xl font-bold font-mono">{stats.completed}</div>
            </div>
         </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Main Library Card */}
        <button 
          onClick={() => setView('LIBRARY')}
          className="col-span-12 h-64 relative group rounded-[32px] overflow-hidden border border-white/10"
        >
          {/* Manga Speed Lines Effect */}
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,rgba(0,0,0,1)_0deg,rgba(20,20,20,1)_360deg)] group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-80" />
          <div className="absolute inset-0 bg-indigo-600/10 group-hover:bg-indigo-600/20 transition-colors mix-blend-overlay" />
          
          <div className="absolute top-6 left-6 z-20 text-left">
             <div className="bg-white text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-2 w-fit">Collection</div>
             <h2 className="text-4xl font-black text-white tracking-tighter">LIBRARY</h2>
             <p className="text-sm text-slate-400 font-mono mt-1">コレクション</p>
          </div>

          <div className="absolute -bottom-4 -right-4 opacity-50 group-hover:opacity-80 transition-opacity duration-500 rotate-12">
             <Film size={120} strokeWidth={0.5} className="text-white/10" />
          </div>
          <div className="absolute bottom-6 right-6 z-20 bg-white/10 backdrop-blur-md border border-white/10 p-3 rounded-full group-hover:bg-white group-hover:text-black transition-all">
             <ArrowRight size={24} className="-rotate-45" />
          </div>
        </button>

        {/* AI Vibe Check */}
        <button 
          onClick={() => setView('AI')}
          className="col-span-7 h-48 bg-[#0F0F0F] rounded-[32px] relative overflow-hidden group border border-white/10 flex flex-col justify-between p-6 text-left"
        >
           <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-shimmer" />
           <div className="absolute top-0 right-0 p-4 opacity-20">
              <Sparkles size={64} className="text-fuchsia-500" />
           </div>
           
           <div className="z-10 bg-fuchsia-500/20 w-fit p-2 rounded-lg backdrop-blur-md border border-fuchsia-500/20">
              <Sparkles size={20} className="text-fuchsia-300" />
           </div>
           <div className="z-10">
              <h3 className="text-xl font-bold text-white leading-none">VIBE<br/>CHECK</h3>
              <p className="text-[10px] text-fuchsia-400/80 font-mono mt-2 uppercase tracking-wider">AI Analysis</p>
           </div>
        </button>

        {/* Add Button */}
        <button 
          onClick={() => setIsAddOpen(true)}
          className="col-span-5 h-48 bg-white rounded-[32px] relative overflow-hidden group border border-white/10 flex flex-col justify-center items-center p-4 hover:bg-slate-200 transition-colors"
        >
           <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]" />
           <Plus size={40} className="text-black mb-2 group-hover:scale-125 transition-transform duration-300" strokeWidth={3} />
           <span className="text-black font-black text-sm uppercase tracking-widest">ADD</span>
        </button>

        {/* Profile / System */}
        <button 
          onClick={() => setView('PROFILE')}
          className="col-span-12 bg-[#111] border border-white/5 rounded-[24px] p-5 flex items-center justify-between group hover:border-white/20 transition-colors relative overflow-hidden"
        >
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
           <div className="flex items-center gap-4 z-10">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center font-mono text-xs text-white border border-white/10">
                 ID
              </div>
              <div className="text-left">
                 <div className="font-bold text-slate-200 text-sm">SYSTEM CONFIG</div>
                 <div className="text-[10px] text-slate-500 font-mono">STATUS: ONLINE</div>
              </div>
           </div>
           <Settings size={18} className="text-slate-500 group-hover:rotate-90 transition-transform duration-500" />
        </button>

      </div>
    </div>
  );

  const renderLibrary = () => (
    <div className="h-full flex flex-col bg-[#050505] selection:bg-indigo-500/30">
      {/* Floating Navbar */}
      <div className="pt-safe-top px-6 pb-4 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-6 pt-4">
          <button onClick={() => setView('DASHBOARD')} className="p-3 bg-white/5 rounded-full text-slate-300 hover:bg-white/10 hover:text-white transition-colors border border-white/5">
            <ArrowRight className="rotate-180" size={20} />
          </button>
          
          <button 
            onClick={() => setIsWatchlistMenuOpen(!isWatchlistMenuOpen)}
            className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full border border-white/10 hover:border-white/20 transition-all group"
          >
            <Layers size={16} className="text-indigo-400" />
            <span className="font-bold text-white text-lg tracking-tight">{activeWatchlist}</span>
            <ChevronDown size={14} className={`text-slate-500 transition-transform duration-300 ${isWatchlistMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          <div className="flex gap-2">
             <button onClick={() => setViewMode(viewMode === 'GRID' ? 'LIST' : 'GRID')} className="p-3 bg-white/5 rounded-full text-slate-300 hover:bg-white/10 border border-white/5">
                {viewMode === 'GRID' ? <ListIcon size={20}/> : <LayoutGrid size={20}/>}
             </button>
             <button onClick={() => setIsPickOpen(true)} className="p-3 bg-white text-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform">
                <Dices size={20} />
             </button>
          </div>
        </div>

        {/* Categories Scroller */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {Object.values(CATEGORIES).map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setSelectedGenres([]); }}
              className={`
                flex items-center gap-2 px-5 py-3 rounded-2xl transition-all duration-300 border
                ${selectedCategory === cat.id 
                  ? `bg-gradient-to-r ${cat.from} ${cat.to} border-transparent text-white shadow-lg ${cat.shadow}` 
                  : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}
              `}
            >
              <cat.icon size={18} strokeWidth={2.5} />
              <span className="text-xs font-bold uppercase tracking-wider">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Genre Filters */}
        {genres.length > 0 && (
          <div className="flex items-center gap-2 py-4 overflow-x-auto no-scrollbar mask-linear-fade">
            <Filter size={14} className="text-slate-500 shrink-0 mr-2" />
            <button 
              onClick={() => setSelectedGenres([])}
              className={`text-[10px] font-black px-4 py-2 rounded-lg transition-all border uppercase tracking-wider ${selectedGenres.length === 0 ? 'bg-white text-black border-white' : 'bg-transparent text-slate-500 border-transparent hover:bg-white/5'}`}
            >
              All
            </button>
            {genres.map(g => (
              <button 
                key={g} onClick={() => toggleGenre(g)}
                className={`
                  text-[10px] font-bold px-4 py-2 rounded-lg transition-all border whitespace-nowrap uppercase tracking-wider
                  ${selectedGenres.includes(g) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}
                `}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-12 pt-4 scroll-smooth">
        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-slate-600 opacity-50">
             <Box size={64} strokeWidth={0.5} className="mb-4" />
             <p className="text-sm font-medium uppercase tracking-widest">Zone Empty</p>
          </div>
        ) : (
          <div className={viewMode === 'GRID' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-2"}>
            {displayItems.map(item => (
              <MediaCard 
                key={item.id} 
                item={item} 
                categoryConfig={CATEGORIES[item.type]}
                viewMode={viewMode}
                watchlists={watchlists}
                onUpdateStatus={async (id, status) => await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'media_items', id), { status })}
                onDelete={async (id) => await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'media_items', id))}
                onMoveItem={handleMoveItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Watchlist Menu Overlay */}
      {isWatchlistMenuOpen && (
        <div className="absolute top-24 left-6 z-50 w-64 bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 origin-top-left">
          <div className="mb-2 max-h-48 overflow-y-auto custom-scrollbar">
            {watchlists.map(list => (
              <button 
                key={list}
                onClick={() => { setActiveWatchlist(list); setIsWatchlistMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeWatchlist === list ? 'bg-white text-black' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                {list}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-white/10 flex gap-2">
            <input 
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
              placeholder="New list..."
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
            />
            <button onClick={handleCreateList} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl text-white">
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Cinematic Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] bg-indigo-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80vw] h-[80vw] bg-fuchsia-600/10 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
      </div>

      <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
        {view === 'DASHBOARD' && renderDashboard()}
        {view === 'LIBRARY' && renderLibrary()}
        
        {view === 'AI' && (
          <div className="h-full flex flex-col p-6 pt-12 relative z-10 overflow-y-auto">
             <button onClick={() => setView('DASHBOARD')} className="mb-6 w-fit p-3 bg-white/5 rounded-full text-slate-400 hover:text-white border border-white/5"><ArrowRight className="rotate-180" size={24}/></button>
             <div className="bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-white/10 rounded-[40px] p-8 text-center flex-col justify-center items-center relative overflow-hidden mb-8">
                <Sparkles className="w-16 h-16 text-indigo-300 mb-6 mx-auto" />
                <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">WHAT'S THE VIBE?</h2>
                <div className="w-full max-w-sm relative mb-8 mx-auto">
                  <input 
                    className="w-full bg-black/40 border border-white/20 rounded-2xl px-6 py-5 text-white text-center placeholder-white/30 focus:border-indigo-500 transition-colors outline-none text-lg"
                    placeholder="e.g. Dark Sci-Fi with robots..."
                    value={vibeQuery} onChange={e => setVibeQuery(e.target.value)}
                  />
                </div>
                <button onClick={async () => {
                   setLoading(true);
                   const rel = items.filter(i => i.type === selectedCategory);
                   const res = await callGemini(vibeQuery, `Find top 3 matches in: ${JSON.stringify(rel.map(x=>({id:x.id, title:x.title, tags:x.tags})))}. Return JSON array {id, reason}`);
                   if(Array.isArray(res)) setVibeResults(res.map(r => ({...items.find(i=>i.id===r.id), reason:r.reason})).filter(x=>x.id));
                   setLoading(false);
                }} className="bg-white text-black px-10 py-4 rounded-2xl font-black shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform flex items-center gap-3 mx-auto">
                  {loading ? <Loader2 className="animate-spin"/> : <>ANALYZE <Send size={18}/></>}
                </button>
             </div>

             <div className="w-full space-y-4 pb-20">
               {vibeResults.map((res, i) => (
                 <div key={i} className="bg-black/60 border border-white/10 p-5 rounded-3xl text-left animate-in slide-in-from-bottom-4 backdrop-blur-md" style={{animationDelay: `${i*100}ms`}}>
                    <div className="flex gap-4 items-center">
                       <div className="bg-indigo-500/20 p-2 rounded-full text-indigo-300 font-bold font-mono">0{i+1}</div>
                       <div>
                          <div className="font-bold text-white text-lg">{res.title}</div>
                          <div className="text-sm text-slate-400 mt-1 leading-relaxed">"{res.reason}"</div>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {view === 'PROFILE' && (
          <div className="h-full flex flex-col p-6 pt-12 relative z-10 overflow-y-auto">
             <button onClick={() => setView('DASHBOARD')} className="mb-8 w-fit p-3 bg-white/5 rounded-full text-slate-400 hover:text-white border border-white/5"><ArrowRight className="rotate-180" size={24}/></button>
             <h2 className="text-4xl font-black text-white mb-8 tracking-tighter">SETTINGS</h2>
             
             <div className="bg-[#111] border border-white/10 rounded-3xl p-8 mb-6">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em] mb-6">Connectivity</h3>
                <div className="bg-black/40 rounded-2xl p-2 flex gap-3 border border-white/5">
                   <div className="pl-4 py-3 text-slate-500"><Key size={18} /></div>
                   <input type="password" value={customApiKey} onChange={e=>setCustomApiKey(e.target.value)} className="bg-transparent flex-1 text-sm text-white outline-none font-mono" placeholder="Gemini API Key" />
                   <button onClick={handleSaveApiKey} className="text-xs bg-white text-black font-bold px-4 py-2 rounded-xl hover:bg-indigo-50">SAVE</button>
                </div>
             </div>

             <div className="bg-[#111] border border-white/10 rounded-3xl p-8">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em] mb-6">System Stats</h3>
                <div className="flex gap-8">
                   <div>
                      <div className="text-5xl font-black text-white mb-1">{stats.total}</div>
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Items</div>
                   </div>
                   <div>
                      <div className="text-5xl font-black text-white mb-1">{stats.completed}</div>
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Completed</div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
           <div className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 shadow-2xl relative overflow-hidden mb-safe-bottom">
              <div className="flex justify-between items-center mb-8">
                 <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">NEW ENTRY</h2>
                    <p className="text-xs text-indigo-400 font-mono mt-1">TARGET: {activeWatchlist.toUpperCase()}</p>
                 </div>
                 <button onClick={() => setIsAddOpen(false)} className="bg-white/10 p-3 rounded-full text-white hover:bg-white/20"><X size={20}/></button>
              </div>

              <div className="flex gap-4 overflow-x-auto no-scrollbar mb-8 pb-2">
                 {Object.values(CATEGORIES).map(cat => (
                   <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex flex-col items-center gap-2 min-w-[70px] transition-all duration-300 ${selectedCategory === cat.id ? 'opacity-100 scale-110' : 'opacity-30'}`}>
                      <div className={`p-4 rounded-2xl ${selectedCategory === cat.id ? `bg-gradient-to-br ${cat.from} ${cat.to} text-white shadow-lg ${cat.shadow}` : 'bg-white/10 text-slate-400'}`}><cat.icon size={24} /></div>
                      <span className="text-[10px] font-bold uppercase tracking-wider">{cat.label}</span>
                   </button>
                 ))}
              </div>

              <div className="relative mb-6">
                 <textarea 
                   value={inputText} onChange={e => setInputText(e.target.value)}
                   className="w-full h-40 bg-black/40 border border-white/10 rounded-3xl p-6 text-xl text-white focus:border-indigo-500/50 outline-none resize-none placeholder-white/10 font-bold"
                   placeholder={inputMode === 'SINGLE' ? "Type title..." : "Paste list..."}
                 />
                 <div className="absolute bottom-4 right-4 flex gap-2">
                    <button onClick={() => setInputMode('SINGLE')} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${inputMode === 'SINGLE' ? 'bg-white text-black' : 'bg-white/5 text-slate-500'}`}>Search</button>
                    <button onClick={() => setInputMode('BULK')} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${inputMode === 'BULK' ? 'bg-white text-black' : 'bg-white/5 text-slate-500'}`}>List</button>
                 </div>
              </div>

              <button onClick={handleAdd} disabled={loading} className="w-full py-5 bg-white text-black rounded-3xl font-black text-lg hover:bg-indigo-50 transition-colors flex justify-center items-center gap-3 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]">
                {loading ? <Loader2 className="animate-spin" /> : <>EXECUTE <Plus strokeWidth={4} size={18}/></>}
              </button>
           </div>
        </div>
      )}

      {/* PICK MODAL */}
      {isPickOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in">
           <div className="w-full max-w-sm bg-[#0F0F0F] border border-white/10 rounded-[48px] p-10 text-center shadow-2xl relative">
              {!pickedItem ? (
                <>
                  <Clock size={64} className="mx-auto text-indigo-500 mb-8" strokeWidth={1.5} />
                  <h2 className="text-3xl font-black text-white mb-8 tracking-tighter leading-none">TIME<br/>AVAILABLE?</h2>
                  <input type="range" min="30" max="300" step="30" value={pickTime} onChange={(e) => setPickTime(e.target.value)} className="w-full accent-white h-2 bg-white/10 rounded-lg appearance-none cursor-pointer mb-6" />
                  <div className="text-6xl font-black text-white mb-10">{pickTime}<span className="text-lg text-slate-500 font-bold ml-1">MIN</span></div>
                  <div className="flex gap-4">
                    <button onClick={() => setIsPickOpen(false)} className="flex-1 py-4 bg-white/5 text-slate-400 rounded-3xl font-bold hover:bg-white/10 uppercase tracking-widest text-xs">Cancel</button>
                    <button onClick={handleSystemPick} disabled={loading} className="flex-1 py-4 bg-white text-black rounded-3xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform">{loading ? <Loader2 className="animate-spin mx-auto" /> : 'Start'}</button>
                  </div>
                </>
              ) : (
                <div className="animate-in zoom-in-95">
                   <div className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em] mb-8">System Selection</div>
                   <h1 className="text-4xl font-black text-white mb-6 leading-none tracking-tight">{pickedItem.title}</h1>
                   <div className="text-sm font-bold bg-white/10 text-slate-200 px-6 py-3 rounded-full inline-block mb-10 border border-white/5">{pickedItem.duration}</div>
                   <button onClick={() => { setPickedItem(null); setIsPickOpen(false); }} className="w-full py-5 bg-white text-black font-black rounded-3xl text-lg hover:scale-105 transition-transform">ACCEPT</button>
                </div>
              )}
           </div>
        </div>
      )}

    </div>
  );
}
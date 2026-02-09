import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, LyricLine, Playlist } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  fetchSongUrl, fetchSongDetail, fetchLyrics, 
  checkGuestLimit, addToHistory, getHistory,
  searchSongs, getLikedSongs, toggleLike, checkIsLiked, parseLyrics,
  fetchRandomMusic, fetchTopLists, fetchPlaylistDetails
} from '../services/musicService';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, 
  Download, Search, Loader2,
  Music, ArrowLeft, Clock, Mic2, LayoutGrid, Heart,
  ChevronDown, Repeat1, ArrowDown, Sparkles, Disc, ListMusic
} from 'lucide-react';

interface MusicPlatformProps {
  activeView: 'dashboard' | 'studio' | 'music' | 'bookmarks' | 'guestbook';
  onViewChange: (view: any) => void;
  requestedTab: 'favorites' | 'history' | null;
  onTabChangeHandled: () => void;
  onAuthRequest: () => void;
}

const GUEST_PLAY_LIMIT = 20;

const MusicPlatform: React.FC<MusicPlatformProps> = ({ 
  activeView, onViewChange, requestedTab, onTabChangeHandled, onAuthRequest 
}) => {
  const { user } = useAuth();
  
  // Player State
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'loop' | 'single' | 'shuffle'>('loop');
  const [quality, setQuality] = useState('flac');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isLiked, setIsLiked] = useState(false);
  
  // UI State
  const [view, setView] = useState<'home' | 'history' | 'search' | 'favorites' | 'playlist'>('home');
  const [topLists, setTopLists] = useState<Playlist[]>([]);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  
  // Search Pagination State
  const [searchPage, setSearchPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  
  // Search Source State
  const [searchSource, setSearchSource] = useState<'netease' | 'qq' | 'kuwo'>('netease');
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  
  // Lyrics State
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [rawLyric, setRawLyric] = useState<string>(''); // Store raw lyric text for DB saving
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const restoreTimeRef = useRef(0);
  
  // Guard for async callbacks
  const currentSongIdRef = useRef<string | number | null>(null);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
    }
  }, [volume]);

  // Load Top Lists on Mount
  useEffect(() => {
      fetchTopLists().then(setTopLists).catch(err => console.error("Failed to load top lists", err));
  }, []);

  // Handle Tab Requests
  useEffect(() => {
      if (requestedTab === 'history') {
          loadHistory();
          setView('history');
          onTabChangeHandled();
      } else if (requestedTab === 'favorites') {
          loadFavorites();
          onTabChangeHandled();
      }
  }, [requestedTab, onTabChangeHandled]);

  // Check Liked Status on Song Change
  useEffect(() => {
    if (currentSong && user) {
        checkIsLiked(user.id, currentSong.id).then(setIsLiked);
    } else {
        setIsLiked(false);
    }
  }, [currentSong?.id, user]);

  // Determine active lyric index
  const activeLyricIndex = useMemo(() => {
      if (!lyrics.length) return -1;
      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) {
          if (lyrics[i].time <= progress) {
              idx = i;
          } else {
              break;
          }
      }
      return idx;
  }, [lyrics, progress]);

  // Auto-scroll lyrics
  useEffect(() => {
      if (showLyrics && activeLyricIndex !== -1 && lyricsContainerRef.current) {
          const container = lyricsContainerRef.current;
          const activeNode = container.children[activeLyricIndex] as HTMLElement;
          if (activeNode) {
              activeNode.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
              });
          }
      }
  }, [activeLyricIndex, showLyrics]);

  const loadHistory = async () => {
      if (!user) return;
      setLoading(true);
      const songs = await getHistory(user.id);
      setPlaylistSongs(songs);
      setLoading(false);
      setView('history');
  };

  const loadFavorites = async () => {
      if (!user) {
          if (onAuthRequest) onAuthRequest();
          return;
      }
      setLoading(true);
      const songs = await getLikedSongs(user.id);
      setPlaylistSongs(songs);
      setLoading(false);
      setView('favorites');
  };

  const handlePlaylistClick = async (playlist: Playlist) => {
      setLoading(true);
      setSelectedPlaylist(playlist);
      setView('playlist');
      // Clear previous list to avoid confusion
      setPlaylistSongs([]);
      
      const songs = await fetchPlaylistDetails(playlist.id, playlist.source || 'netease');
      setPlaylistSongs(songs);
      setLoading(false);
  };

  const handleRandomPlay = async () => {
      setToastMessage("正在获取随机音乐...");
      const song = await fetchRandomMusic();
      if (song) {
          // Play the song immediately. 
          // We add it to the front of the queue so user can go back or forward if needed, 
          // or just play it as a single instance.
          const newQueue = [song, ...queue];
          playSong(song, newQueue);
          setToastMessage(null);
      } else {
          setToastMessage("获取随机音乐失败，请重试");
          setTimeout(() => setToastMessage(null), 2000);
      }
  };

  const handleSearch = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!searchQuery.trim()) return;
      setShowSourceMenu(false); // Close menu if open
      setView('search');
      setLoading(true);
      setSearchPage(1); // Reset page
      setHasMoreResults(true);
      
      const songs = await searchSongs(searchQuery, searchSource, 1);
      setSearchResults(songs);
      
      // If we got fewer than limit (20), assume no more results
      if (songs.length < 20) {
          setHasMoreResults(false);
      }
      
      setLoading(false);
  };

  const handleLoadMore = async () => {
      if (isLoadingMore || !hasMoreResults) return;
      
      setIsLoadingMore(true);
      const nextPage = searchPage + 1;
      
      const newSongs = await searchSongs(searchQuery, searchSource, nextPage);
      
      if (newSongs.length > 0) {
          setSearchResults(prev => [...prev, ...newSongs]);
          setSearchPage(nextPage);
          if (newSongs.length < 20) {
              setHasMoreResults(false);
          }
      } else {
          setHasMoreResults(false);
      }
      
      setIsLoadingMore(false);
  };

  const handleAudioError = (msg: string) => {
    console.error("Audio Error:", msg);
    setErrorCount(prev => prev + 1);
    if (errorCount < 3) {
        setTimeout(() => playNext(), 1000);
    } else {
        setToastMessage("播放出错，已跳过");
        setErrorCount(0);
        playNext();
    }
  };

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
        if (onAuthRequest) onAuthRequest();
        return;
    }
    if (!currentSong) return;
    
    // Optimistic Update
    const newStatus = !isLiked;
    setIsLiked(newStatus);
    
    try {
        // Pass rawLyric to save it in DB if adding
        const result = await toggleLike(user.id, currentSong, rawLyric);
        if (result !== newStatus) setIsLiked(result); 
        
        // If unliking while in favorites view, remove from list
        if (view === 'favorites' && !result) {
            setPlaylistSongs(prev => prev.filter(s => String(s.id) !== String(currentSong.id)));
        }
        // If liking and in favorites (edge case, usually means re-adding), add to top
        if (view === 'favorites' && result) {
            setPlaylistSongs(prev => [currentSong, ...prev]);
        }
    } catch (e) {
        setIsLiked(!newStatus);
        console.error("Toggle like failed", e);
    }
  };

  // Player Controls
  const playSong = async (song: Song, newQueue?: Song[]) => {
    let currentQueue = newQueue || queue;
    if (newQueue) {
      setQueue(newQueue);
    }

    if (currentSong?.id === song.id) {
      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.pause();
              setIsPlaying(false);
          } else {
              audioRef.current.play();
              setIsPlaying(true);
          }
      }
      return;
    }

    if (!user) {
        setCheckingLimit(true);
        setToastMessage("正在验证试听权限...");
        try {
            const { allowed, count } = await checkGuestLimit();
            setCheckingLimit(false);

            if (!allowed) {
               setToastMessage(null);
               if (confirm(`试听次数已用完（总共${GUEST_PLAY_LIMIT}首）。\n\n您的 IP 试听额度已达上限。\n登录账号即可解锁无限畅听。\n\n是否立即登录？`)) {
                   if (onAuthRequest) onAuthRequest();
               }
               return;
            }
            setToastMessage(`试听模式：${count} / ${GUEST_PLAY_LIMIT} 首`);
        } catch (e) {
            console.error("Guest check failed", e);
            setCheckingLimit(false);
        }
    }

    setIsPlaying(false); 
    setErrorCount(0);
    setProgress(0);
    setLyrics([]); // Clear lyrics immediately
    setRawLyric('');
    restoreTimeRef.current = 0; 
    
    currentSongIdRef.current = song.id;
    setCurrentSong(song);

    // Metadata Fetching Optimization:
    // Only fetch details if cover is missing or name is unknown.
    // If song comes from DB (History/Likes), it usually has full metadata.
    // For 'random' source, metadata usually comes fully populated from the specific fetchRandomMusic function
    const needsMetadata = song.source !== 'random' && (!song.al.picUrl || song.al.picUrl.includes('default') || song.name === 'Unknown Title');

    if (needsMetadata) {
        fetchSongDetail(song.id, song.source).then(detail => {
            // Strict guard: ensure we are still targeting the same song
            if (String(currentSongIdRef.current) !== String(song.id)) return;

            if (detail) {
                setCurrentSong(prev => {
                    if (!prev || String(prev.id) !== String(song.id)) return prev;
                    const newAl = {
                        id: detail.al.id || prev.al.id,
                        name: (detail.al.name && detail.al.name !== 'Unknown Album') ? detail.al.name : prev.al.name,
                        picUrl: detail.al.picUrl || prev.al.picUrl
                    };
                    const newAr = (detail.ar && detail.ar.length > 0 && detail.ar[0].name !== 'Unknown Artist') ? detail.ar : prev.ar;
                    return {
                        ...prev,
                        name: (detail.name && detail.name !== 'Unknown Title') ? detail.name : prev.name,
                        ar: newAr,
                        al: newAl,
                        dt: detail.dt || prev.dt,
                        url: prev.url || detail.url 
                    };
                });
            }
        });
    }

    // Lyrics Fetching Logic:
    // If lyric is already present (from DB), parse it directly.
    // Otherwise fetch from API.
    let lyricTextForSave = song.lyric || '';

    if (song.lyric) {
        setLyrics(parseLyrics(song.lyric));
        setRawLyric(song.lyric);
    } else {
        // Kick off Meting lyric fetch in background
        // Random source usually doesn't have lyric API easily mapped, but we can try generic Meting if user wants
        // For now we skip lyrics for random source to prevent errors unless song.id is compatible
        if (song.source !== 'random') {
            fetchLyrics(song.id, song.source).then(({ lines, raw }) => {
                // Strict Guard
                if (String(currentSongIdRef.current) !== String(song.id)) return;
                
                // Only update if we don't have lyrics yet, or if this is the primary source
                if (raw && (!lyricTextForSave || lyricTextForSave.length < 10)) {
                   setLyrics(lines);
                   setRawLyric(raw);
                   if (user) addToHistory(user.id, song, raw);
                }
            });
        }
    }

    // URL Fetching Logic
    let url = song.url;
    
    // If URL is missing, fetch it. If present, use it directly (Database Source).
    if (!url) {
        // Fetch URL and possibly lyrics (for QQ especially)
        // Pass metadata (name/artist) for QQ Music new API support
        const result = await fetchSongUrl(
            song.id, 
            song.source, 
            quality,
            { name: song.name, artist: song.ar?.[0]?.name }
        );
        
        // CRITICAL GUARD: Before using async result, check if song changed
        if (String(currentSongIdRef.current) !== String(song.id)) {
            console.log(`Ignored stale URL result for ${song.name}`);
            return;
        }
        
        if (result) {
            url = result.url;
            
            // If the parse endpoint returned lyrics, use them!
            // This is often more reliable for QQ than the Meting API
            if (result.lyric && result.lyric.length > 0) {
                const parsed = parseLyrics(result.lyric);
                if (parsed.length > 0) {
                    setLyrics(parsed);
                    setRawLyric(result.lyric);
                    lyricTextForSave = result.lyric;
                }
            }
        }
    }

    if (url) {
      // Final Guard Check
      if (String(currentSongIdRef.current) !== String(song.id)) return;

      const finalUrl = url;
      // Update state with valid URL
      setCurrentSong(prev => (prev && String(prev.id) === String(song.id) ? { ...prev, url: finalUrl } : prev));
      setIsPlaying(true);
      
      // Save history with URL now that we have it
      if (user) {
          // Clone song to avoid mutating queue immediately
          const songWithUrl = { ...song, url: finalUrl };
          addToHistory(user.id, songWithUrl, lyricTextForSave).then(() => {
               if (view === 'history') {
                   // Optional: reloadHistory() if we want to see immediate update, 
                   // but might cause re-render flicker. Often better to just let it update next time.
               }
          });
      }
    } else {
      // Only report error if we are still on the same song
      if (String(currentSongIdRef.current) === String(song.id)) {
          handleAudioError("No URL found");
      }
    }
  };

  const changeQuality = async (q: string) => {
    setShowQualityMenu(false);
    if (quality === q || !currentSong) {
        setQuality(q);
        return;
    }
    setQuality(q);
    const currentTime = audioRef.current?.currentTime || 0;
    restoreTimeRef.current = currentTime;
    
    // Capture current ID to guard async call
    const targetId = currentSong.id;

    // Pass metadata for QQ support
    const result = await fetchSongUrl(
        currentSong.id, 
        currentSong.source, 
        q,
        { name: currentSong.name, artist: currentSong.ar?.[0]?.name }
    );
    
    if (String(currentSongIdRef.current) === String(targetId) && result && result.url) {
        setCurrentSong(prev => prev ? { ...prev, url: result.url } : null);
    }
  };

  const handleDownload = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    // Pass metadata for QQ support
    const result = await fetchSongUrl(
        song.id, 
        song.source, 
        quality,
        { name: song.name, artist: song.ar?.[0]?.name }
    );
    
    if (result && result.url) {
      window.open(result.url, '_blank');
    } else {
      alert("无法获取下载链接");
    }
  };

  const handleSongEnd = () => {
      if (playMode === 'single') {
          if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play();
          }
      } else {
          playNext();
      }
  };

  const playNext = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => String(s.id) === String(currentSong.id));
    let nextIndex = 0;

    if (playMode === 'shuffle') {
        nextIndex = Math.floor(Math.random() * queue.length);
        if (queue.length > 1 && nextIndex === currentIndex) {
            nextIndex = (nextIndex + 1) % queue.length;
        }
    } else {
        if (currentIndex >= 0) {
            nextIndex = (currentIndex + 1) % queue.length;
        }
    }
    playSong(queue[nextIndex]);
  };

  const playPrev = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => String(s.id) === String(currentSong.id));
    let prevIndex = 0;

    if (currentIndex >= 0) {
        prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    }
    playSong(queue[prevIndex]);
  };

  const playAll = (songs: Song[]) => {
    if (songs.length > 0) {
      playSong(songs[0], songs);
    }
  };

  const togglePlayMode = () => {
    if (playMode === 'loop') setPlayMode('single');
    else if (playMode === 'single') setPlayMode('shuffle');
    else setPlayMode('loop');
  };

  const getSourceLabel = (s: string) => {
      switch(s) {
          case 'netease': return '网易';
          case 'qq': return 'QQ';
          case 'kuwo': return '酷我';
          default: return s;
      }
  };

  return (
    <div 
      className={`fixed inset-0 z-40 bg-slate-50 dark:bg-slate-900 flex flex-col pt-16 transition-all duration-300 ease-in-out
        ${activeView === 'music' 
           ? 'opacity-100 translate-y-0 visible pointer-events-auto' 
           : 'opacity-0 translate-y-4 invisible pointer-events-none'
        }
      `}
    >
       
       {/* Main Content Area */}
       <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
           
           {/* Sidebar - Hidden on mobile, visible on md+ */}
           <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col hidden md:flex shrink-0">
               <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                   {/* Library Section */}
                   <div>
                       <div className="px-3 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">我的音乐</div>
                       <div className="space-y-1">
                           <button 
                             onClick={() => { setView('home'); }} 
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${view === 'home' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                           >
                               <LayoutGrid size={18} /> 发现音乐
                           </button>
                           <button 
                             onClick={loadFavorites}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${view === 'favorites' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                           >
                               <Heart size={18} /> 我喜欢的音乐
                           </button>
                           <button 
                             onClick={loadHistory}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${view === 'history' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                           >
                               <Clock size={18} /> 最近播放
                           </button>
                           
                           {/* Random Music Button */}
                           <button 
                             onClick={handleRandomPlay}
                             className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400"
                           >
                               <Sparkles size={18} /> 随机一曲
                           </button>
                       </div>
                   </div>

                   {/* Charts Section - Added back as requested */}
                   <div>
                       <div className="px-3 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">精选榜单</div>
                       <div className="space-y-1">
                           {topLists.slice(0, 5).map(list => (
                               <button 
                                 key={list.id}
                                 onClick={() => handlePlaylistClick(list)}
                                 className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors truncate text-left
                                    ${selectedPlaylist?.id === list.id && view === 'playlist'
                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }
                                 `}
                               >
                                   <Disc size={18} className="shrink-0" /> 
                                   <span className="truncate">{list.name}</span>
                               </button>
                           ))}
                           {topLists.length === 0 && (
                               <div className="px-3 py-2 text-xs text-slate-400">加载中...</div>
                           )}
                       </div>
                   </div>
               </div>
           </div>

           {/* Mobile Tab Navigation - Visible only on Mobile */}
           <div className="md:hidden shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-hide">
               <div className="flex px-4 py-2 gap-3 min-w-max">
                   <button 
                     onClick={handleRandomPlay}
                     className="px-3 py-1.5 rounded-full text-xs font-medium border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center gap-1"
                   >
                       <Sparkles size={12} /> 随机
                   </button>
                   <button 
                     onClick={() => { setView('home'); }} 
                     className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${view === 'home' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}
                   >
                       发现
                   </button>
                   <button 
                     onClick={loadFavorites}
                     className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${view === 'favorites' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}
                   >
                       喜欢
                   </button>
                   <button 
                     onClick={loadHistory}
                     className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${view === 'history' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}
                   >
                       历史
                   </button>
               </div>
           </div>

           {/* Right Content Wrapper - Anchors overlays and manages scroll */}
           <div className="flex-1 flex flex-col relative min-w-0 bg-slate-50 dark:bg-slate-900 overflow-hidden">
               
               {/* Ambient Background Blur - Static */}
               {currentSong && (
                   <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                       <div className="absolute -top-[20%] -right-[20%] w-[80%] h-[80%] opacity-5 dark:opacity-10 blur-[120px] rounded-full" style={{ backgroundColor: view === 'home' ? '#ef4444' : 'currentColor', color: 'inherit' }}></div>
                   </div>
               )}

               {/* Lyrics Overlay - Full Cover, Non-scrolling */}
               {showLyrics && currentSong && (
                   <div className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl flex flex-col md:flex-row items-center justify-center p-8 gap-8 md:gap-16 animate-in fade-in slide-in-from-bottom-4 duration-300">
                       <button 
                           onClick={() => setShowLyrics(false)}
                           className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors z-50"
                       >
                           <ChevronDown size={24} />
                       </button>
                       
                       {/* Cover Art */}
                       <div className="w-64 h-64 md:w-96 md:h-96 shrink-0 rounded-2xl shadow-2xl overflow-hidden relative group hidden md:block">
                           <img src={currentSong.al.picUrl} className="w-full h-full object-cover" />
                       </div>

                       {/* Lyrics Scroll Area */}
                       <div className="flex-1 h-full max-h-[60vh] w-full max-w-xl relative" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }}> 
                          {lyrics.length > 0 ? (
                              <div 
                                ref={lyricsContainerRef}
                                className="h-full overflow-y-auto no-scrollbar text-center space-y-6 py-[50%]"
                                style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                              >
                                  {lyrics.map((line, i) => (
                                      <p 
                                        key={i}
                                        className={`transition-all duration-300 cursor-pointer px-4
                                           ${i === activeLyricIndex 
                                              ? 'text-xl md:text-2xl font-bold text-slate-800 dark:text-white scale-105' 
                                              : 'text-sm md:text-base font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                           }
                                        `}
                                        onClick={() => {
                                            if(audioRef.current) audioRef.current.currentTime = line.time;
                                        }}
                                      >
                                          {line.text}
                                      </p>
                                  ))}
                              </div>
                          ) : (
                              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                                  <Mic2 size={48} className="opacity-20" />
                                  <p className="text-lg font-medium">歌词加载中...</p>
                                  <p className="text-sm opacity-60">纯音乐或暂无歌词</p>
                              </div>
                          )}
                       </div>
                   </div>
               )}

               {/* Scrollable Content Container */}
               <div className="flex-1 overflow-y-auto relative z-10 scroll-smooth">
                   
                   {/* Internal Toolbar for Search and Navigation */}
                   <div className="sticky top-0 z-20 px-4 md:px-6 py-4 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800/50 flex items-center gap-4">
                        {view !== 'home' && (
                            <button onClick={() => setView('home')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                               <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                            </button>
                        )}
                        
                        {/* Search Bar with Source Selector */}
                        <form onSubmit={handleSearch} className="flex-1 flex items-center bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-red-500/30 max-w-xl relative">
                            {/* Source Selector Dropdown */}
                            <div className="relative shrink-0">
                                <button 
                                   type="button"
                                   onClick={() => setShowSourceMenu(!showSourceMenu)}
                                   className="flex items-center gap-1 pl-4 pr-3 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-r border-slate-200 dark:border-slate-700 transition-colors"
                                >
                                   {getSourceLabel(searchSource)}
                                   <ChevronDown size={12} className={`transition-transform duration-200 ${showSourceMenu ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {showSourceMenu && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowSourceMenu(false)}></div>
                                        <div className="absolute top-full left-0 mt-2 w-28 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 z-20">
                                            {['netease', 'qq', 'kuwo'].map((s) => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchSource(s as any);
                                                        setShowSourceMenu(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-700
                                                       ${searchSource === s ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-600 dark:text-slate-300'}
                                                    `}
                                                >
                                                    {getSourceLabel(s)}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Search Input */}
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`搜索${getSourceLabel(searchSource)}...`}
                                className="flex-1 bg-transparent border-none focus:ring-0 py-2.5 px-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 w-full"
                            />
                            <button type="submit" className="pr-4 pl-2 text-slate-400 hover:text-red-500 transition-colors">
                                <Search size={18} />
                            </button>
                        </form>
                   </div>

                   <div className={`relative min-h-full pb-36 ${view === 'home' ? 'p-6' : 'p-0'}`}>
                       {loading ? (
                           <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                               <Loader2 className="animate-spin text-red-500" size={32} />
                               <p className="text-sm">加载精彩内容...</p>
                           </div>
                       ) : (
                           <>
                               {(view === 'history' || view === 'search' || view === 'favorites' || view === 'playlist') && (
                                   <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                       {/* Header - Transparent/Modern Style */}
                                       <div className="px-6 md:px-10 py-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-800/20 backdrop-blur-sm">
                                            <div className="flex items-center gap-6">
                                                {/* Album Art / Icon */}
                                                {view === 'playlist' && selectedPlaylist ? (
                                                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden shadow-lg shrink-0">
                                                        <img src={selectedPlaylist.coverImgUrl} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className={`w-24 h-24 md:w-32 md:h-32 rounded-xl flex items-center justify-center shadow-lg shrink-0
                                                        ${view === 'history' ? 'bg-blue-500 text-white' : view === 'favorites' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}
                                                    `}>
                                                        {view === 'history' ? <Clock size={40} /> : view === 'favorites' ? <Heart size={40} /> : <Search size={40} />}
                                                    </div>
                                                )}
                                                
                                                <div className="flex flex-col gap-2">
                                                    <h2 className="text-2xl md:text-4xl font-extrabold text-slate-800 dark:text-slate-100 line-clamp-2">
                                                        {view === 'history' ? '播放历史' : view === 'favorites' ? '我喜欢的音乐' : view === 'search' ? `搜索: "${searchQuery}"` : view === 'playlist' && selectedPlaylist ? selectedPlaylist.name : ''}
                                                    </h2>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-3">
                                                        <span>{(view === 'search' ? searchResults : playlistSongs).length} 首歌曲</span>
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-3 w-full md:w-auto">
                                                <button 
                                                  onClick={() => playAll(view === 'search' ? searchResults : playlistSongs)}
                                                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full text-base font-bold shadow-lg shadow-red-500/30 transition-all hover:scale-105 active:scale-95"
                                                >
                                                    <Play size={20} fill="currentColor" /> 播放全部
                                                </button>
                                            </div>
                                       </div>

                                       {/* List Header - Sticky */}
                                       <div className="sticky top-[72px] z-10 grid grid-cols-[50px_1fr_40px] md:grid-cols-[60px_4fr_3fr_80px] gap-4 px-6 md:px-10 py-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider shadow-sm">
                                           <div className="text-center">#</div>
                                           <div>标题</div>
                                           <div className="hidden md:block">专辑</div>
                                           <div className="text-right hidden md:block">操作</div>
                                           <div className="md:hidden text-right"></div>
                                       </div>

                                       <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                           {(view === 'search' ? searchResults : playlistSongs).map((song, i) => (
                                               <div 
                                                 key={`${song.source}-${song.id}`}
                                                 onClick={() => playSong(song, view === 'search' ? searchResults : playlistSongs)}
                                                 className={`group grid grid-cols-[50px_1fr_40px] md:grid-cols-[60px_4fr_3fr_80px] gap-4 px-6 md:px-10 py-3.5 items-center transition-all cursor-pointer
                                                    ${String(currentSong?.id) === String(song.id) 
                                                        ? 'bg-red-50/50 dark:bg-red-900/10' 
                                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                                    }
                                                 `}
                                               >
                                                   <div className="text-center text-sm font-medium text-slate-400 flex justify-center">
                                                      {String(currentSong?.id) === String(song.id) && isPlaying ? (
                                                          <div className="flex gap-0.5 items-end h-3">
                                                              <div className="w-1 bg-red-500 animate-music-wave-1 rounded-sm"></div>
                                                              <div className="w-1 bg-red-500 animate-music-wave-2 rounded-sm"></div>
                                                              <div className="w-1 bg-red-500 animate-music-wave-3 rounded-sm"></div>
                                                          </div>
                                                      ) : (
                                                          <span className="md:group-hover:hidden">{i + 1}</span>
                                                      )}
                                                      <Play size={14} className="hidden md:group-hover:block text-slate-600 dark:text-slate-300" fill="currentColor" />
                                                   </div>
                                                   <div className="min-w-0 pr-0 md:pr-4 flex items-center gap-4">
                                                       {/* Song Cover */}
                                                       <div className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-700">
                                                            <img src={song.al.picUrl} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                                                       </div>
                                                       <div className="min-w-0 flex-1">
                                                           <div className={`font-medium truncate text-sm mb-0.5 ${String(currentSong?.id) === String(song.id) ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{song.name}</div>
                                                           <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2">
                                                               {song.source === 'qq' && <span className="text-[9px] px-1 rounded border border-slate-200 dark:border-slate-600 text-slate-400">QQ</span>}
                                                               {song.source === 'netease' && <span className="text-[9px] px-1 rounded border border-slate-200 dark:border-slate-600 text-slate-400">WY</span>}
                                                               {song.source === 'kuwo' && <span className="text-[9px] px-1 rounded border border-slate-200 dark:border-slate-600 text-slate-400">KW</span>}
                                                               {song.ar.map(a => a.name).join(', ')}
                                                           </div>
                                                       </div>
                                                   </div>
                                                   <div className="text-xs text-slate-500 dark:text-slate-400 truncate hidden md:block">{song.al.name}</div>
                                                   <div className="text-right hidden md:block">
                                                       <button 
                                                         onClick={(e) => handleDownload(e, song)} 
                                                         className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                         title="下载"
                                                       >
                                                           <Download size={16} />
                                                       </button>
                                                   </div>
                                                   <div className="text-right md:hidden">
                                                       {/* Mobile action could go here if needed, keeping simple for now */}
                                                   </div>
                                               </div>
                                           ))}
                                       </div>
                                       
                                       {/* Search Results Pagination (Load More) */}
                                       {view === 'search' && searchResults.length > 0 && hasMoreResults && (
                                           <div className="p-8 flex justify-center border-t border-slate-100 dark:border-slate-800/50">
                                               <button
                                                  onClick={handleLoadMore}
                                                  disabled={isLoadingMore}
                                                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                               >
                                                  {isLoadingMore ? <Loader2 size={16} className="animate-spin" /> : <ArrowDown size={16} />}
                                                  {isLoadingMore ? '正在加载...' : '加载更多结果'}
                                               </button>
                                           </div>
                                       )}
                                       
                                       {(view === 'search' ? searchResults : playlistSongs).length === 0 && (
                                           <div className="text-center py-20 text-slate-400">
                                               <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                                   <Music size={32} className="opacity-20" />
                                               </div>
                                               <p>暂无内容</p>
                                           </div>
                                       )}
                                   </div>
                               )}

                               {view === 'home' && (
                                   <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                       <div className="mb-6 flex items-center justify-between">
                                           <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                              <ListMusic size={24} className="text-red-500" />
                                              精选榜单
                                           </h3>
                                       </div>
                                       
                                       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                           {topLists.map(list => (
                                               <div 
                                                 key={list.id}
                                                 onClick={() => handlePlaylistClick(list)}
                                                 className="group cursor-pointer"
                                               >
                                                   <div className="aspect-square rounded-xl overflow-hidden shadow-sm relative bg-slate-200 dark:bg-slate-800 mb-2">
                                                       <img src={list.coverImgUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                                                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                           <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all shadow-lg">
                                                               <Play size={20} fill="currentColor" className="ml-1" />
                                                           </div>
                                                       </div>
                                                       <div className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white font-bold backdrop-blur-sm uppercase">
                                                           {list.source}
                                                       </div>
                                                   </div>
                                                   <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm line-clamp-2 leading-tight group-hover:text-red-500 transition-colors">
                                                       {list.name}
                                                   </h4>
                                               </div>
                                           ))}
                                       </div>
                                   </div>
                               )}
                           </>
                       )}
                   </div>
               </div>
           </div>
       </div>

       {/* Bottom Player Bar - Glassmorphism */}
       <div className="shrink-0 h-20 md:h-24 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex items-center px-4 md:px-8 gap-4 md:gap-6 z-50 relative shadow-[0_-5px_30px_-5px_rgba(0,0,0,0.1)]">
           
           {/* Progress Bar (Absolute Top) */}
           <div 
             className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 cursor-pointer group"
             onClick={(e) => {
               if (audioRef.current && duration) {
                   const rect = e.currentTarget.getBoundingClientRect();
                   const p = (e.clientX - rect.left) / rect.width;
                   audioRef.current.currentTime = p * duration;
               }
             }}
           >
              <div 
                className="h-full bg-red-500 relative transition-all duration-100 ease-linear"
                style={{ width: `${(progress / duration) * 100}%` }}
              >
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity transform scale-150"></div>
              </div>
           </div>

           {/* Song Info */}
           <div className="flex-1 md:w-1/3 flex items-center gap-3 md:gap-4 overflow-hidden">
               {currentSong ? (
                   <>
                       <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-lg shadow-md overflow-hidden shrink-0">
                           <img src={currentSong.al.picUrl} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                           <div className="absolute inset-0 bg-black/10 ring-1 ring-inset ring-white/10"></div>
                       </div>
                       <div className="min-w-0 flex flex-col justify-center overflow-hidden">
                           <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm md:text-base mb-0.5">{currentSong.name}</div>
                           <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{currentSong.ar.map(a => a.name).join(', ')}</div>
                       </div>
                       <button 
                         onClick={handleLikeToggle}
                         className={`ml-1 md:ml-2 shrink-0 transition-all active:scale-90 ${isLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-500'} hidden sm:block`}
                       >
                           <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                       </button>
                   </>
               ) : (
                   <div className="flex items-center gap-3 opacity-50">
                       <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                           <Music size={24} className="text-slate-400" />
                       </div>
                       <span className="text-sm font-medium text-slate-400">准备播放</span>
                   </div>
               )}
           </div>

           {/* Controls */}
           <div className="flex-none md:flex-1 flex flex-col items-end md:items-center justify-center max-w-lg">
               <div className="flex items-center gap-4 md:gap-8">
                   <button onClick={togglePlayMode} className={`hidden md:block p-2 rounded-full transition-colors ${playMode !== 'loop' ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                       {playMode === 'single' ? <Repeat1 size={18} /> : playMode === 'shuffle' ? <Shuffle size={18} /> : <Repeat size={18} />}
                   </button>
                   
                   <button onClick={playPrev} className="hidden md:block text-slate-700 dark:text-slate-200 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                       <SkipBack size={28} fill="currentColor" />
                   </button>
                   
                   <button 
                     onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} 
                     className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-red-600 text-white rounded-full hover:bg-red-50 shadow-lg shadow-red-500/40 transition-all hover:scale-105 active:scale-95"
                   >
                       {isPlaying ? (
                           <Pause className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" />
                       ) : (
                           <Play className="w-5 h-5 md:w-6 md:h-6 ml-1" fill="currentColor" />
                       )}
                   </button>
                   
                   <button onClick={playNext} className="text-slate-700 dark:text-slate-200 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                       <SkipForward className="w-6 h-6 md:w-7 md:h-7" fill="currentColor" />
                   </button>

                   <div className="relative hidden md:block">
                       <button 
                         onClick={() => setShowQualityMenu(!showQualityMenu)} 
                         className={`text-xs font-bold border rounded px-1.5 py-0.5 transition-colors ${quality === 'flac' || quality === 'flac24bit' ? 'text-red-500 border-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 border-slate-300 dark:border-slate-600 hover:text-slate-600'}`}
                       >
                           {quality === '320k' ? 'HQ' : (quality === '128k' ? 'SD' : 'SQ')}
                       </button>
                       {showQualityMenu && (
                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 py-1">
                               {['128k', '320k', 'flac'].map(q => (
                                   <button key={q} onClick={() => changeQuality(q)} className={`block w-full px-3 py-2 text-xs text-center hover:bg-slate-50 dark:hover:bg-slate-700 ${quality === q ? 'text-red-500 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                                       {q.toUpperCase()}
                                   </button>
                               ))}
                           </div>
                       )}
                   </div>
               </div>
               <div className="hidden md:block text-xs text-slate-400 font-mono mt-1 tracking-wider">
                   {Math.floor(progress / 60)}:{String(Math.floor(progress % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
               </div>
           </div>

           {/* Volume & Lyrics - Hidden on small mobile */}
           <div className="hidden md:flex w-1/3 items-center justify-end gap-3 group/vol">
               <button onClick={() => setVolume(v => v === 0 ? 0.8 : 0)}>
                  <Volume2 size={20} className={`transition-colors ${volume === 0 ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`} />
               </button>
               <div className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-full relative cursor-pointer overflow-hidden">
                   <div className="absolute inset-y-0 left-0 bg-slate-500 dark:bg-slate-400 rounded-full transition-all group-hover/vol:bg-red-500" style={{ width: `${volume * 100}%` }}></div>
                   <input 
                     type="range" 
                     min="0" max="1" step="0.05" 
                     value={volume} 
                     onChange={(e) => setVolume(parseFloat(e.target.value))}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   />
               </div>
              <button 
                onClick={() => setShowLyrics(!showLyrics)} 
                className={`ml-2 p-2 transition-colors ${showLyrics ? 'text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full' : 'text-slate-400 hover:text-red-500'}`}
              >
                 <Mic2 size={18} />
              </button>
           </div>

           {/* Mobile Lyrics Toggle */}
           <button 
             onClick={() => setShowLyrics(!showLyrics)} 
             className={`md:hidden p-2 transition-colors ${showLyrics ? 'text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full' : 'text-slate-400'}`}
           >
              <Mic2 size={20} />
           </button>
       </div>

       {toastMessage && (
           <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur text-white px-6 py-3 rounded-full text-sm shadow-xl animate-in fade-in slide-in-from-top-4 z-[100] flex items-center gap-2 w-max max-w-[90vw] truncate">
               <Music size={16} className="animate-spin shrink-0" />
               <span className="truncate">{toastMessage}</span>
           </div>
       )}

       <audio 
         ref={audioRef}
         src={currentSong?.url}
         onPlay={() => setIsPlaying(true)}
         onPause={() => setIsPlaying(false)}
         onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
         onDurationChange={(e) => setDuration(e.currentTarget.duration)}
         onEnded={handleSongEnd}
         onError={() => handleAudioError("Playback Error")}
         onLoadedMetadata={() => {
             if (restoreTimeRef.current > 0 && audioRef.current) {
                 audioRef.current.currentTime = restoreTimeRef.current;
                 restoreTimeRef.current = 0;
             }
             if (isPlaying) audioRef.current?.play();
         }}
       />
    </div>
  );
};

export default MusicPlatform;
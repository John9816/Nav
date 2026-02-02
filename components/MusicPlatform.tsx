import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Search, Disc, Clock, Music, Headphones, ListMusic, RefreshCw, 
  ChevronDown, X, Repeat, Repeat1, Shuffle, Trash2, Download,
  ArrowLeft, Maximize2, Minimize, Heart, HeartOff, ChevronLeft, ChevronRight,
  History, Maximize, ImageOff, Loader2
} from 'lucide-react';
import { Playlist, Song, LyricLine } from '../types';
import { 
  fetchTopLists, fetchPlaylistDetails, fetchSongUrl, searchSongs, 
  fetchLyrics, fetchLikedSongs, likeSong, unlikeSong,
  fetchMusicHistory, addToHistory, clearMusicHistory, fetchSongDetail,
  checkGuestLimit
} from '../services/musicService';
import { useAuth } from '../contexts/AuthContext';

interface MusicPlatformProps {
  activeView: 'dashboard' | 'studio' | 'music' | 'bookmarks';
  onViewChange: (view: 'dashboard' | 'studio' | 'music' | 'bookmarks') => void;
  requestedTab?: 'favorites' | 'history' | null;
  onTabChangeHandled?: () => void;
  onAuthRequest?: () => void;
}

type PlayMode = 'loop' | 'single' | 'shuffle';

const QUALITY_OPTIONS = [
  { label: '标准', value: '128k', desc: '128k' },
  { label: '高品', value: '320k', desc: '320k' },
  { label: '无损', value: 'flac', desc: 'FLAC' },
  { label: 'Hi-Res', value: 'flac24bit', desc: 'Hi-Res' },
];

const GUEST_PLAY_LIMIT = 5;

const MusicPlatform: React.FC<MusicPlatformProps> = ({ activeView, onViewChange, requestedTab, onTabChangeHandled, onAuthRequest }) => {
  const { user } = useAuth();
  const isFullView = activeView === 'music';

  // Navigation State
  const [view, setView] = useState<'home' | 'playlist' | 'search' | 'favorites' | 'history'>('home');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [historySongs, setHistorySongs] = useState<Song[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(new Set());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(false);

  // Player State
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]); // Persistent playback queue
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>('loop');
  const [showQueue, setShowQueue] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Quality State
  const [quality, setQuality] = useState('320k');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const restoreTimeRef = useRef(0);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [errorCount, setErrorCount] = useState(0);

  // Lyric State
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricScrollRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Top Lists on Mount
  const loadTopLists = async () => {
    setLoading(true);
    const lists = await fetchTopLists();
    setPlaylists(lists);
    setLoading(false);
  };

  useEffect(() => {
    loadTopLists();
  }, []);

  // Handle Toast Timeout
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Handle external tab requests (e.g. from User Menu)
  useEffect(() => {
    if (requestedTab) {
      if (requestedTab === 'favorites') {
          setView('favorites');
          if (user) loadLikes();
      } else if (requestedTab === 'history') {
          setView('history');
          if (user) loadHistory();
      }

      if (onTabChangeHandled) {
        onTabChangeHandled();
      }
    }
  }, [requestedTab, user, onTabChangeHandled]);

  // Load Liked Songs when user logs in
  useEffect(() => {
    if (user) {
      loadLikes();
      loadHistory();
    } else {
      setLikedSongs([]);
      setLikedSongIds(new Set());
      setHistorySongs([]);
    }
  }, [user]);

  // Handle Fullscreen Change Events
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => console.error(e));
        setIsFullscreen(true);
        // Automatically show the visualizer/lyrics view if not already open
        if (!showLyrics) setShowLyrics(true);
    } else {
        document.exitFullscreen().catch(e => console.error(e));
        setIsFullscreen(false);
    }
  };

  const loadLikes = async () => {
    if (!user) return;
    const likes = await fetchLikedSongs(user.id);
    setLikedSongs(likes);
    setLikedSongIds(new Set(likes.map(s => String(s.id))));
  };

  const loadHistory = async () => {
    if (!user) return;
    const history = await fetchMusicHistory(user.id);
    setHistorySongs(history);
  };

  // Close queue/quality menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (queueRef.current && !queueRef.current.contains(event.target as Node) && showQueue) {
        const target = event.target as HTMLElement;
        if (!target.closest('#queue-toggle-btn')) {
            setShowQueue(false);
        }
      }
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(event.target as Node) && showQualityMenu) {
         const target = event.target as HTMLElement;
         if (!target.closest('#quality-toggle-btn')) {
             setShowQualityMenu(false);
         }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQueue, showQualityMenu]);

  // Audio Logic
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      // We rely on declarative src in <audio>, but play/pause needs imperative call
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn("Autoplay prevented or failed");
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, volume, currentSong]); 

  // Sync Lyrics with Time
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      setProgress(currentTime);
      
      if (!isNaN(audioRef.current.duration) && audioRef.current.duration !== Infinity) {
        setDuration(audioRef.current.duration);
      }

      // Find active lyric line
      if (lyrics.length > 0) {
        let activeIdx = -1;
        for (let i = 0; i < lyrics.length; i++) {
          if (lyrics[i].time > currentTime) {
            break;
          }
          activeIdx = i;
        }
        
        if (activeIdx !== currentLyricIndex) {
            setCurrentLyricIndex(activeIdx);
            if (showLyrics && activeIdx !== -1 && isFullView) { // Only scroll if full player is open
                const element = document.getElementById(`lyric-line-${activeIdx}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
      }
    }
  };

  const handleSongEnd = () => {
    setErrorCount(0); 
    
    if (playMode === 'single') {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        }
    } else {
        playNext();
    }
  };

  const handleAudioError = (e: any) => {
    let errorMessage = "Unknown error";
    if (typeof e === 'string') {
        errorMessage = e;
    } else if (e && e.currentTarget && e.currentTarget.error) {
        const err = e.currentTarget.error;
        errorMessage = `Code: ${err.code}, Message: ${err.message}`;
    }
    
    console.warn("Audio playback error:", errorMessage);

    if (currentSong && !currentSong.url) return;

    if (errorCount < 3) {
      setErrorCount(prev => prev + 1);
      setTimeout(() => {
        playNext();
      }, 1000);
    } else {
      setIsPlaying(false);
      setErrorCount(0);
      alert("连续多首歌曲播放失败，请检查网络或稍后再试。");
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
      if (restoreTimeRef.current > 0) {
          e.currentTarget.currentTime = restoreTimeRef.current;
          restoreTimeRef.current = 0;
      }
      setDuration(e.currentTarget.duration);
  };

  // Favorites Logic
  const toggleLike = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    if (!user) {
      alert("请先登录后收藏");
      return;
    }

    const songIdStr = String(song.id);
    const isLiked = likedSongIds.has(songIdStr);

    try {
      if (isLiked) {
        await unlikeSong(user.id, songIdStr);
        setLikedSongIds(prev => {
          const next = new Set(prev);
          next.delete(songIdStr);
          return next;
        });
        setLikedSongs(prev => prev.filter(s => String(s.id) !== songIdStr));
      } else {
        await likeSong(user.id, song);
        setLikedSongIds(prev => new Set(prev).add(songIdStr));
        setLikedSongs(prev => [song, ...prev]);
      }
    } catch (err) {
      console.error("Failed to toggle like", err);
      alert("操作失败，请重试");
    }
  };

  const handleClearHistory = async () => {
    if (!user) return;
    if (confirm("确定要清空所有播放记录吗？")) {
        try {
            await clearMusicHistory(user.id);
            setHistorySongs([]);
        } catch (e) {
            console.error(e);
            alert("清空失败");
        }
    }
  };

  // Player Controls
  const playSong = async (song: Song, newQueue?: Song[]) => {
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

    // --- Guest Limit Check (Server Side) ---
    if (!user) {
        setCheckingLimit(true);
        // Show immediate feedback via toast while checking
        setToastMessage("正在验证试听权限...");
        
        try {
            const { allowed, count } = await checkGuestLimit();
            setCheckingLimit(false);

            if (!allowed) {
               setToastMessage(null); // Clear loading toast
               if (confirm(`试听次数已用完（${GUEST_PLAY_LIMIT}首）。\n\n您的 IP 访问已达今日上限。\n登录账号即可解锁无限畅听。\n\n是否立即登录？`)) {
                   if (onAuthRequest) onAuthRequest();
               }
               return;
            }

            setToastMessage(`试听模式：${count} / ${GUEST_PLAY_LIMIT} 首`);
        } catch (e) {
            console.error("Guest check failed", e);
            setCheckingLimit(false);
            // Fallback: allow play if server check errors
        }
    }

    setIsPlaying(false); 
    setErrorCount(0);
    setProgress(0);
    setLyrics([]);
    setCurrentLyricIndex(-1);
    restoreTimeRef.current = 0; 
    
    // Set basic song info immediately
    setCurrentSong(song);

    // Fetch full song details (better cover art, album name) asynchronously
    // SAFE MERGE IMPLEMENTATION
    fetchSongDetail(song.id).then(detail => {
        if (detail) {
            setCurrentSong(prev => {
                // Ensure we are still updating the same song
                if (!prev || String(prev.id) !== String(song.id)) return prev;
                
                // Smart Merge Logic:
                // Only overwrite name/artist/album if the new one is present and looks valid.
                // Critical for Cover Art: 'detail.al.picUrl' might be missing in some detail APIs, 
                // so we fallback to 'prev.al.picUrl' (the one from the list/search).
                
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
                    // Preserve URL if already set, otherwise take from detail (unlikely)
                    url: prev.url || detail.url 
                };
            });
        }
    });

    // Record History
    if (user) {
        addToHistory(user.id, song).then(() => {
             // Reload history if currently viewing it to update the top item
             if (view === 'history') {
                 loadHistory();
             }
        });
    }

    fetchLyrics(song.id, song.source).then(lines => {
        setLyrics(lines);
    });

    let url = song.url;
    // Always fetch fresh URL to avoid expiration or getting higher quality
    const fetchedUrl = await fetchSongUrl(song.id, song.source, quality);
    if (fetchedUrl) url = fetchedUrl;

    if (url) {
      setCurrentSong(prev => (prev && prev.id === song.id ? { ...prev, url } : prev));
      setIsPlaying(true);
    } else {
      handleAudioError("No URL found");
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
    const url = await fetchSongUrl(currentSong.id, currentSong.source, q);
    if (url) {
        setCurrentSong(prev => prev ? { ...prev, url } : null);
    }
  };

  const handleDownload = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    const url = await fetchSongUrl(song.id, song.source, quality);
    if (url) {
      window.open(url, '_blank');
    } else {
      alert("无法获取下载链接");
    }
  };

  const playNext = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
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
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
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

  // View Controls
  const openPlaylist = async (list: Playlist) => {
    setSelectedPlaylist(list);
    setView('playlist');
    setLoading(true);
    setPlaylistSongs([]); // Clear previous songs to avoid stale state flicker
    
    // Explicitly requesting without page parameters to load all
    const songs = await fetchPlaylistDetails(list.id);
    setPlaylistSongs(songs);
    setLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setView('search');
    setLoading(true);
    setSearchPage(1); // Reset page to 1
    const songs = await searchSongs(searchQuery, 1);
    setSearchResults(songs);
    setLoading(false);
  };

  const changeSearchPage = async (delta: number) => {
      const newPage = searchPage + delta;
      if (newPage < 1) return;
      
      setLoading(true);
      
      // Scroll to top of table
      const container = document.querySelector('.custom-scrollbar');
      if (container) container.scrollTop = 0;

      const songs = await searchSongs(searchQuery, newPage);
      
      if (songs.length === 0 && delta > 0) {
          alert("没有更多结果了");
          setLoading(false);
          return;
      }
      
      setSearchResults(songs);
      setSearchPage(newPage);
      setLoading(false);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds === Infinity) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getQualityLabel = (val: string) => {
      const opt = QUALITY_OPTIONS.find(o => o.value === val);
      return opt ? opt.label : '高品';
  };

  // Determine current list to display
  const getCurrentDisplaySongs = () => {
    if (view === 'favorites') return likedSongs;
    if (view === 'search') return searchResults;
    if (view === 'playlist') return playlistSongs;
    if (view === 'history') return historySongs;
    return [];
  };

  const getDisplayIndex = (index: number) => {
    if (view === 'search') return (searchPage - 1) * 10 + index + 1;
    return index + 1;
  };

  return (
    <>
      <audio 
        ref={audioRef} 
        src={currentSong?.url}
        onTimeUpdate={handleTimeUpdate} 
        onEnded={handleSongEnd}
        onError={handleAudioError}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-black/80 text-white px-6 py-2.5 rounded-full text-sm font-medium backdrop-blur-md shadow-xl animate-in fade-in zoom-in-95 duration-200 border border-white/10 pointer-events-none flex items-center gap-2">
          {checkingLimit && <Loader2 size={14} className="animate-spin" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Music View (Lists etc) - Top 16 constrained */}
      <div 
        className={`fixed inset-0 top-16 z-40 transition-transform duration-300 flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans
          ${isFullView ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}
        `}
      >
        <main className="flex-1 overflow-hidden flex flex-col relative">
          
          {/* Integrated Toolbar */}
          <div className="shrink-0 px-4 py-3 flex items-center gap-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 border-b border-slate-200/50 dark:border-slate-800/50 transition-colors">
             {view !== 'home' && (
               <button 
                  onClick={() => setView('home')}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                  title="返回榜单"
               >
                 <ArrowLeft size={20} />
               </button>
             )}
             
             <div className="flex-1 relative">
               <form onSubmit={handleSearch} className="relative group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索歌曲..."
                    className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-red-500/50 text-sm transition-all shadow-sm group-hover:shadow-md"
                  />
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               </form>
             </div>

             <button 
               onClick={() => {
                   if (user) {
                       loadHistory();
                       setView('history');
                   } else {
                       alert('请登录后查看播放历史');
                   }
               }}
               className={`p-2 rounded-full transition-colors hidden sm:flex
                 ${view === 'history' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}
               `}
               title="最近播放"
             >
                <History size={20} />
             </button>

              <a 
                href="https://2007.filemail.com/api/file/get?filekey=1MoGHqUvfE79Rh4yhJCKIyoBQy6fcAIKCATlrOp88-Z0tgkLhzSYMK5ty0lhvJ_GMA&pk_vid=66d222e84d5b8d2517657284468cdc35" 
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-full transition-colors"
                title="下载客户端"
              >
                <Download size={14} />
                <span>APP</span>
              </a>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar pb-32">
            {loading ? (
              <div className="flex items-center justify-center h-64 space-x-2 text-slate-400">
                <span className="animate-spin"><Disc size={24} /></span>
                <span>Loading...</span>
              </div>
            ) : (
              <>
                {/* Home View */}
                {view === 'home' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-lg font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <ListMusic className="text-red-500" size={20}/> 官方榜单
                      </h2>
                      <div className="flex gap-2">
                        {/* Mobile History Button */}
                        <button 
                            onClick={() => {
                                if (user) {
                                    loadHistory();
                                    setView('history');
                                } else {
                                    alert('请登录后查看播放历史');
                                }
                            }}
                            className="p-1.5 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all sm:hidden"
                            title="播放历史"
                        >
                            <History size={16} />
                        </button>

                        <button 
                            onClick={loadTopLists} 
                            className="p-1.5 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                            title="刷新"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    </div>

                    {playlists.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <Music size={48} className="mb-4 opacity-50" />
                        <p>暂时无法获取榜单数据</p>
                        <button 
                          onClick={loadTopLists}
                          className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-sm hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          重试
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                        {playlists.map(list => (
                          <div 
                            key={list.id}
                            onClick={() => openPlaylist(list)}
                            className="group cursor-pointer space-y-3"
                          >
                            <div className="aspect-square rounded-2xl overflow-hidden relative shadow-md bg-slate-200 dark:bg-slate-800">
                              <img src={list.coverImgUrl} alt={list.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center text-red-500 shadow-xl transform scale-50 group-hover:scale-100 transition-transform">
                                  <Play fill="currentColor" size={20} className="ml-1" />
                                </div>
                              </div>
                            </div>
                            <div>
                              <h3 className="font-medium text-sm line-clamp-2 leading-tight group-hover:text-red-500 transition-colors">{list.name}</h3>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Playlist / Search / Favorites / History View */}
                {(view === 'playlist' || view === 'search' || view === 'favorites' || view === 'history') && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    
                    {view === 'favorites' && (
                        <div className="flex flex-col md:flex-row gap-6 mb-8 items-center md:items-start">
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg text-white">
                                <Heart size={48} fill="currentColor" />
                            </div>
                            <div className="space-y-3 flex-1 text-center md:text-left">
                                <span className="text-xs font-bold text-red-500 border border-red-500/30 px-2 py-0.5 rounded">个人收藏</span>
                                <h2 className="text-2xl md:text-3xl font-bold">我喜欢的音乐</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    共 {likedSongs.length} 首歌曲
                                </p>
                                <div className="flex gap-3 pt-2 justify-center md:justify-start">
                                    <button 
                                        onClick={() => playAll(likedSongs)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-full font-medium flex items-center gap-2 transition-colors active:scale-95 shadow-lg shadow-red-500/20"
                                        disabled={likedSongs.length === 0}
                                    >
                                        <Play fill="currentColor" size={16} /> 播放全部
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'history' && (
                        <div className="flex flex-col md:flex-row gap-6 mb-8 items-center md:items-start">
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg text-white">
                                <History size={48} />
                            </div>
                            <div className="space-y-3 flex-1 text-center md:text-left">
                                <span className="text-xs font-bold text-blue-500 border border-blue-500/30 px-2 py-0.5 rounded">最近播放</span>
                                <h2 className="text-2xl md:text-3xl font-bold">播放历史</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    最近播放的 {historySongs.length} 首歌曲
                                </p>
                                <div className="flex gap-3 pt-2 justify-center md:justify-start">
                                    <button 
                                        onClick={() => playAll(historySongs)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full font-medium flex items-center gap-2 transition-colors active:scale-95 shadow-lg shadow-blue-500/20"
                                        disabled={historySongs.length === 0}
                                    >
                                        <Play fill="currentColor" size={16} /> 播放全部
                                    </button>
                                    <button 
                                        onClick={handleClearHistory}
                                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-5 py-2 rounded-full font-medium flex items-center gap-2 transition-colors active:scale-95"
                                        disabled={historySongs.length === 0}
                                    >
                                        <Trash2 size={16} /> 清空
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'playlist' && selectedPlaylist && (
                      <div className="flex flex-col md:flex-row gap-6 mb-8 items-start">
                          <img 
                            src={selectedPlaylist.coverImgUrl} 
                            alt="Cover" 
                            className="w-32 h-32 md:w-48 md:h-48 rounded-2xl shadow-lg object-cover" 
                          />
                          <div className="space-y-3 flex-1">
                            <span className="text-xs font-bold text-red-500 border border-red-500/30 px-2 py-0.5 rounded">歌单</span>
                            <h2 className="text-2xl md:text-3xl font-bold">{selectedPlaylist.name}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 max-w-xl">
                              {selectedPlaylist.description || '网易云音乐热门榜单'}
                            </p>
                            <div className="flex gap-3 pt-2">
                              <button 
                                onClick={() => playAll(playlistSongs)}
                                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-full font-medium flex items-center gap-2 transition-colors active:scale-95 shadow-lg shadow-red-500/20"
                              >
                                <Play fill="currentColor" size={16} /> 播放全部
                              </button>
                            </div>
                          </div>
                      </div>
                    )}
                    
                    {view === 'search' && (
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-lg font-bold">"{searchQuery}" 的搜索结果</h2>
                      </div>
                    )}

                    {/* Songs Table */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                              <th className="px-4 py-3 font-medium text-slate-400 w-12 text-center">#</th>
                              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">标题</th>
                              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden sm:table-cell">歌手</th>
                              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden md:table-cell">专辑</th>
                              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 w-24 text-right"><Clock size={16} className="inline opacity-50" /></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {getCurrentDisplaySongs().map((song, index) => (
                              <tr 
                                key={song.id} 
                                onClick={() => playSong(song, getCurrentDisplaySongs())}
                                className={`group hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors
                                  ${currentSong?.id === song.id ? 'bg-red-50 dark:bg-red-900/10' : ''}
                                `}
                              >
                                <td className="px-4 py-3 text-center text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                                  {currentSong?.id === song.id && isPlaying ? (
                                    <div className="flex items-center justify-center gap-0.5 h-3">
                                      <span className="w-0.5 h-2 bg-red-500 animate-pulse"></span>
                                      <span className="w-0.5 h-3 bg-red-500 animate-pulse animation-delay-200"></span>
                                      <span className="w-0.5 h-1.5 bg-red-500 animate-pulse animation-delay-400"></span>
                                    </div>
                                  ) : (
                                    <span className="group-hover:hidden">{getDisplayIndex(index)}</span>
                                  )}
                                  <span className="hidden group-hover:inline-block text-slate-600 dark:text-slate-300">
                                    {currentSong?.id === song.id && isPlaying ? null : <Play size={14} fill="currentColor" />}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                                  <div className="flex items-center gap-3">
                                      {song.al.picUrl ? (
                                        <img 
                                            src={song.al.picUrl} 
                                            className="w-9 h-9 rounded-md object-cover shadow-sm shrink-0 bg-slate-200 dark:bg-slate-700" 
                                            alt={song.name}
                                            loading="lazy"
                                        />
                                      ) : (
                                        <div className="w-9 h-9 rounded-md bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center text-slate-400">
                                           <Music size={16} />
                                        </div>
                                      )}
                                      <span className="truncate">{song.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{song.ar.map(a => a.name).join(', ')}</td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell truncate max-w-[200px]">{song.al.name}</td>
                                <td className="px-4 py-3 text-right text-slate-400">
                                   <div className="flex items-center justify-end gap-2">
                                        {/* Like Button Row */}
                                        <button
                                            onClick={(e) => toggleLike(e, song)}
                                            className={`p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-all ${likedSongIds.has(String(song.id)) ? 'text-red-500 opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}
                                            title={likedSongIds.has(String(song.id)) ? "取消喜欢" : "喜欢"}
                                        >
                                           <Heart size={14} fill={likedSongIds.has(String(song.id)) ? "currentColor" : "none"} />
                                        </button>

                                        <button
                                            onClick={(e) => handleDownload(e, song)}
                                            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-all"
                                            title="下载"
                                        >
                                            <Download size={14} />
                                        </button>
                                        <span className="min-w-[40px]">
                                            {currentSong?.id === song.id ? formatTime(duration) : formatTime(song.dt / 1000)}
                                        </span>
                                    </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {getCurrentDisplaySongs().length === 0 && (
                          <div className="p-12 text-center text-slate-400">
                             {view === 'favorites' && '暂无收藏歌曲'}
                             {view === 'history' && '暂无播放记录'}
                             {view === 'search' && '暂无搜索结果'}
                             {view === 'playlist' && '暂无歌曲'}
                          </div>
                        )}
                    </div>
                    
                    {/* Pagination Controls for Search View */}
                    {view === 'search' && searchResults.length > 0 && (
                        <div className="flex items-center justify-center gap-4 mt-6 pb-8">
                            <button 
                                onClick={() => changeSearchPage(-1)}
                                disabled={searchPage <= 1 || loading}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors shadow-sm"
                            >
                                <ChevronLeft size={16} /> 上一页
                            </button>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                第 {searchPage} 页
                            </span>
                            <button 
                                onClick={() => changeSearchPage(1)}
                                disabled={loading}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors shadow-sm"
                            >
                                下一页 <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Global Player Bar Components */}
      {currentSong && (
        <>
            {/* Full Screen Lyric Overlay (Moved out to cover top nav) */}
            <div className={`fixed inset-0 z-[100] flex flex-col bg-slate-900/95 text-white transition-all duration-500 ease-in-out transform 
                ${showLyrics && isFullView ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}
            `}>
                <div className="absolute inset-0 z-[-1] overflow-hidden opacity-40 pointer-events-none">
                    {currentSong.al.picUrl ? (
                         <img src={currentSong.al.picUrl} alt="" className="w-full h-full object-cover blur-[80px] scale-125" />
                    ) : (
                         <div className="w-full h-full bg-gradient-to-br from-slate-800 to-black"></div>
                    )}
                    <div className="absolute inset-0 bg-black/40"></div>
                </div>

                <div className="h-16 md:h-20 shrink-0 flex items-center justify-between px-6 md:px-10 mt-safe pt-4 md:pt-0">
                    <button 
                        onClick={() => {
                           if (isFullscreen) {
                               toggleFullscreen(); // Use toggleFullscreen to exit FS if active
                           } else {
                               setShowLyrics(false);
                           }
                        }} 
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <ChevronDown size={28} />
                    </button>
                    <div className="text-center">
                      <h2 className="text-lg font-bold truncate max-w-[200px] md:max-w-md">{currentSong.name}</h2>
                      <p className="text-sm text-white/60">{currentSong.ar.map(a => a.name).join(', ')}</p>
                    </div>
                    
                    {/* Heart in Lyric View */}
                    <button 
                        onClick={(e) => toggleLike(e, currentSong)}
                        className={`p-2 rounded-full transition-colors ${likedSongIds.has(String(currentSong.id)) ? 'text-red-500' : 'text-white/60 hover:text-white'}`}
                    >
                        <Heart size={24} fill={likedSongIds.has(String(currentSong.id)) ? "currentColor" : "none"} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row items-center justify-center p-6 md:p-12 gap-8 md:gap-16 pb-32">
                    <div className="hidden md:flex shrink-0 w-[30vh] h-[30vh] md:w-[50vh] md:h-[50vh] max-w-[500px] max-h-[500px] items-center justify-center">
                        <div className={`relative w-full h-full rounded-full overflow-hidden border-[8px] border-white/10 shadow-2xl ${isPlaying ? 'animate-[spin_20s_linear_infinite]' : ''} bg-slate-800`}>
                            {currentSong.al.picUrl ? (
                                 <img src={currentSong.al.picUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                 <div className="w-full h-full flex items-center justify-center text-white/20">
                                     <Disc size={120} />
                                 </div>
                            )}
                            <div className="absolute inset-0 bg-black/10 rounded-full"></div>
                        </div>
                    </div>

                    <div 
                      ref={lyricScrollRef}
                      className="flex-1 w-full max-w-2xl h-full overflow-y-auto custom-scrollbar text-center md:text-left relative mask-gradient-y"
                      style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}
                    >
                      <div className="py-[40vh] space-y-6 md:space-y-8 px-4">
                          {lyrics.length === 0 ? (
                              <div className="text-white/40 text-lg flex flex-col items-center justify-center h-full">
                                  <span>纯音乐，请欣赏</span>
                                  <span className="text-sm mt-2">或暂无歌词</span>
                              </div>
                          ) : (
                              lyrics.map((line, index) => (
                                  <p 
                                      key={index}
                                      id={`lyric-line-${index}`}
                                      className={`transition-all duration-500 ease-out cursor-pointer
                                          ${index === currentLyricIndex 
                                              ? 'text-white text-xl md:text-3xl font-bold scale-105 origin-center md:origin-left shadow-white drop-shadow-md' 
                                              : 'text-white/40 text-base md:text-lg hover:text-white/70'
                                          }
                                      `}
                                      onClick={() => {
                                          if (audioRef.current) {
                                              audioRef.current.currentTime = line.time;
                                          }
                                      }}
                                  >
                                      {line.text}
                                  </p>
                              ))
                          )}
                      </div>
                    </div>
                </div>
            </div>

            {/* Queue Popup Panel */}
            {showQueue && (
             <div 
               ref={queueRef}
               className="fixed bottom-28 right-4 w-80 md:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[120] flex flex-col max-h-[60vh] animate-in slide-in-from-bottom-5 duration-200"
             >
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
                   <h3 className="font-bold text-slate-800 dark:text-slate-100">播放队列 ({queue.length})</h3>
                   <div className="flex items-center gap-3">
                        <button onClick={togglePlayMode} className="text-slate-400 hover:text-blue-500 transition-colors" title="切换模式">
                            {playMode === 'loop' && <Repeat size={16} />}
                            {playMode === 'single' && <Repeat1 size={16} />}
                            {playMode === 'shuffle' && <Shuffle size={16} />}
                        </button>
                        <button onClick={() => setQueue([])} className="text-slate-400 hover:text-red-500 transition-colors" title="清空队列">
                            <Trash2 size={16} />
                        </button>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {queue.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            队列为空
                        </div>
                    ) : (
                        queue.map((song, idx) => (
                            <div 
                                key={`${song.id}-${idx}`}
                                onClick={() => playSong(song)}
                                className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 group transition-colors
                                    ${currentSong?.id === song.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                                `}
                            >
                                {currentSong?.id === song.id && isPlaying ? (
                                    <div className="w-4 h-4 flex items-end justify-center gap-0.5">
                                        <span className="w-1 bg-blue-500 h-2 animate-[pulse_1s_ease-in-out_infinite]"></span>
                                        <span className="w-1 bg-blue-500 h-4 animate-[pulse_1.5s_ease-in-out_infinite]"></span>
                                        <span className="w-1 bg-blue-500 h-3 animate-[pulse_0.8s_ease-in-out_infinite]"></span>
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 w-4 text-center group-hover:hidden">{idx + 1}</span>
                                )}
                                <div className={`flex-1 min-w-0 ${currentSong?.id === song.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                    <div className="text-sm font-medium truncate">{song.name}</div>
                                    <div className="text-xs text-slate-400 truncate">{song.ar.map(a => a.name).join(', ')}</div>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newQ = queue.filter((_, i) => i !== idx);
                                        setQueue(newQ);
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
             </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 h-24 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between z-[110] transition-transform duration-300">
            {/* Info */}
            <div 
              className="flex items-center gap-4 w-1/3 min-w-0 cursor-pointer group"
              onClick={() => {
                  if (isFullView) {
                      setShowLyrics(!showLyrics);
                  } else {
                      onViewChange('music');
                  }
              }}
            >
                <div className={`w-14 h-14 rounded-lg overflow-hidden shadow-sm relative group-hover:shadow-md transition-all bg-slate-200 dark:bg-slate-800 ${isPlaying && !showLyrics ? 'animate-[spin_10s_linear_infinite]' : ''}`}>
                   {currentSong.al.picUrl ? (
                      <img src={currentSong.al.picUrl} alt="" className="w-full h-full object-cover" />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Music size={24} />
                      </div>
                   )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {isFullView ? (
                          <ChevronDown className={`text-white transition-transform ${showLyrics ? 'rotate-180' : 'rotate-0'}`} size={24} />
                      ) : (
                          <Maximize2 className="text-white" size={20} />
                      )}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-red-500 transition-colors flex items-center gap-2">
                      <span className="truncate">{currentSong.name}</span>
                      <button 
                        onClick={(e) => toggleLike(e, currentSong)}
                        className={`hidden group-hover:block transition-colors ${likedSongIds.has(String(currentSong.id)) ? 'text-red-500' : 'text-slate-300 hover:text-red-500'}`}
                      >
                         <Heart size={14} fill={likedSongIds.has(String(currentSong.id)) ? "currentColor" : "none"} />
                      </button>

                      <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFullscreen();
                        }}
                        className={`ml-2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors`}
                        title={isFullscreen ? "退出全屏" : "全屏模式"}
                      >
                          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                      </button>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentSong.ar.map(a => a.name).join(', ')}</div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-2 w-1/3">
              <div className="flex items-center gap-6">
                <button 
                  onClick={togglePlayMode}
                  className={`text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors relative group`}
                  title={playMode === 'loop' ? '列表循环' : playMode === 'single' ? '单曲循环' : '随机播放'}
                >
                   {playMode === 'loop' && <Repeat size={18} />}
                   {playMode === 'single' && <Repeat1 size={18} />}
                   {playMode === 'shuffle' && <Shuffle size={18} />}
                </button>

                <button onClick={playPrev} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"><SkipBack fill="currentColor" size={20} /></button>
                <button 
                    onClick={(e) => { e.stopPropagation(); currentSong && setIsPlaying(!isPlaying); }}
                    className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30 transition-all hover:scale-105"
                    disabled={!currentSong}
                >
                  {isPlaying ? <Pause fill="currentColor" size={18} /> : <Play fill="currentColor" size={18} className="ml-0.5" />}
                </button>
                <button onClick={playNext} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"><SkipForward fill="currentColor" size={20} /></button>
                
                 <button 
                  id="queue-toggle-btn"
                  onClick={(e) => { e.stopPropagation(); setShowQueue(!showQueue); }}
                  className={`transition-colors ${showQueue ? 'text-blue-500' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
                  title="播放列表"
                >
                   <ListMusic size={18} />
                </button>
              </div>
              <div className="w-full max-w-md flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span>{formatTime(progress)}</span>
                <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full relative overflow-hidden group">
                  <div 
                      className="absolute top-0 left-0 h-full bg-red-500 rounded-full" 
                      style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                  ></div>
                  <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    value={progress} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setProgress(val);
                      if (audioRef.current) audioRef.current.currentTime = val;
                    }}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Volume & Quality */}
            <div className="flex items-center justify-end gap-4 w-1/3">
                
                {/* Quality Selector */}
                <div className="relative" ref={qualityMenuRef}>
                    <button 
                        id="quality-toggle-btn"
                        onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-500 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 hover:border-red-400 transition-colors flex items-center gap-1"
                        title="音质选择"
                    >
                        <span>{getQualityLabel(quality)}</span>
                    </button>
                    {showQualityMenu && (
                        <div className="absolute bottom-full right-0 mb-3 w-28 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-1">
                            {QUALITY_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => changeQuality(opt.value)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between
                                        ${quality === opt.value 
                                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }
                                    `}
                                >
                                    <span>{opt.label}</span>
                                    <span className="text-[10px] opacity-60 ml-2 scale-90">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 group w-24 justify-end">
                  <button onClick={() => setVolume(v => v === 0 ? 0.5 : 0)} className="text-slate-400 hover:text-slate-600">
                    {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <div className="w-16 h-1 bg-slate-200 dark:bg-slate-800 rounded-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-slate-400 dark:bg-slate-500" style={{ width: `${volume * 100}%` }}></div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={volume} 
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
            </div>
          </div>
        </>
      )}

    </>
  );
};

export default MusicPlatform;